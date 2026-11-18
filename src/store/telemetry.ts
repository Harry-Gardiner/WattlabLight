import { create } from 'zustand'

interface Telemetry {
  power: number | null // instantaneous watts
  power3: number | null // 3 s average, what the UI shows
  cadence: number | null
  hr: number | null
  speed: number | null
  setPower: (w: number) => void
  setCadence: (rpm: number) => void
  setHr: (bpm: number) => void
  setSpeed: (kmh: number) => void
  clear: (keys: ('power' | 'cadence' | 'hr' | 'speed')[]) => void
}

let history: { t: number; w: number }[] = []

export const useTelemetry = create<Telemetry>((set) => ({
  power: null,
  power3: null,
  cadence: null,
  hr: null,
  speed: null,
  setPower: (w) => {
    const now = Date.now()
    history = history.filter((h) => now - h.t <= 3000)
    history.push({ t: now, w })
    const avg = Math.round(history.reduce((a, h) => a + h.w, 0) / history.length)
    set({ power: w, power3: avg })
  },
  setCadence: (cadence) => set({ cadence }),
  setHr: (hr) => set({ hr }),
  setSpeed: (speed) => set({ speed }),
  clear: (keys) =>
    set((s) => {
      const next: Partial<Telemetry> = {}
      for (const k of keys) {
        next[k] = null
        if (k === 'power') {
          next.power3 = null
          history = []
        }
      }
      return { ...s, ...next }
    }),
}))
