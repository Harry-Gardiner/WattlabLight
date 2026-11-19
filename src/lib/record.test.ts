import { describe, expect, it } from 'vitest'
import type { Sample } from '../workout/engine'
import { MIN_SAVE_SEC, buildRecord, totals } from './record'

const steady = (n: number, power = 150): Sample[] =>
  Array.from({ length: n }, (_, i) => ({ t: i + 1, power, cadence: 80, hr: 120, target: power }))

const base = { startedAt: 1_700_000_000_000, name: 'Free ride', workoutId: null, rider: 'Rider 1', ftp: 150 }

describe('buildRecord', () => {
  it('drops rides shorter than the minimum', () => {
    expect(buildRecord({ ...base, samples: steady(MIN_SAVE_SEC - 1) })).toBeNull()
  })

  it('keeps a ride at the minimum and computes stats', () => {
    const r = buildRecord({ ...base, samples: steady(MIN_SAVE_SEC) })
    expect(r).not.toBeNull()
    expect(r?.durationSec).toBe(MIN_SAVE_SEC)
    expect(r?.stats.avgPower).toBe(150)
    expect(r?.stats.avgHr).toBe(120)
  })
})

describe('totals', () => {
  it('sums rides, seconds and TSS', () => {
    const a = buildRecord({ ...base, samples: steady(600) })!
    const b = buildRecord({ ...base, samples: steady(1200) })!
    expect(totals([a, b])).toEqual({ rides: 2, seconds: 1800, tss: a.stats.tss + b.stats.tss })
  })

  it('is zero for no rides', () => {
    expect(totals([])).toEqual({ rides: 0, seconds: 0, tss: 0 })
  })
})
