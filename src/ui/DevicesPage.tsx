import { Bike, Gauge, HeartPulse, type LucideIcon, RefreshCw, TestTube2, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import {
  type Kind,
  type Slot,
  type Status,
  bluetoothSupported,
  forget,
  getTrainerControl,
  pair,
  reconnect,
  startMockDevices,
  stopMockDevices,
  useDevices,
} from '../ble/devices'
import { useTelemetry } from '../store/telemetry'

const COPY: Record<Kind, { title: string; icon: LucideIcon; hint: string; unit: string; required?: boolean }> = {
  trainer: {
    title: 'Smart trainer',
    icon: Bike,
    hint: 'Pedal a few turns to wake it up. It shows as something like "D100".',
    unit: 'W',
    required: true,
  },
  hr: {
    title: 'Heart rate',
    icon: HeartPulse,
    hint: 'Chest strap, or a watch with heart-rate broadcast switched on.',
    unit: 'bpm',
  },
  cadence: {
    title: 'Cadence sensor',
    icon: Gauge,
    hint: 'Optional. Only needed if the trainer does not report cadence.',
    unit: 'rpm',
  },
}

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Not paired',
  connecting: 'Connecting…',
  connected: 'Connected',
  lost: 'Connection lost',
  error: 'Problem',
}

const STATUS_DOT: Record<Status, string> = {
  idle: 'bg-muted',
  connecting: 'bg-z4 animate-pulse',
  connected: 'bg-z3',
  lost: 'bg-z5',
  error: 'bg-z6',
}

function Reading({ kind }: { kind: Kind }) {
  const value = useTelemetry((s) => (kind === 'trainer' ? s.power3 : kind === 'hr' ? s.hr : s.cadence))
  return (
    <div className="mt-3 rounded-xl bg-bg px-4 py-3">
      <span className="font-display text-4xl font-semibold text-accent">{value ?? '--'}</span>
      <span className="ml-2 text-sm text-muted">{COPY[kind].unit} live</span>
    </div>
  )
}

function DeviceCard({ kind }: { kind: Kind }) {
  const slot: Slot = useDevices((s) => s.slots[kind])
  const info = useDevices((s) => s.trainerInfo)
  const { title, icon: Icon, hint, required } = COPY[kind]
  const [testing, setTesting] = useState(false)

  const testTrainer = async () => {
    const ctl = getTrainerControl()
    if (!ctl) return
    setTesting(true)
    try {
      await ctl.start()
      await ctl.setTargetPower(100)
      await new Promise((r) => setTimeout(r, 10000))
      await ctl.stop()
    } finally {
      setTesting(false)
    }
  }

  const busy = slot.status === 'connecting'
  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label={title}>
      <div className="flex items-center gap-3">
        <Icon className="size-7 text-accent-2" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {title} {required && <span className="text-xs font-normal text-muted">(required)</span>}
          </h2>
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className={`size-2.5 rounded-full ${STATUS_DOT[slot.status]}`} aria-hidden />
            {STATUS_LABEL[slot.status]}
            {slot.name && <span className="truncate text-fg">· {slot.name}</span>}
          </p>
        </div>
      </div>

      {slot.status === 'idle' && <p className="mt-2 text-sm text-muted">{hint}</p>}
      {slot.error && (
        <p className="mt-2 flex gap-2 text-sm text-z5" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {slot.error}
        </p>
      )}
      {slot.status === 'lost' && (
        <p className="mt-2 text-sm text-muted">Dropped out. Wake the device, then tap Reconnect.</p>
      )}
      {slot.status === 'connected' && <Reading kind={kind} />}
      {kind === 'trainer' && slot.status === 'connected' && info && (
        <p className="mt-2 text-xs text-muted">
          Power range {info.min}-{info.max} W · ERG {info.erg ? 'yes' : 'no'} · slope {info.sim ? 'yes' : 'no'}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {(slot.status === 'idle' || slot.status === 'error' || slot.status === 'connecting') && (
          <button className="btn-primary" disabled={busy} onClick={() => pair(kind)}>
            {busy ? 'Connecting…' : slot.status === 'error' ? 'Try again' : 'Pair'}
          </button>
        )}
        {slot.status === 'lost' && (
          <button className="btn-primary" onClick={() => reconnect(kind)}>
            <RefreshCw className="size-4" aria-hidden /> Reconnect
          </button>
        )}
        {kind === 'trainer' && slot.status === 'connected' && (
          <button className="btn-secondary" disabled={testing} onClick={testTrainer}>
            {testing ? 'Testing: 100 W for 10 s…' : 'Test resistance'}
          </button>
        )}
        {slot.status !== 'idle' && (
          <button className="btn-secondary" onClick={() => forget(kind)}>
            <Trash2 className="size-4" aria-hidden /> Forget
          </button>
        )}
      </div>
    </section>
  )
}

export function DevicesPage() {
  const mock = useDevices((s) => s.slots.trainer.mock)
  const supported = bluetoothSupported()
  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="font-display text-3xl font-semibold">Devices</h1>
        <p className="text-sm text-muted">Pair your trainer, then optional heart rate and cadence.</p>
      </header>

      {!supported && (
        <div className="rounded-2xl border border-z5 bg-surface p-4 text-sm" role="alert">
          <b className="text-z5">This browser can't use Bluetooth.</b> Open the app in Chrome on Android (or Chrome /
          Edge on a computer). iPhone browsers don't support Web Bluetooth. You can still try everything with the demo
          devices below.
        </div>
      )}

      <details className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted" open={!mock}>
        <summary className="cursor-pointer font-semibold text-fg">Pairing checklist</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Switch Bluetooth on (Android also needs Location on).</li>
          <li>Close Zwift or any other app connected to the trainer: it only talks to one at a time.</li>
          <li>Pedal a few turns to wake the trainer.</li>
          <li>Tap Pair and choose your device from the list.</li>
        </ol>
      </details>

      <DeviceCard kind="trainer" />
      <DeviceCard kind="hr" />
      <DeviceCard kind="cadence" />

      <section className="rounded-2xl border border-dashed border-border p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <TestTube2 className="size-5 text-accent-2" aria-hidden /> Demo devices
        </h2>
        <p className="mt-1 text-sm text-muted">
          Simulated trainer, heart rate and cadence. Good for trying workouts without hardware.
        </p>
        <button className="btn-secondary mt-3" onClick={() => (mock ? stopMockDevices() : startMockDevices())}>
          {mock ? 'Stop demo devices' : 'Use demo devices'}
        </button>
      </section>
    </div>
  )
}
