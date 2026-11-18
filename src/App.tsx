import { Bike, Dumbbell, Radio, Settings } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { type Tab, useNav } from './store/nav'
import { useRide } from './store/ride'
import { DevicesPage } from './ui/DevicesPage'
import { RidePage } from './ui/RidePage'
import { SettingsPage } from './ui/SettingsPage'
import { WorkoutsPage } from './ui/WorkoutsPage'

const TABS: { id: Tab; label: string; icon: typeof Bike }[] = [
  { id: 'devices', label: 'Devices', icon: Radio },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'ride', label: 'Ride', icon: Bike },
  { id: 'settings', label: 'Profile', icon: Settings },
]

export default function App() {
  const { tab, go } = useNav()
  const riding = useRide((s) => s.status === 'running' || s.status === 'paused')
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      {needRefresh && !riding && (
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-accent px-4 py-3 text-center font-semibold text-bg"
        >
          New version ready: tap to reload
        </button>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'devices' && <DevicesPage />}
        {tab === 'workouts' && <WorkoutsPage />}
        {tab === 'ride' && <RidePage />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      <nav className="grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
              tab === id ? 'text-accent' : 'text-muted'
            }`}
          >
            <Icon className="size-6" aria-hidden />
            {label}
            {id === 'ride' && riding && <span className="sr-only"> in progress</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}
