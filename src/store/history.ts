import Dexie, { type EntityTable } from 'dexie'
import { create } from 'zustand'
import type { RideRecord } from '../lib/record'

const db = new Dexie('wattlab') as Dexie & { rides: EntityTable<RideRecord, 'id'> }
db.version(1).stores({ rides: '++id, startedAt' })

interface History {
  rides: RideRecord[]
  loaded: boolean
  load: () => Promise<void>
  add: (r: RideRecord) => Promise<void>
  remove: (id: number) => Promise<void>
}

export const useHistory = create<History>((set, get) => ({
  rides: [],
  loaded: false,
  load: async () => {
    try {
      set({ rides: await db.rides.orderBy('startedAt').reverse().toArray(), loaded: true })
    } catch (e) {
      console.warn('history load failed', e)
      set({ loaded: true })
    }
  },
  add: async (r) => {
    try {
      await db.rides.add(r)
      await get().load()
    } catch (e) {
      console.warn('history save failed', e)
    }
  },
  remove: async (id) => {
    try {
      await db.rides.delete(id)
      await get().load()
    } catch (e) {
      console.warn('history delete failed', e)
    }
  },
}))
