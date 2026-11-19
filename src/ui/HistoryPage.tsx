import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type RideRecord, totals } from '../lib/record'
import { useHistory } from '../store/history'
import { PRESETS } from '../workout/presets'
import { fmtTime } from '../workout/engine'
import { ProfileChart } from './ProfileChart'

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Detail({ r }: { r: RideRecord }) {
  const remove = useHistory((s) => s.remove)
  const [confirm, setConfirm] = useState(false)
  const workout = PRESETS.find((p) => p.id === r.workoutId)
  const s = r.stats
  const items: [string, string | number][] = [
    ['Avg power', `${s.avgPower} W`],
    ['Max power', `${s.maxPower} W`],
    ['Normalized', `${s.np} W`],
    ['Intensity', s.intensity.toFixed(2)],
    ['Avg HR', s.avgHr ? `${s.avgHr} bpm` : '--'],
    ['Avg cadence', s.avgCadence ? `${s.avgCadence} rpm` : '--'],
  ]
  return (
    <div className="space-y-3 border-t border-border p-3">
      {workout && <ProfileChart workout={workout} height={70} samples={r.samples} ftp={r.ftp} className="rounded" />}
      <dl className="grid grid-cols-3 gap-2 text-center">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-bg p-2">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        {r.rider} · FTP {r.ftp} W
      </p>
      {confirm ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => setConfirm(false)}>
            Keep
          </button>
          <button className="btn-danger" onClick={() => r.id != null && void remove(r.id)}>
            Delete ride
          </button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete
        </button>
      )}
    </div>
  )
}

export function HistoryPage() {
  const { rides, loaded, load } = useHistory()
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    void load()
  }, [load])
  const t = totals(rides)

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="font-display text-3xl font-semibold">History</h1>
        <p className="text-sm text-muted">
          {t.rides
            ? `${t.rides} ride${t.rides === 1 ? '' : 's'} · ${fmtTime(t.seconds)} · ${t.tss} TSS`
            : 'Finished rides are saved on this device.'}
        </p>
      </header>

      {loaded && rides.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          No rides yet. Rides of 30 seconds or more are saved when you end them.
        </p>
      )}

      <ul className="space-y-2">
        {rides.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-surface">
            <button
              className="flex min-h-16 w-full items-center justify-between gap-3 p-3 text-left"
              aria-expanded={open === r.id}
              onClick={() => setOpen(open === r.id ? null : (r.id ?? null))}
            >
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-xs text-muted">{fmtDate(r.startedAt)}</span>
              </span>
              <span className="text-right text-sm">
                <span className="block font-semibold">{fmtTime(r.durationSec)}</span>
                <span className="block text-xs text-muted">
                  {r.stats.avgPower} W · {r.stats.tss} TSS
                </span>
              </span>
            </button>
            {open === r.id && <Detail r={r} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
