import { Plus, Trash2 } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from '../store/settings'

export function SettingsPage() {
  const { profiles, activeId, sound, setActive, updateProfile, addProfile, removeProfile, setSound } = useSettings()
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="font-display text-3xl font-semibold">Profile</h1>
        <p className="text-sm text-muted">Workout watts are calculated from each rider's FTP.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Riders">
        {profiles.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === active.id}
            onClick={() => setActive(p.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${
              p.id === active.id ? 'border-accent bg-accent text-bg' : 'border-border bg-surface'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          className="btn-secondary shrink-0"
          onClick={() => addProfile(`Rider ${profiles.length + 1}`)}
          aria-label="Add rider"
        >
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
        <label className="block">
          <span className="text-sm text-muted">Name</span>
          <input
            className="field mt-1"
            value={active.name}
            onChange={(e) => updateProfile(active.id, { name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">FTP (watts)</span>
          <input
            className="field mt-1"
            type="number"
            inputMode="numeric"
            min={50}
            max={500}
            value={active.ftp}
            onChange={(e) => updateProfile(active.id, { ftp: Math.max(50, Math.min(500, Number(e.target.value) || 0)) })}
          />
          <span className="mt-1 block text-xs text-muted">
            Not sure? 150 W is a fair start for a casual rider. Adjust once workouts feel too easy or too hard.
          </span>
        </label>
        {profiles.length > 1 && (
          <button className="btn-secondary" onClick={() => removeProfile(active.id)}>
            <Trash2 className="size-4" aria-hidden /> Remove {active.name}
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            Beeps and vibration
            <span className="block text-xs text-muted">Countdown before each interval change.</span>
          </span>
          <input type="checkbox" className="size-6 accent-accent" checked={sound} onChange={(e) => setSound(e.target.checked)} />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">App updates</h2>
        <p className="mt-1 text-muted">
          {needRefresh
            ? 'A new version is ready.'
            : 'Up to date. New versions appear here and as a banner when they are published.'}
        </p>
        {needRefresh && (
          <button className="btn-primary mt-3" onClick={() => updateServiceWorker(true)}>
            Reload with new version
          </button>
        )}
      </section>
    </div>
  )
}
