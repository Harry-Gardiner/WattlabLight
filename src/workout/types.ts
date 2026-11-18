export type StepKind = 'warmup' | 'work' | 'rest' | 'cooldown' | 'sprint'
export type Category = 'Recovery' | 'Endurance' | 'Threshold' | 'Intervals'

/** One block of a workout. Power is % of FTP, linearly ramped from `from` to `to`. */
export interface Step {
  sec: number
  from: number
  to: number
  kind: StepKind
  label: string
}

export interface Workout {
  id: string
  name: string
  category: Category
  description: string
  steps: Step[]
}
