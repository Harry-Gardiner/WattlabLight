import { useEffect, useState } from 'react'
import { Minus, Pause, Play, Plus, SkipForward, Square } from 'lucide-react'
import { useDevices } from '../ble/devices'
import { useWakeLock } from '../lib/useWakeLock'
import { useNav } from '../store/nav'
import { useRide } from '../store/ride'
import { useActiveProfile } from '../store/settings'
import { useTelemetry } from '../store/telemetry'
import { fmtTime, locate, rideStats, toWatts, totalSec, zoneColor } from '../workout/engine'
import { PowerGauge } from './PowerGauge'
import { ProfileChart } from './ProfileChart'

function Tile({ label, value, unit }: { label: string; value: number | string | null; unit: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-5xl font-semibold leading-none">{value ?? '--'}</div>
      <div className="text-xs text-muted">{unit}</div>
    </div>
  )
}

// ---------- Ready ----------

function ReadyView() {
  const { workout, scale, setScale, freeMode, setFreeMode, freeTarget, grade, setGrade, nudge, start } = useRide()
  const profile = useActiveProfile()
  const trainer = useDevices((s) => s.slots.trainer.status)
  const go = useNav((s) => s.go)
  const connected = trainer === 'connected'

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="font-display text-3xl font-semibold">{workout ? workout.name : 'Free ride'}</h1>
        <p className="text-sm text-muted">
          {workout
            ? `${Math.round(totalSec(workout) / 60)} min · ${profile.name} · FTP ${profile.ftp} W`
            : `${profile.name} · you choose the effort`}
        </p>
      </header>

      {workout && <ProfileChart workout={workout} height={80} scale={scale} className="rounded-xl" />}

      {workout ? (
        <label className="block rounded-2xl border border-border bg-surface p-4">
          <span className="flex justify-between text-sm">
            <span>Intensity</span>
            <b>{Math.round(scale * 100)}% of plan</b>
          </span>
          <input
            type="range"
            min={0.7}
            max={1.2}
            step={0.05}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
            aria-label="Workout intensity"
          />
          <span className="text-xs text-muted">Too hard or too easy? Scale every step up or down before you start.</span>
        </label>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-2" role="group" aria-label="Free ride mode">
            {(['erg', 'sim'] as const).map((m) => (
              <button
                key={m}
                aria-pressed={freeMode === m}
                onClick={() => setFreeMode(m)}
                className={`min-h-11 flex-1 rounded-xl border text-sm font-medium ${
                  freeMode === m ? 'border-accent bg-accent text-bg' : 'border-border'
                }`}
              >
                {m === 'erg' ? 'ERG (fixed watts)' : 'Slope (hills)'}
              </button>
            ))}
          </div>
          {freeMode === 'erg' ? (
            <div className="space-y-2">
              <div className="text-center font-display text-6xl font-semibold">
                {freeTarget}
                <span className="text-xl text-muted"> W</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[-50, -10, 10, 50].map((d) => (
                  <button
                    key={d}
                    className="btn-secondary min-h-16 text-xl"
                    onClick={() => nudge(d)}
                    aria-label={`${Math.abs(d)} watts ${d < 0 ? 'lower' : 'higher'}`}
                  >
                    {d > 0 ? '+' : '−'}
                    {Math.abs(d)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <GradeSlider grade={grade} onChange={setGrade} />
          )}
        </div>
      )}

      {!connected && (
        <div className="rounded-2xl border border-z5 bg-surface p-4 text-sm" role="alert">
          No trainer connected.{' '}
          <button className="font-semibold text-accent underline" onClick={() => go('devices')}>
            Pair a trainer or use demo devices
          </button>
        </div>
      )}

      <button className="btn-primary w-full text-lg" disabled={!connected} onClick={() => void start()}>
        <Play className="size-6" aria-hidden /> Start
      </button>
      <p className="text-center text-xs text-muted">Starts when you tap. Begin pedalling gently.</p>
    </div>
  )
}

function GradeSlider({ grade, onChange }: { grade: number; onChange: (g: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span>Gradient</span>
        <b>{grade.toFixed(1)} %</b>
      </span>
      <input
        type="range"
        min={-10}
        max={20}
        step={0.5}
        value={grade}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-accent"
        aria-label="Gradient percent"
      />
    </label>
  )
}

// ---------- Running ----------

function RunningView() {
  const r = useRide()
  const tel = useTelemetry()
  const { workout, elapsed, target, status, ftp } = r
  useWakeLock(status === 'running')
  const [confirmEnd, setConfirmEnd] = useState(false)
  useEffect(() => {
    if (!confirmEnd) return
    const id = setTimeout(() => setConfirmEnd(false), 3000)
    return () => clearTimeout(id)
  }, [confirmEnd])

  const loc = workout ? locate(workout, elapsed) : null
  const next = workout && loc ? workout.steps[loc.index + 1] : null
  const left = loc ? loc.end - elapsed : 0
  const warn = !!next && left <= 10
  const goingUp = !!next && !!loc && next.from > loc.step.to
  const power = tel.power3
  const pct = power != null ? (power / ftp) * 100 : 0
  // full-arc watts: fixed per workout (rounded up to 50) so the gauge doesn't rescale mid-ride
  const peak = workout
    ? (Math.max(...workout.steps.flatMap((s) => [s.from, s.to])) / 100) * ftp * r.scale
    : (target ?? 0)
  const gaugeMax = Math.ceil(Math.max(ftp * 1.5, peak * 1.15) / 50) * 50

  const warning = useDevices((s) => s.trainerWarning)
  const info = useDevices((s) => s.trainerInfo)
  // 10 s in a row well under target while pedalling: trainer isn't delivering what we asked for
  const recent = r.samples.slice(-10)
  const unreachable =
    !warning &&
    target != null &&
    target > 0 &&
    (tel.cadence ?? 0) > 40 &&
    recent.length >= 10 &&
    recent.every((s) => (s.power ?? 0) < 0.8 * (s.target ?? 0))
  const notices: string[] = []
  if (warning) notices.push(`${warning}. It keeps the last target it accepted.`)
  if (r.cappedFrom != null && info)
    notices.push(`Capped: you asked for ${r.cappedFrom} W but this trainer reports a ${info.max} W maximum.`)
  if (unreachable)
    notices.push('Trainer is not reaching the target. Try a harder gear and 80-90 rpm, or the target is above what it can deliver.')

  let cue: { text: string; color: string } | null = null
  if (target != null && power != null && target > 0) {
    const d = (power - target) / target
    if (d < -0.07) cue = { text: 'Push a little harder', color: 'var(--color-z4)' }
    else if (d > 0.07) cue = { text: 'Ease off a little', color: 'var(--color-z5)' }
    else cue = { text: 'On target', color: 'var(--color-z3)' }
  }

  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between px-1">
        <span className="font-display text-4xl font-semibold">{fmtTime(elapsed)}</span>
        <span className="text-sm text-muted">
          {workout && loc ? `${loc.step.label} · step ${loc.index + 1}/${workout.steps.length}` : 'Free ride'}
          {status === 'paused' && <b className="ml-2 text-z4">PAUSED</b>}
        </span>
      </div>

      {notices.length > 0 && (
        <div className="space-y-1 rounded-2xl border border-z5 bg-surface p-3 text-sm" role="alert">
          {notices.map((n) => (
            <p key={n} className="text-z5">
              {n}
            </p>
          ))}
        </div>
      )}

      <div className="rounded-3xl bg-surface p-4">
        <PowerGauge
          power={power}
          target={target}
          max={gaugeMax}
          ftp={ftp}
          footer={
            <div className="flex flex-col items-center text-base leading-tight">
              {target != null && (
                <span>
                  target <b>{target} W</b>
                </span>
              )}
              {cue && (
                <span className="text-sm font-medium" style={{ color: cue.color }}>
                  {cue.text}
                </span>
              )}
            </div>
          }
        >
          <div className="font-display text-7xl font-bold leading-none" style={{ color: zoneColor(pct) }}>
            {power ?? '--'}
          </div>
          <div className="text-lg text-muted">watts</div>
        </PowerGauge>
        {info && (
          <p className="mt-1 text-center text-xs text-muted">
            Trainer range {info.min}-{info.max} W
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Cadence" value={tel.cadence} unit="rpm" />
        <Tile label="Heart rate" value={tel.hr} unit="bpm" />
        <Tile label={workout ? 'Step left' : 'Speed'} value={workout ? fmtTime(left) : tel.speed} unit={workout ? 'm:ss' : 'km/h'} />
      </div>

      {workout && (
        <div className="rounded-2xl bg-surface p-3">
          <ProfileChart workout={workout} height={90} cursor={elapsed} samples={r.samples} ftp={ftp} scale={r.scale} className="rounded" />
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-center font-semibold ${warn ? 'animate-pulse' : ''}`}
            style={{
              background: warn ? (goingUp ? 'var(--color-z5)' : 'var(--color-z2)') : 'var(--color-bg)',
              color: warn ? '#0b0f14' : 'var(--color-fg)',
            }}
            role="status"
          >
            {next ? (
              <>
                {warn ? (goingUp ? '▲ Push: ' : '▼ Ease: ') : 'Next: '}
                {next.label} {fmtTime(next.sec)} @{' '}
                {next.from === next.to
                  ? `${Math.round(toWatts(next.from * r.scale, ftp))} W`
                  : `${toWatts(next.from * r.scale, ftp)}→${toWatts(next.to * r.scale, ftp)} W`}{' '}
                in {fmtTime(left)}
              </>
            ) : (
              <>Last block: finish strong ({fmtTime(left)} to go)</>
            )}
          </div>
        </div>
      )}

      {!workout && r.freeMode === 'sim' && (
        <div className="rounded-2xl bg-surface p-4">
          <GradeSlider grade={r.grade} onChange={r.setGrade} />
        </div>
      )}

      {(r.freeMode === 'erg' || workout) && (
        <div className="mt-auto space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-secondary min-h-20 gap-1 text-3xl"
              onClick={() => r.nudge(-5)}
              aria-label="5 watts lower"
            >
              <Minus className="size-9" aria-hidden /> 5
            </button>
            <button
              className="btn-secondary min-h-20 gap-1 text-3xl"
              onClick={() => r.nudge(5)}
              aria-label="5 watts higher"
            >
              <Plus className="size-9" aria-hidden /> 5
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[-50, -10, 10, 50].map((d) => (
              <button
                key={d}
                className="btn-secondary min-h-16 text-xl"
                onClick={() => r.nudge(d)}
                aria-label={`${Math.abs(d)} watts ${d < 0 ? 'lower' : 'higher'}`}
              >
                {d > 0 ? '+' : '−'}
                {Math.abs(d)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`grid gap-2 ${workout ? 'grid-cols-3' : 'grid-cols-2'} ${r.freeMode === 'sim' && !workout ? 'mt-auto' : ''}`}>
        {status === 'running' ? (
          <button className="btn-secondary justify-center" onClick={r.pause} aria-label="Pause">
            <Pause className="size-5" />
          </button>
        ) : (
          <button className="btn-primary justify-center" onClick={r.resume} aria-label="Resume">
            <Play className="size-5" />
          </button>
        )}
        {workout && (
          <button className="btn-secondary justify-center" onClick={r.skip} aria-label="Skip to next step">
            <SkipForward className="size-5" />
          </button>
        )}
        <button
          className="btn-danger justify-center"
          onClick={() => (confirmEnd ? r.end() : setConfirmEnd(true))}
          aria-label={confirmEnd ? 'Tap again to end ride' : 'End ride'}
        >
          {confirmEnd ? 'Tap again to end' : <Square className="size-5" />}
        </button>
      </div>
    </div>
  )
}

// ---------- Done ----------

function DoneView() {
  const { samples, ftp, workout, reset } = useRide()
  const go = useNav((s) => s.go)
  const st = rideStats(samples, ftp)
  const items: [string, string | number, string][] = [
    ['Time', fmtTime(samples.length), ''],
    ['Avg power', st.avgPower, 'W'],
    ['Max power', st.maxPower, 'W'],
    ['Normalized', st.np, 'W'],
    ['TSS', st.tss, ''],
    ['Intensity', st.intensity.toFixed(2), 'IF'],
    ['Avg HR', st.avgHr ?? '--', 'bpm'],
    ['Avg cadence', st.avgCadence ?? '--', 'rpm'],
  ]
  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="font-display text-3xl font-semibold">Ride complete</h1>
        <p className="text-sm text-muted">
          {workout ? workout.name : 'Free ride'}. Nice work.{samples.length >= 30 && ' Saved to History.'}
        </p>
      </header>
      {workout && <ProfileChart workout={workout} height={90} samples={samples} ftp={ftp} className="rounded-xl" />}
      <div className="grid grid-cols-2 gap-2">
        {items.map(([label, value, unit]) => (
          <Tile key={label} label={label} value={value} unit={unit} />
        ))}
      </div>
      <button
        className="btn-primary w-full"
        onClick={() => {
          reset()
          go('workouts')
        }}
      >
        Done
      </button>
    </div>
  )
}

export function RidePage() {
  const status = useRide((s) => s.status)
  if (status === 'idle') return <ReadyView />
  if (status === 'done') return <DoneView />
  return <RunningView />
}
