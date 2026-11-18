import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Profile {
  id: string
  name: string
  ftp: number
}

interface Settings {
  profiles: Profile[]
  activeId: string
  sound: boolean
  setActive: (id: string) => void
  updateProfile: (id: string, patch: Partial<Omit<Profile, 'id'>>) => void
  addProfile: (name: string) => void
  removeProfile: (id: string) => void
  setSound: (on: boolean) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      profiles: [{ id: 'p1', name: 'Rider 1', ftp: 150 }],
      activeId: 'p1',
      sound: true,
      setActive: (activeId) => set({ activeId }),
      updateProfile: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      addProfile: (name) =>
        set((s) => {
          const id = `p${Date.now()}`
          return { profiles: [...s.profiles, { id, name, ftp: 150 }], activeId: id }
        }),
      removeProfile: (id) =>
        set((s) => {
          if (s.profiles.length < 2) return s
          const profiles = s.profiles.filter((p) => p.id !== id)
          return { profiles, activeId: s.activeId === id ? profiles[0].id : s.activeId }
        }),
      setSound: (sound) => set({ sound }),
    }),
    { name: 'wattlab-settings' },
  ),
)

export const useActiveProfile = () =>
  useSettings((s) => s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0])
