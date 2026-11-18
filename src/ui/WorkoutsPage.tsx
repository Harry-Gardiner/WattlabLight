import { ChevronDown, Play, Timer } from 'lucide-react'
import { useState } from 'react'
import { useActiveProfile } from '../store/settings'
import { useNav } from '../store/nav'
import { useRide } from '../store/ride'
import { estimateTss, fmtTime, toWatts, totalSec } from '../workout/engine'
import { PRESETS } from '../workout/presets'
import type { Category, Workout } from '../workout/types'
import { ProfileChart } from './ProfileChart'

const LENGTHS = [
  { label: 'All', test: () => true },
  { label: '≤ 25 min', test: (m: number) => m <= 25 },
  { label: '30 min', test: (m: number) => m > 25 && m <= 35 },
  { label: '40-45 min', test: (m: number) => m > 35 },
]
const CATS: ('All' | Category)[] = ['All', 'Recovery', 'Endurance', 'Threshold', 'Intervals']

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${
        on ? 'border-accent bg-accent text-bg' : 'border-border bg-surface text-fg'
      }`}
    >
      {children}
    </button>
  )
}

function WorkoutCard({ w, ftp, open, onToggle }: { w: Workout; ftp: number; open: boolean; onToggle: () => void }) {
  const select = useRide((s) => s.select)
  const go = useNav((s) => s.go)
  const mins = Math.round(totalSec(w) / 60)

  const start = () => {
    select(w)
    go('ride')
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button className="block w-full p-4 text-left" onClick={onToggle} aria-expanded={open}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">{w.name}</h2>
            <p className="text-sm text-muted">
              {w.category} · {mins} min · TSS ~{estimateTss(w)}
            </p>
          </div>
          <ChevronDown className={`size-5 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </div>
        <ProfileChart workout={w} height={48} className="mt-3 rounded" />
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <p className="text-sm text-muted">{w.description}</p>
          <ol className="mt-3 max-h-60 space-y-1 overflow-y-auto text-sm">
            {w.steps.map((s, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-border/50 py-1">
                <span>
                  {s.label} <span className="text-muted">· {fmtTime(s.sec)}</span>
                </span>
                <span className="tabular-nums">
                  {s.from === s.to
                    ? `${toWatts(s.from, ftp)} W`
                    : `${toWatts(s.from, ftp)}→${toWatts(s.to, ftp)} W`}
                </span>
              </li>
            ))}
          </ol>
          <button className="btn-primary mt-4 w-full" onClick={start}>
            <Play className="size-5" aria-hidden /> Ride this
          </button>
        </div>
      )}
    </article>
  )
}

export function WorkoutsPage() {
  const profile = useActiveProfile()
  const select = useRide((s) => s.select)
  const go = useNav((s) => s.go)
  const [len, setLen] = useState(0)
  const [cat, setCat] = useState<'All' | Category>('All')
  const [open, setOpen] = useState<string | null>(null)

  const list = PRESETS.filter(
    (w) => LENGTHS[len].test(Math.round(totalSec(w) / 60)) && (cat === 'All' || w.category === cat),
  )

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Workouts</h1>
          <p className="text-sm text-muted">
            Watts shown for {profile.name} at FTP {profile.ftp} W
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            select(null)
            go('ride')
          }}
        >
          <Timer className="size-4" aria-hidden /> Free ride
        </button>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by length">
        {LENGTHS.map((l, i) => (
          <Chip key={l.label} on={len === i} onClick={() => setLen(i)}>
            {l.label}
          </Chip>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by type">
        {CATS.map((c) => (
          <Chip key={c} on={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((w) => (
          <WorkoutCard
            key={w.id}
            w={w}
            ftp={profile.ftp}
            open={open === w.id}
            onToggle={() => setOpen(open === w.id ? null : w.id)}
          />
        ))}
        {list.length === 0 && <p className="py-8 text-center text-muted">No workouts match those filters.</p>}
      </div>
    </div>
  )
}
