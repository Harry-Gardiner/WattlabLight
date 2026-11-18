import type { Step, Workout } from './types'

export const totalSec = (w: Workout) => w.steps.reduce((a, s) => a + s.sec, 0)

export interface Located {
  index: number
  step: Step
  into: number // seconds into this step
  start: number
  end: number
}

/** Which step is active at time t (seconds). null once the workout is over. */
export function locate(w: Workout, t: number): Located | null {
  let start = 0
  for (let index = 0; index < w.steps.length; index++) {
    const step = w.steps[index]
    const end = start + step.sec
    if (t < end) return { index, step, into: t - start, start, end }
    start = end
  }
  return null
}

export function pctAt(step: Step, into: number): number {
  return step.from + ((step.to - step.from) * into) / step.sec
}

export const toWatts = (pct: number, ftp: number) => Math.round((pct * ftp) / 100)

/** Coggan power zone 1-7 from % FTP. */
export function zoneOf(pct: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (pct < 55) return 1
  if (pct < 76) return 2
  if (pct < 91) return 3
  if (pct < 106) return 4
  if (pct < 121) return 5
  if (pct < 151) return 6
  return 7
}

export const zoneColor = (pct: number) => `var(--color-z${zoneOf(pct)})`

/** Normalized-power-ish TSS estimate of a workout at 100% scale (IF from time-weighted mean of pct^4). */
export function estimateTss(w: Workout): number {
  let sum = 0
  let secs = 0
  for (const s of w.steps) {
    const mid = (s.from + s.to) / 200
    sum += Math.pow(mid, 4) * s.sec
    secs += s.sec
  }
  const intensity = Math.pow(sum / secs, 0.25)
  return Math.round((secs * intensity * intensity) / 36)
}

export interface Sample {
  t: number
  power: number | null
  cadence: number | null
  hr: number | null
  target: number | null
}

export interface RideStats {
  avgPower: number
  maxPower: number
  np: number
  intensity: number
  tss: number
  avgHr: number | null
  maxHr: number | null
  avgCadence: number | null
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function rideStats(samples: Sample[], ftp: number): RideStats {
  const power = samples.map((s) => s.power ?? 0)
  // Normalized power: 30 s rolling avg, 4th-power mean, 4th root
  const rolling: number[] = []
  for (let i = 0; i < power.length; i++) {
    const win = power.slice(Math.max(0, i - 29), i + 1)
    rolling.push(mean(win))
  }
  const np = rolling.length ? Math.pow(mean(rolling.map((p) => Math.pow(p, 4))), 0.25) : 0
  const intensity = ftp > 0 ? np / ftp : 0
  const hr = samples.map((s) => s.hr).filter((v): v is number => v != null && v > 0)
  const cad = samples.map((s) => s.cadence).filter((v): v is number => v != null && v > 0)
  return {
    avgPower: Math.round(mean(power)),
    maxPower: Math.max(0, ...power),
    np: Math.round(np),
    intensity: Math.round(intensity * 100) / 100,
    tss: Math.round((samples.length * np * intensity) / (ftp * 36)) || 0,
    avgHr: hr.length ? Math.round(mean(hr)) : null,
    maxHr: hr.length ? Math.max(...hr) : null,
    avgCadence: cad.length ? Math.round(mean(cad)) : null,
  }
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? h + ':' : ''}${mm}:${String(r).padStart(2, '0')}`
}
