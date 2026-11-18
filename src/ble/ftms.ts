// Bluetooth SIG GATT parsing/encoding for FTMS (smart trainers), Heart Rate and CSC (cadence) services.
// Pure functions only: no Web Bluetooth calls here, so everything is unit-testable.

export const UUID = {
  FTMS: 0x1826,
  INDOOR_BIKE_DATA: 0x2ad2,
  CONTROL_POINT: 0x2ad9,
  FEATURE: 0x2acc,
  POWER_RANGE: 0x2ad8,
  HR: 0x180d,
  HR_MEASUREMENT: 0x2a37,
  CSC: 0x1816,
  CSC_MEASUREMENT: 0x2a5b,
} as const

export interface BikeData {
  speed?: number // km/h
  cadence?: number // rpm
  power?: number // watts
  hr?: number // bpm
}

/** Indoor Bike Data (0x2AD2). Field presence is driven by a 16-bit flags word. */
export function parseIndoorBikeData(dv: DataView): BikeData {
  const flags = dv.getUint16(0, true)
  let o = 2
  const out: BikeData = {}
  // bit 0 is "More Data": when CLEAR, instantaneous speed is present
  if (!(flags & 0x0001)) {
    out.speed = dv.getUint16(o, true) * 0.01
    o += 2
  }
  if (flags & 0x0002) o += 2 // average speed
  if (flags & 0x0004) {
    out.cadence = dv.getUint16(o, true) / 2
    o += 2
  }
  if (flags & 0x0008) o += 2 // average cadence
  if (flags & 0x0010) o += 3 // total distance (uint24)
  if (flags & 0x0020) o += 2 // resistance level
  if (flags & 0x0040) {
    out.power = dv.getInt16(o, true)
    o += 2
  }
  if (flags & 0x0080) o += 2 // average power
  if (flags & 0x0100) o += 5 // expended energy (total, per hour, per minute)
  if (flags & 0x0200) {
    out.hr = dv.getUint8(o)
    o += 1
  }
  return out
}

/** Fitness Machine Feature (0x2ACC): which control targets the trainer supports. */
export function parseFeature(dv: DataView): { erg: boolean; sim: boolean } {
  const targets = dv.getUint32(4, true)
  return { erg: !!(targets & (1 << 3)), sim: !!(targets & (1 << 13)) }
}

/** Supported Power Range (0x2AD8), watts. */
export function parsePowerRange(dv: DataView): { min: number; max: number } {
  return { min: dv.getInt16(0, true), max: dv.getInt16(2, true) }
}

// --- Control Point commands (0x2AD9) ---

export const OP = {
  REQUEST_CONTROL: 0x00,
  SET_TARGET_POWER: 0x05,
  START: 0x07,
  STOP: 0x08,
  SET_SIMULATION: 0x11,
  RESPONSE: 0x80,
} as const

export const cmd = {
  requestControl: () => Uint8Array.of(OP.REQUEST_CONTROL),
  start: () => Uint8Array.of(OP.START),
  /** 0x01 = stop, 0x02 = pause */
  stop: (pause = false) => Uint8Array.of(OP.STOP, pause ? 0x02 : 0x01),
  targetPower(watts: number): Uint8Array {
    const dv = new DataView(new ArrayBuffer(3))
    dv.setUint8(0, OP.SET_TARGET_POWER)
    dv.setInt16(1, Math.round(watts), true)
    return new Uint8Array(dv.buffer)
  },
  /** grade in percent, e.g. 4.5. crr/cw defaults are the FTMS-recommended values. */
  simulation(gradePct: number, crr = 0.004, cw = 0.51, wind = 0): Uint8Array {
    const dv = new DataView(new ArrayBuffer(7))
    dv.setUint8(0, OP.SET_SIMULATION)
    dv.setInt16(1, Math.round(wind * 1000), true)
    dv.setInt16(3, Math.round(gradePct * 100), true)
    dv.setUint8(5, Math.round(crr * 10000))
    dv.setUint8(6, Math.round(cw * 100))
    return new Uint8Array(dv.buffer)
  },
}

/** Control point indication: [0x80, requestOp, resultCode]. 0x01 = success. */
export function parseControlResponse(dv: DataView): { op: number; ok: boolean; code: number } | null {
  if (dv.byteLength < 3 || dv.getUint8(0) !== OP.RESPONSE) return null
  const code = dv.getUint8(2)
  return { op: dv.getUint8(1), ok: code === 0x01, code }
}

// --- Heart Rate (0x2A37) ---

export function parseHeartRate(dv: DataView): number {
  const is16 = dv.getUint8(0) & 0x01
  return is16 ? dv.getUint16(1, true) : dv.getUint8(1)
}

// --- Cadence Speed Cadence (0x2A5B) ---

/**
 * Returns a stateful parser: cadence in rpm from crank revolution deltas.
 * Returns undefined when there is not yet enough data; 0 after 3 repeats with no new crank event (stopped).
 */
export function createCadenceParser(): (dv: DataView) => number | undefined {
  let prev: { rev: number; time: number } | null = null
  let stale = 0
  return (dv) => {
    const flags = dv.getUint8(0)
    if (!(flags & 0x02)) return undefined // no crank data in this packet
    const o = 1 + (flags & 0x01 ? 6 : 0)
    const rev = dv.getUint16(o, true)
    const time = dv.getUint16(o + 2, true) // 1/1024 s
    if (!prev) {
      prev = { rev, time }
      return undefined
    }
    const dRev = (rev - prev.rev + 0x10000) & 0xffff
    const dTime = (time - prev.time + 0x10000) & 0xffff
    if (dTime === 0) {
      stale += 1
      return stale >= 3 ? 0 : undefined
    }
    stale = 0
    prev = { rev, time }
    return Math.round((dRev / (dTime / 1024)) * 60)
  }
}
