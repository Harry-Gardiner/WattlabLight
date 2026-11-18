import { type Sample, totalSec, zoneColor } from '../workout/engine'
import type { Workout } from '../workout/types'

interface Props {
  workout: Workout
  height?: number
  cursor?: number // elapsed seconds
  samples?: Sample[]
  ftp?: number
  scale?: number
  className?: string
}

const MAX = 175 // chart top, % FTP

/** Workout shape coloured by power zone, optional "now" cursor and actual-power trace. */
export function ProfileChart({ workout, height = 56, cursor, samples, ftp, scale = 1, className }: Props) {
  const total = totalSec(workout)
  const y = (pct: number) => MAX - Math.min(MAX, pct * scale)
  const bars = workout.steps.map((s, i) => {
    const x0 = workout.steps.slice(0, i).reduce((a, p) => a + p.sec, 0)
    const x = x0 + s.sec
    const points = `${x0},${MAX} ${x0},${y(s.from)} ${x},${y(s.to)} ${x},${MAX}`
    return <polygon key={i} points={points} fill={zoneColor(((s.from + s.to) / 2) * scale)} opacity={0.9} />
  })

  const trace =
    samples && ftp && samples.length > 1
      ? samples.map((p) => `${p.t},${y(((p.power ?? 0) / ftp) * 100 / scale)}`).join(' ')
      : null

  return (
    <svg
      viewBox={`0 0 ${total} ${MAX}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
      role="img"
      aria-label={`${workout.name} profile`}
    >
      {bars}
      {trace && (
        <polyline points={trace} fill="none" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      )}
      {cursor != null && (
        <line x1={cursor} x2={cursor} y1={0} y2={MAX} stroke="var(--color-accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}
