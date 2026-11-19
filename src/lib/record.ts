import { type RideStats, type Sample, rideStats } from '../workout/engine'

/** Rides shorter than this are not worth keeping (accidental starts). */
export const MIN_SAVE_SEC = 30

export interface RideRecord {
  id?: number
  startedAt: number // epoch ms
  name: string
  workoutId: string | null
  rider: string
  ftp: number
  durationSec: number
  stats: RideStats
  samples: Sample[]
}

interface Input {
  startedAt: number
  name: string
  workoutId: string | null
  rider: string
  ftp: number
  samples: Sample[]
}

/** Build a storable record, or null if the ride was too short to keep. */
export function buildRecord(i: Input): RideRecord | null {
  if (i.samples.length < MIN_SAVE_SEC) return null
  return {
    startedAt: i.startedAt,
    name: i.name,
    workoutId: i.workoutId,
    rider: i.rider,
    ftp: i.ftp,
    durationSec: i.samples.length,
    stats: rideStats(i.samples, i.ftp),
    samples: i.samples,
  }
}

export interface Totals {
  rides: number
  seconds: number
  tss: number
}

export function totals(rs: Pick<RideRecord, 'durationSec' | 'stats'>[]): Totals {
  return rs.reduce(
    (a, r) => ({ rides: a.rides + 1, seconds: a.seconds + r.durationSec, tss: a.tss + r.stats.tss }),
    { rides: 0, seconds: 0, tss: 0 },
  )
}
