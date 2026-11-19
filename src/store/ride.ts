import { create } from 'zustand'
import { getTrainerControl, useDevices } from '../ble/devices'
import { type Sample, locate, pctAt, toWatts, totalSec } from '../workout/engine'
import type { Workout } from '../workout/types'
import { beep, unlockAudio, vibrate } from '../lib/cues'
import { buildRecord } from '../lib/record'
import { useHistory } from './history'
import { useSettings } from './settings'
import { useTelemetry } from './telemetry'

export type RideStatus = 'idle' | 'running' | 'paused' | 'done'
export type FreeMode = 'erg' | 'sim'

interface Ride {
  workout: Workout | null // null = free ride
  status: RideStatus
  elapsed: number
  scale: number // intensity multiplier (1 = 100%)
  offsetW: number // manual +/- watts on top of the plan
  freeMode: FreeMode
  freeTarget: number
  grade: number
  target: number | null // watts currently asked of the trainer
  cappedFrom: number | null // set when the wanted target exceeded the trainer's reported max
  ftp: number
  samples: Sample[]
  select: (w: Workout | null) => void
  setScale: (s: number) => void
  setFreeMode: (m: FreeMode) => void
  setGrade: (g: number) => void
  nudge: (watts: number) => void
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  skip: () => void
  end: () => void
  reset: () => void
}

let timer: ReturnType<typeof setInterval> | null = null
let lastSent: number | null = null
let startedAt = 0

const stopTimer = () => {
  if (timer) clearInterval(timer)
  timer = null
}

const clampWatts = (w: number) => {
  const info = useDevices.getState().trainerInfo
  const max = info?.max ?? 2000
  return Math.max(0, Math.min(max, Math.round(w)))
}

function sendTarget(w: number) {
  if (w === lastSent) return
  lastSent = w
  getTrainerControl()
    ?.setTargetPower(w)
    .catch((e) => console.warn('setTargetPower failed', e))
}

/** The plan target (watts) at second t, before manual offset. */
function plannedWatts(s: Ride, t: number): number | null {
  if (s.workout) {
    const loc = locate(s.workout, t)
    if (!loc) return null
    return toWatts(pctAt(loc.step, loc.into) * s.scale, s.ftp)
  }
  return s.freeMode === 'erg' ? s.freeTarget : null
}

export const useRide = create<Ride>((set, get) => ({
  workout: null,
  status: 'idle',
  elapsed: 0,
  scale: 1,
  offsetW: 0,
  freeMode: 'erg',
  freeTarget: 120,
  grade: 0,
  target: null,
  cappedFrom: null,
  ftp: 150,
  samples: [],

  select: (workout) => set({ workout, status: 'idle', elapsed: 0, samples: [], offsetW: 0, target: null }),
  setScale: (scale) => set({ scale }),
  setFreeMode: (freeMode) => set({ freeMode }),
  setGrade: (grade) => {
    set({ grade })
    if (get().status === 'running' && !get().workout) getTrainerControl()?.setGrade(grade).catch(() => undefined)
  },
  nudge: (watts) => {
    const s = get()
    if (s.workout || s.freeMode === 'sim') {
      set({ offsetW: s.offsetW + watts })
    } else {
      set({ freeTarget: Math.max(0, s.freeTarget + watts) })
    }
    if (s.status === 'running') applyNow()
  },

  start: async () => {
    const s = get()
    const profiles = useSettings.getState()
    const ftp = (profiles.profiles.find((p) => p.id === profiles.activeId) ?? profiles.profiles[0]).ftp
    unlockAudio() // must happen inside the tap
    startedAt = Date.now()
    set({ status: 'running', elapsed: 0, samples: [], ftp, offsetW: 0 })
    lastSent = null
    const ctl = getTrainerControl()
    try {
      await ctl?.start()
      if (!s.workout && s.freeMode === 'sim') await ctl?.setGrade(s.grade)
    } catch (e) {
      console.warn('trainer start failed', e)
    }
    applyNow()
    stopTimer()
    timer = setInterval(tick, 1000)
  },

  pause: () => {
    stopTimer()
    set({ status: 'paused' })
    getTrainerControl()?.stop().catch(() => undefined)
  },
  resume: () => {
    lastSent = null
    set({ status: 'running' })
    getTrainerControl()?.start().catch(() => undefined)
    applyNow()
    stopTimer()
    timer = setInterval(tick, 1000)
  },
  skip: () => {
    const s = get()
    if (!s.workout) return
    const loc = locate(s.workout, s.elapsed)
    if (loc) set({ elapsed: loc.end })
    applyNow()
  },
  end: () => finish(),
  reset: () => {
    stopTimer()
    set({ status: 'idle', elapsed: 0, samples: [], offsetW: 0, target: null })
  },
}))

/** Re-evaluate the target for the current second and send it to the trainer. */
function applyNow() {
  const s = useRide.getState()
  const planned = plannedWatts(s, s.elapsed)
  if (planned == null) {
    useRide.setState({ target: null })
    return
  }
  const wanted = Math.max(0, Math.round(planned + s.offsetW))
  const w = clampWatts(wanted)
  useRide.setState({ target: w, cappedFrom: w < wanted ? wanted : null })
  sendTarget(w)
}

function finish() {
  stopTimer()
  useRide.setState({ status: 'done', target: null })
  const s = useRide.getState()
  const settings = useSettings.getState()
  const rec = buildRecord({
    startedAt,
    name: s.workout?.name ?? 'Free ride',
    workoutId: s.workout?.id ?? null,
    rider: (settings.profiles.find((p) => p.id === settings.activeId) ?? settings.profiles[0]).name,
    ftp: s.ftp,
    samples: s.samples,
  })
  if (rec) void useHistory.getState().add(rec)
  getTrainerControl()?.stop().catch(() => undefined)
  lastSent = null
}

function tick() {
  const s = useRide.getState()
  if (s.status !== 'running') return
  const elapsed = s.elapsed + 1

  if (s.workout && elapsed >= totalSec(s.workout)) {
    useRide.setState({ elapsed: totalSec(s.workout) })
    beep('done')
    vibrate([200, 100, 200])
    finish()
    return
  }

  // countdown cues before each step change
  if (s.workout) {
    const loc = locate(s.workout, elapsed)
    const next = loc && s.workout.steps[loc.index + 1]
    const left = loc ? loc.end - elapsed : 0
    if (loc && next && left >= 1 && left <= 3) {
      beep(next.from > loc.step.to ? 'up' : 'down')
      if (left === 1) vibrate(next.from > loc.step.to ? [120, 60, 120] : [200])
    }
  }

  const tel = useTelemetry.getState()
  const sample: Sample = {
    t: elapsed,
    power: tel.power3,
    cadence: tel.cadence,
    hr: tel.hr,
    target: s.target,
  }
  useRide.setState({ elapsed, samples: [...s.samples, sample] })
  applyNow()
}
