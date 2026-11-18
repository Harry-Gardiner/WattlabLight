import { describe, expect, it } from 'vitest'
import {
  cmd,
  createCadenceParser,
  parseControlResponse,
  parseFeature,
  parseHeartRate,
  parseIndoorBikeData,
  parsePowerRange,
} from './ftms'

const view = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer)

describe('parseIndoorBikeData', () => {
  it('reads speed, cadence and power', () => {
    // flags 0x0044: cadence + power present, speed present (bit0 clear)
    const dv = view(0x44, 0x00, 0xb8, 0x0b, 0xb4, 0x00, 0xc8, 0x00)
    expect(parseIndoorBikeData(dv)).toEqual({ speed: 30, cadence: 90, power: 200 })
  })

  it('skips optional fields between cadence and power', () => {
    // flags 0x0064: cadence, resistance level, power
    const dv = view(0x64, 0x00, 0x10, 0x27, 0xb4, 0x00, 0x05, 0x00, 0x2c, 0x01)
    expect(parseIndoorBikeData(dv)).toMatchObject({ cadence: 90, power: 300 })
  })

  it('reads heart rate when present', () => {
    // flags 0x0241: more-data set (no speed), power + HR
    const dv = view(0x41, 0x02, 0x96, 0x00, 0x8c)
    expect(parseIndoorBikeData(dv)).toEqual({ power: 150, hr: 140 })
  })
})

describe('trainer capabilities', () => {
  it('decodes target-setting feature bits', () => {
    // target bits: power (bit 3) + simulation (bit 13)
    const targets = (1 << 3) | (1 << 13)
    const dv = new DataView(new ArrayBuffer(8))
    dv.setUint32(4, targets, true)
    expect(parseFeature(dv)).toEqual({ erg: true, sim: true })
  })

  it('decodes power range', () => {
    expect(parsePowerRange(view(0x00, 0x00, 0x58, 0x02, 0x01, 0x00))).toEqual({ min: 0, max: 600 })
  })
})

describe('control point commands', () => {
  it('encodes target power little-endian', () => {
    expect(Array.from(cmd.targetPower(250))).toEqual([0x05, 0xfa, 0x00])
  })

  it('encodes simulation grade as 0.01% units, signed', () => {
    const bytes = cmd.simulation(-2.5)
    const dv = new DataView(bytes.buffer)
    expect(bytes[0]).toBe(0x11)
    expect(dv.getInt16(3, true)).toBe(-250)
    expect(bytes[5]).toBe(40) // crr 0.004
    expect(bytes[6]).toBe(51) // cw 0.51
  })

  it('parses responses', () => {
    expect(parseControlResponse(view(0x80, 0x05, 0x01))).toEqual({ op: 5, ok: true, code: 1 })
    expect(parseControlResponse(view(0x80, 0x05, 0x04))?.ok).toBe(false)
    expect(parseControlResponse(view(0x12, 0x00, 0x00))).toBeNull()
  })
})

describe('heart rate', () => {
  it('reads 8-bit and 16-bit formats', () => {
    expect(parseHeartRate(view(0x00, 142))).toBe(142)
    expect(parseHeartRate(view(0x01, 0x2c, 0x01))).toBe(300)
  })
})

describe('cadence parser', () => {
  const pkt = (rev: number, time: number) => view(0x02, rev & 0xff, rev >> 8, time & 0xff, time >> 8)

  it('computes rpm from crank deltas', () => {
    const parse = createCadenceParser()
    expect(parse(pkt(10, 0))).toBeUndefined()
    // 2 revs in 1.5 s = 80 rpm
    expect(parse(pkt(12, 1536))).toBe(80)
  })

  it('handles 16-bit rollover', () => {
    const parse = createCadenceParser()
    parse(pkt(65535, 65000))
    // +1 rev, time wraps: 65000 -> 536 = 1072 ticks
    expect(parse(pkt(0, 536))).toBe(Math.round((1 / (1072 / 1024)) * 60))
  })

  it('reports 0 after repeated packets with no new crank event', () => {
    const parse = createCadenceParser()
    parse(pkt(5, 100))
    expect(parse(pkt(5, 100))).toBeUndefined()
    expect(parse(pkt(5, 100))).toBeUndefined()
    expect(parse(pkt(5, 100))).toBe(0)
  })
})
