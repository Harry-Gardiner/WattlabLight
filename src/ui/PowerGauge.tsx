import type { ReactNode } from 'react'
import { zoneColor } from '../workout/engine'

interface Props {
  power: number | null
  target: number | null
  max: number // watts at a full arc
  ftp: number
  children?: ReactNode // centre content (the big number)
  footer?: ReactNode // sits in the open gap at the bottom of the arc
}

// 270 degree arc, opening at the bottom. Drawn once with pathLength=100 so dash values are plain percentages.
const ARC = 'M 39.9 160.1 A 85 85 0 1 1 160.1 160.1'
const SWEEP = 270
const START = 135 // degrees, measured clockwise from the +x axis (SVG space)
const ease = 'transition-[stroke-dasharray,stroke,transform] duration-500 ease-out'

/** Arc that fills and drains with live power, coloured by zone, with a marker for the target. */
export function PowerGauge({ power, target, max, ftp, children, footer }: Props) {
  const frac = Math.min(1, Math.max(0, (power ?? 0) / max))
  const pct = ftp > 0 && power != null ? (power / ftp) * 100 : 0
  const color = zoneColor(pct)
  const targetDeg = START + SWEEP * Math.min(1, Math.max(0, (target ?? 0) / max))

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <svg viewBox="0 0 200 178" className="block w-full" role="img" aria-label={`Power ${power ?? 0} watts`}>
        <path d={ARC} pathLength={100} fill="none" stroke="var(--color-border)" strokeWidth={14} strokeLinecap="round" strokeDasharray="100 100" />
        <path
          d={ARC}
          pathLength={100}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, frac * 100)} 100`}
          className={ease}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {/* target marker: full-diameter line centred on (100,100) so it rotates about the gauge centre; only the outer 18 units are drawn */}
        {target != null && target > 0 && (
          <line
            x1={5}
            y1={100}
            x2={195}
            y2={100}
            stroke="#fff"
            strokeWidth={4}
            strokeDasharray="0 171 18 100"
            className={ease}
            style={{ transform: `rotate(${targetDeg}deg)`, transformOrigin: 'center', transformBox: 'fill-box' }}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 top-[6%] flex h-[56%] flex-col items-center justify-center">{children}</div>
      {footer && <div className="absolute inset-x-0 bottom-0 text-center">{footer}</div>}
    </div>
  )
}
