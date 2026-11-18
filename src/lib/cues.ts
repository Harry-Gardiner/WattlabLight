import { useSettings } from '../store/settings'

let ctx: AudioContext | null = null

/** Call from inside a user tap so the browser lets us play sound later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio, no problem */
  }
}

const tones = { up: 880, down: 440, done: 660 } as const

export function beep(kind: keyof typeof tones) {
  if (!ctx || !useSettings.getState().sound) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = tones[kind]
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.2)
}

export function vibrate(pattern: number | number[]) {
  if (useSettings.getState().sound) navigator.vibrate?.(pattern)
}
