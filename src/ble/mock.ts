// Simulated trainer + HR strap + cadence sensor. Lets you try the whole app (and run e2e tests) with no hardware.
import { useTelemetry } from '../store/telemetry'
import { setTrainerControl, useDevices } from './devices'

let timer: ReturnType<typeof setInterval> | null = null

export function startMockDevices() {
  stopMockDevices()
  const dev = useDevices.getState()
  const tel = useTelemetry.getState()

  let target: number | null = null // ERG target
  let grade = 0
  let running = false
  let power = 0
  let hr = 78

  // ?mockMax=150 makes the demo trainer behave like one that refuses targets above 150 W
  const mockMax = Number(new URLSearchParams(location.search).get('mockMax')) || Infinity

  setTrainerControl({
    setTargetPower: async (w) => {
      const ok = w <= mockMax
      dev.addLog({
        label: `Set power ${w} W`,
        bytes: '05',
        ok,
        detail: ok ? 'accepted' : 'invalid parameter (outside what the trainer accepts)',
      })
      if (ok) {
        target = w
        dev.setWarning(null)
      } else {
        dev.setWarning(`Trainer refused ${w} W: invalid parameter (outside what the trainer accepts)`)
        throw new Error('refused')
      }
    },
    setGrade: async (g) => void ((grade = g), (target = null)),
    start: async () => void (running = true),
    stop: async () => void ((running = false), (target = null)),
  })

  const slot = { status: 'connected' as const, error: null, mock: true }
  dev.patch('trainer', { ...slot, name: 'Mock trainer' })
  dev.patch('hr', { ...slot, name: 'Mock HR strap' })
  dev.patch('cadence', { ...slot, name: 'Mock cadence sensor' })
  dev.setInfo({ min: 0, max: 600, erg: true, sim: true })

  timer = setInterval(() => {
    // pedalling only while a ride is running; otherwise coasting at idle
    const desired = !running ? 0 : target != null ? target : 120 + grade * 12
    power += (desired - power) * 0.35 // trainers take a second or two to settle
    const noisy = !running && power < 1 ? 0 : Math.max(0, Math.round(power + (Math.random() - 0.5) * 8))
    const cadence = running ? Math.round(88 + (Math.random() - 0.5) * 6) : 0
    hr += ((running ? 95 + power * 0.28 : 78) - hr) * 0.02
    tel.setPower(noisy)
    tel.setCadence(cadence)
    tel.setHr(Math.round(hr))
    tel.setSpeed(running ? Math.round((12 + power * 0.07) * 10) / 10 : 0)
  }, 250)
}

export function stopMockDevices() {
  if (timer) clearInterval(timer)
  timer = null
  setTrainerControl(null)
  const dev = useDevices.getState()
  for (const k of ['trainer', 'hr', 'cadence'] as const) {
    if (dev.slots[k].mock) dev.patch(k, { status: 'idle', name: null, error: null, mock: false })
  }
  dev.setInfo(null)
  useTelemetry.getState().clear(['power', 'cadence', 'hr', 'speed'])
}
