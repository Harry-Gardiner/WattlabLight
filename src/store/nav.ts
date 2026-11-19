import { create } from 'zustand'

export type Tab = 'devices' | 'workouts' | 'ride' | 'history' | 'settings'

export const useNav = create<{ tab: Tab; go: (t: Tab) => void }>((set) => ({
  tab: 'devices',
  go: (tab) => set({ tab }),
}))
