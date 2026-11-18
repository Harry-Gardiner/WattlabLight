import { create } from 'zustand'
import { useTelemetry } from '../store/telemetry'
import {
  UUID,
  cmd,
  createCadenceParser,
  parseControlResponse,
  parseFeature,
  parseHeartRate,
  parseIndoorBikeData,
  parsePowerRange,
} from './ftms'
import { startMockDevices, stopMockDevices } from './mock'

export type Kind = 'trainer' | 'hr' | 'cadence'
export type Status = 'idle' | 'connecting' | 'connected' | 'lost' | 'error'

export interface Slot {
  status: Status
  name: string | null
  error: string | null
  mock: boolean
}

export interface TrainerInfo {
  min: number
  max: number
  erg: boolean
  sim: boolean
}

/** What the ride engine needs from a trainer, whether real Bluetooth or the mock. */
export interface TrainerControl {
  setTargetPower: (watts: number) => Promise<void>
  setGrade: (pct: number) => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

export class TrainerRefused extends Error {}

/** FTMS control point result codes (0x01 = success). */
export function describeResult(code: number): string {
  switch (code) {
    case 0x01:
      return 'accepted'
    case 0x02:
      return 'not supported by this trainer'
    case 0x03:
      return 'invalid parameter (outside what the trainer accepts)'
    case 0x04:
      return 'operation failed'
    case 0x05:
      return 'control not permitted (another app may be controlling it)'
    default:
      return `result code 0x${code.toString(16)}`
  }
}

const emptySlot: Slot = { status: 'idle', name: null, error: null, mock: false }

/** One trainer control-point exchange, kept for the diagnostics panel. */
export interface CmdLog {
  at: number
  label: string
  bytes: string
  ok: boolean
  detail: string
}

interface DevState {
  slots: Record<Kind, Slot>
  trainerInfo: TrainerInfo | null
  /** Set when the trainer refuses/ignores a target; cleared by the next accepted one. */
  trainerWarning: string | null
  log: CmdLog[]
  patch: (kind: Kind, p: Partial<Slot>) => void
  setInfo: (i: TrainerInfo | null) => void
  setWarning: (w: string | null) => void
  addLog: (l: Omit<CmdLog, 'at'>) => void
}

export const useDevices = create<DevState>((set) => ({
  slots: { trainer: emptySlot, hr: emptySlot, cadence: emptySlot },
  trainerInfo: null,
  trainerWarning: null,
  log: [],
  patch: (kind, p) => set((s) => ({ slots: { ...s.slots, [kind]: { ...s.slots[kind], ...p } } })),
  setInfo: (trainerInfo) => set({ trainerInfo }),
  setWarning: (trainerWarning) => set({ trainerWarning }),
  addLog: (l) => set((s) => ({ log: [{ ...l, at: Date.now() }, ...s.log].slice(0, 30) })),
}))

const patch = (kind: Kind, p: Partial<Slot>) => useDevices.getState().patch(kind, p)

let control: TrainerControl | null = null
export const getTrainerControl = () => control
export const setTrainerControl = (c: TrainerControl | null) => {
  control = c
}

interface Handle {
  device: BluetoothDevice
  cleanup: () => void
}
const handles: Partial<Record<Kind, Handle>> = {}

const telemetryKeys: Record<Kind, ('power' | 'cadence' | 'hr' | 'speed')[]> = {
  trainer: ['power', 'speed'],
  hr: ['hr'],
  cadence: ['cadence'],
}

const requestOptions: Record<Kind, RequestDeviceOptions> = {
  trainer: { filters: [{ services: [UUID.FTMS] }] },
  hr: { filters: [{ services: [UUID.HR] }] },
  cadence: { filters: [{ services: [UUID.CSC] }] },
}

export const bluetoothSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator

// --- per-kind GATT setup. Each returns a cleanup function. ---

type Setup = (server: BluetoothRemoteGATTServer) => Promise<() => void>

const setupTrainer: Setup = async (server) => {
  const svc = await server.getPrimaryService(UUID.FTMS)
  const tel = useTelemetry.getState()

  const data = await svc.getCharacteristic(UUID.INDOOR_BIKE_DATA)
  const onData = (e: Event) => {
    const d = parseIndoorBikeData((e.target as BluetoothRemoteGATTCharacteristic).value!)
    if (d.power != null) tel.setPower(d.power)
    if (d.speed != null) tel.setSpeed(d.speed)
    // a dedicated cadence sensor wins over the trainer's own value
    if (d.cadence != null && useDevices.getState().slots.cadence.status !== 'connected') tel.setCadence(d.cadence)
    if (d.hr != null && d.hr > 0 && useDevices.getState().slots.hr.status !== 'connected') tel.setHr(d.hr)
  }
  data.addEventListener('characteristicvaluechanged', onData)
  await data.startNotifications()

  // capabilities (best effort: not every trainer exposes both)
  let info: TrainerInfo = { min: 0, max: 1000, erg: true, sim: true }
  try {
    const f = parseFeature((await (await svc.getCharacteristic(UUID.FEATURE)).readValue()))
    info = { ...info, ...f }
  } catch {
    /* keep defaults */
  }
  try {
    const r = parsePowerRange(await (await svc.getCharacteristic(UUID.POWER_RANGE)).readValue())
    info = { ...info, ...r }
  } catch {
    /* keep defaults */
  }
  useDevices.getState().setInfo(info)

  // control point: writes need a matching indication before the next command
  const cp = await svc.getCharacteristic(UUID.CONTROL_POINT)
  let waiter: ((r: ReturnType<typeof parseControlResponse>) => void) | null = null
  let pendingOp = -1
  const onCp = (e: Event) => {
    const r = parseControlResponse((e.target as BluetoothRemoteGATTCharacteristic).value!)
    if (r && waiter && r.op === pendingOp) waiter(r)
  }
  cp.addEventListener('characteristicvaluechanged', onCp)
  await cp.startNotifications()

  let queue: Promise<unknown> = Promise.resolve()
  /** Writes a command and waits for the trainer's reply. Every exchange is logged for diagnostics. */
  const send = (bytes: Uint8Array, label: string) => {
    const run = async (): Promise<boolean> => {
      pendingOp = bytes[0]
      const response = new Promise<ReturnType<typeof parseControlResponse>>((resolve) => {
        waiter = resolve
        setTimeout(() => resolve(null), 2000)
      })
      await cp.writeValueWithResponse(bytes as BufferSource)
      const r = await response
      useDevices.getState().addLog({
        label,
        bytes: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '),
        ok: !!r?.ok,
        detail: r ? describeResult(r.code) : 'no reply from trainer (2 s)',
      })
      if (!r?.ok) throw new TrainerRefused(r ? describeResult(r.code) : 'no reply from trainer')
      return true
    }
    const p = queue.then(run, run)
    queue = p.catch(() => undefined)
    return p
  }

  try {
    await send(cmd.requestControl(), 'Request control')
  } catch {
    throw new Error('Trainer refused control. Close other apps (Zwift etc) and retry.')
  }

  setTrainerControl({
    setTargetPower: async (w) => {
      try {
        await send(cmd.targetPower(w), `Set power ${w} W`)
        useDevices.getState().setWarning(null)
      } catch (e) {
        if (e instanceof TrainerRefused) useDevices.getState().setWarning(`Trainer refused ${w} W: ${e.message}`)
        throw e
      }
    },
    setGrade: async (g) => void (await send(cmd.simulation(g), `Set grade ${g}%`)),
    start: async () => void (await send(cmd.start(), 'Start')),
    stop: async () => void (await send(cmd.stop(), 'Stop')),
  })

  return () => {
    data.removeEventListener('characteristicvaluechanged', onData)
    cp.removeEventListener('characteristicvaluechanged', onCp)
    setTrainerControl(null)
    useDevices.getState().setInfo(null)
    useDevices.getState().setWarning(null)
  }
}

const setupHr: Setup = async (server) => {
  const svc = await server.getPrimaryService(UUID.HR)
  const ch = await svc.getCharacteristic(UUID.HR_MEASUREMENT)
  const on = (e: Event) =>
    useTelemetry.getState().setHr(parseHeartRate((e.target as BluetoothRemoteGATTCharacteristic).value!))
  ch.addEventListener('characteristicvaluechanged', on)
  await ch.startNotifications()
  return () => ch.removeEventListener('characteristicvaluechanged', on)
}

const setupCadence: Setup = async (server) => {
  const svc = await server.getPrimaryService(UUID.CSC)
  const ch = await svc.getCharacteristic(UUID.CSC_MEASUREMENT)
  const parse = createCadenceParser()
  const on = (e: Event) => {
    const rpm = parse((e.target as BluetoothRemoteGATTCharacteristic).value!)
    if (rpm != null) useTelemetry.getState().setCadence(rpm)
  }
  ch.addEventListener('characteristicvaluechanged', on)
  await ch.startNotifications()
  return () => ch.removeEventListener('characteristicvaluechanged', on)
}

const setups: Record<Kind, Setup> = { trainer: setupTrainer, hr: setupHr, cadence: setupCadence }

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/User cancelled|cancel/i.test(msg)) return ''
  if (/No Services matching|not found/i.test(msg)) return 'That device does not expose the expected Bluetooth service.'
  if (/GATT|disconnected|NetworkError/i.test(msg)) return 'Connection failed. Wake the device (pedal / put strap on) and try again.'
  return msg
}

async function connect(kind: Kind, device: BluetoothDevice) {
  handles[kind]?.cleanup()
  patch(kind, { status: 'connecting', name: device.name ?? 'Unknown device', error: null, mock: false })
  const onLost = () => {
    handles[kind]?.cleanup()
    useTelemetry.getState().clear(telemetryKeys[kind])
    patch(kind, { status: 'lost' })
  }
  device.addEventListener('gattserverdisconnected', onLost, { once: true })
  try {
    const server = await device.gatt!.connect()
    const cleanup = await setups[kind](server)
    handles[kind] = {
      device,
      cleanup: () => {
        cleanup()
        device.removeEventListener('gattserverdisconnected', onLost)
        if (device.gatt?.connected) device.gatt.disconnect()
      },
    }
    patch(kind, { status: 'connected' })
  } catch (e) {
    device.removeEventListener('gattserverdisconnected', onLost)
    if (device.gatt?.connected) device.gatt.disconnect()
    patch(kind, { status: 'error', error: friendlyError(e) || 'Connection failed.' })
  }
}

/** Opens Chrome's device chooser. Must be called from a tap. */
export async function pair(kind: Kind) {
  if (!bluetoothSupported()) {
    patch(kind, { status: 'error', error: 'This browser has no Web Bluetooth. Use Chrome on Android or desktop.' })
    return
  }
  try {
    const device = await navigator.bluetooth.requestDevice(requestOptions[kind])
    await connect(kind, device)
  } catch (e) {
    const msg = friendlyError(e)
    patch(kind, msg ? { status: 'error', error: msg } : { status: handles[kind] ? 'connected' : 'idle' })
  }
}

export async function reconnect(kind: Kind) {
  const h = handles[kind]
  if (h) await connect(kind, h.device)
}

export function forget(kind: Kind) {
  if (useDevices.getState().slots[kind].mock) {
    stopMockDevices()
    return
  }
  handles[kind]?.cleanup()
  delete handles[kind]
  useTelemetry.getState().clear(telemetryKeys[kind])
  patch(kind, { ...emptySlot })
}

export { startMockDevices, stopMockDevices }
