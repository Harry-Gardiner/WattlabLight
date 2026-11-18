import { describe, expect, it } from 'vitest'
import { estimateTss, fmtTime, locate, pctAt, rideStats, toWatts, totalSec, zoneOf } from './engine'
import { PRESETS } from './presets'

describe('presets', () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))('%s has warm-up first and cool-down last', (_n, p) => {
    expect(p.steps[0].kind).toBe('warmup')
    expect(p.steps[p.steps.length - 1].kind).toBe('cooldown')
  })

  it('durations match the numbers in the names', () => {
    const named = PRESETS.map((p) => [p.name, Math.round(totalSec(p) / 60)] as const)
    expect(Object.fromEntries(named)).toMatchObject({
      'Easy Spin 20': 20,
      'Steady Spin 30': 30,
      'Endurance 45': 45,
      'Cadence Drills 30': 30,
      'Tempo Blocks 45': 45,
      'Sweet Spot 45': 45,
      'Threshold 30': 30,
      'Threshold 45': 45,
      'Over-Unders 45': 45,
      'Sprint Intervals 30': 30,
      'Tabata Punch 25': 25,
      'Pyramid 45': 45,
    })
  })

  it('has unique ids', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
  })
})

describe('locate / pctAt', () => {
  const wo = PRESETS[0] // 3 + 14 + 3 min

  it('finds the step at a time', () => {
    expect(locate(wo, 0)?.index).toBe(0)
    expect(locate(wo, 3 * 60)?.index).toBe(1)
    expect(locate(wo, 17 * 60)?.index).toBe(2)
    expect(locate(wo, 20 * 60)).toBeNull()
  })

  it('interpolates ramps', () => {
    const step = wo.steps[0] // 45 -> 60 over 180 s
    expect(pctAt(step, 0)).toBe(45)
    expect(pctAt(step, 90)).toBe(52.5)
  })
})

describe('helpers', () => {
  it('maps % FTP to zones', () => {
    expect([40, 60, 80, 100, 110, 130, 170].map(zoneOf)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('converts to watts', () => {
    expect(toWatts(90, 200)).toBe(180)
  })

  it('formats time', () => {
    expect(fmtTime(65)).toBe('1:05')
    expect(fmtTime(3725)).toBe('1:02:05')
  })

  it('estimates a sensible TSS', () => {
    const tss = estimateTss(PRESETS.find((p) => p.id === 'threshold-45')!)
    expect(tss).toBeGreaterThan(40)
    expect(tss).toBeLessThan(80)
  })
})

describe('rideStats', () => {
  it('a steady ride at FTP gives IF ~1 and ~100 TSS/hour', () => {
    const samples = Array.from({ length: 3600 }, (_, t) => ({ t, power: 200, cadence: 90, hr: 150, target: 200 }))
    const s = rideStats(samples, 200)
    expect(s.avgPower).toBe(200)
    expect(s.np).toBe(200)
    expect(s.intensity).toBe(1)
    expect(s.tss).toBe(100)
    expect(s.avgHr).toBe(150)
  })

  it('handles empty rides', () => {
    expect(rideStats([], 200).tss).toBe(0)
  })
})
