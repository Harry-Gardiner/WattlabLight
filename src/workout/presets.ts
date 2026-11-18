import type { Category, Step, StepKind, Workout } from './types'

const min = (m: number) => m * 60

const ramp = (m: number, from: number, to: number, kind: StepKind, label: string): Step => ({
  sec: min(m),
  from,
  to,
  kind,
  label,
})
const steady = (m: number, pct: number, kind: StepKind, label: string): Step => ramp(m, pct, pct, kind, label)
const secs = (s: number, pct: number, kind: StepKind, label: string): Step => ({
  sec: s,
  from: pct,
  to: pct,
  kind,
  label,
})
const repeat = (n: number, build: (i: number) => Step[]): Step[] =>
  Array.from({ length: n }, (_, i) => build(i)).flat()

const warm = (m: number): Step => ramp(m, 45, 65, 'warmup', 'Warm-up')
const cool = (m: number): Step => ramp(m, 60, 40, 'cooldown', 'Cool-down')

function w(id: string, name: string, category: Category, description: string, steps: Step[]): Workout {
  return { id, name, category, description, steps }
}

/** Every preset: warm-up first, cool-down last. Power is % of FTP. */
export const PRESETS: Workout[] = [
  w('easy-20', 'Easy Spin 20', 'Recovery', 'Gentle legs-turning. Keep it conversational.', [
    ramp(3, 45, 60, 'warmup', 'Warm-up'),
    steady(14, 60, 'work', 'Easy spin'),
    cool(3),
  ]),
  w('steady-30', 'Steady Spin 30', 'Endurance', 'Comfortable zone 2 for half an hour.', [
    warm(5),
    steady(20, 65, 'work', 'Steady Z2'),
    cool(5),
  ]),
  w('endurance-45', 'Endurance 45', 'Endurance', 'Zone 2 base with a short surge every 10 minutes.', [
    warm(8),
    ...repeat(3, () => [steady(8, 68, 'work', 'Endurance'), steady(2, 75, 'work', 'Surge')]),
    cool(7),
  ]),
  w('cadence-30', 'Cadence Drills 30', 'Endurance', 'Spin up to 100+ rpm on the work blocks, easy between.', [
    warm(5),
    ...repeat(5, () => [steady(2, 70, 'work', 'High cadence 100+ rpm'), steady(2, 55, 'rest', 'Recover')]),
    cool(5),
  ]),
  w('tempo-45', 'Tempo Blocks 45', 'Threshold', 'Two long tempo blocks. Strong but steady.', [
    warm(10),
    steady(12, 80, 'work', 'Tempo'),
    steady(5, 55, 'rest', 'Recover'),
    steady(12, 80, 'work', 'Tempo'),
    cool(6),
  ]),
  w('sweetspot-45', 'Sweet Spot 45', 'Threshold', 'Two 14 minute blocks just below threshold.', [
    warm(8),
    steady(14, 90, 'work', 'Sweet spot'),
    steady(5, 55, 'rest', 'Recover'),
    steady(14, 90, 'work', 'Sweet spot'),
    cool(4),
  ]),
  w('threshold-30', 'Threshold 30', 'Threshold', 'Short and sharp: two 8 minute efforts at FTP.', [
    ramp(5, 45, 65, 'warmup', 'Warm-up'),
    secs(30, 110, 'sprint', 'Opener'),
    secs(30, 55, 'rest', 'Easy'),
    secs(30, 110, 'sprint', 'Opener'),
    secs(30, 55, 'rest', 'Easy'),
    steady(8, 100, 'work', 'Threshold'),
    steady(4, 55, 'rest', 'Recover'),
    steady(8, 100, 'work', 'Threshold'),
    cool(3),
  ]),
  w('threshold-45', 'Threshold 45', 'Threshold', 'Three 8 minute efforts at FTP.', [
    warm(10),
    steady(8, 100, 'work', 'Threshold'),
    steady(3, 55, 'rest', 'Recover'),
    steady(8, 100, 'work', 'Threshold'),
    steady(3, 55, 'rest', 'Recover'),
    steady(8, 100, 'work', 'Threshold'),
    cool(5),
  ]),
  w('overunders-45', 'Over-Unders 45', 'Threshold', 'Alternate just under and just over FTP to train clearing lactate.', [
    warm(8),
    ...repeat(3, (set) => [
      ...repeat(3, () => [steady(2, 95, 'work', 'Under'), steady(1, 105, 'work', 'Over')]),
      ...(set < 2 ? [steady(3, 55, 'rest', 'Recover')] : []),
    ]),
    cool(4),
  ]),
  w('vo2-40', 'VO2 Max 4x4', 'Intervals', 'Four hard 4 minute efforts. Classic aerobic booster.', [
    warm(10),
    ...repeat(4, (i) => [
      steady(4, 118, 'work', 'VO2 effort'),
      ...(i < 3 ? [steady(3, 50, 'rest', 'Recover')] : []),
    ]),
    cool(5),
  ]),
  w('sprints-30', 'Sprint Intervals 30', 'Intervals', 'Six all-out 30 second sprints with full recovery.', [
    warm(8),
    ...repeat(6, () => [secs(30, 170, 'sprint', 'SPRINT'), steady(2, 50, 'rest', 'Recover')]),
    cool(7),
  ]),
  w('tabata-25', 'Tabata Punch 25', 'Intervals', 'Two sets of 8 x 20s on / 10s off. Brutal and brief.', [
    warm(8),
    ...repeat(2, (set) => [
      ...repeat(8, () => [secs(20, 160, 'sprint', 'PUNCH'), secs(10, 40, 'rest', 'Off')]),
      ...(set < 1 ? [steady(4, 50, 'rest', 'Recover')] : []),
    ]),
    cool(5),
  ]),
  w('pyramid-45', 'Pyramid 45', 'Intervals', '1-2-3-4-3-2-1 minute efforts with matching recoveries.', [
    warm(10),
    ...[1, 2, 3, 4, 3, 2, 1].flatMap((m, i, a) => [
      steady(m, 110, 'work', `${m} min effort`),
      ...(i < a.length - 1 ? [steady(m, 50, 'rest', 'Recover')] : []),
    ]),
    cool(4),
  ]),
]
