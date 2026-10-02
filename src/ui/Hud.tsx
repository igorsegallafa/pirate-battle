import type { CSSProperties } from 'react'
import type { GameSession, HudState } from '../game/session'
import { useStore } from '../storage'
import { uiImage } from '../game/assets'
import { MuteButton, RoundButton } from './components'
import { formatClock } from './format'

const PHASE_ANNOUNCEMENT: Record<HudState['phase'], string> = {
  running: 'Battle in progress',
  paused: 'Battle paused',
  ended: 'Battle over',
}

function healthColor(ratio: number): string {
  if (ratio > 0.5) return 'green'
  return ratio > 0.25 ? 'amber' : 'red'
}

export function Hud({ session }: { session: GameSession }) {
  const { phase, score, secondsLeft, health, maxHealth } = useStore(session.hud)
  const healthRatio = health / maxHealth
  const fillStyle = {
    '--ratio': healthRatio,
    backgroundImage: `url(${uiImage(`health_fill_${healthColor(healthRatio)}`)})`,
  } as CSSProperties

  return (
    <div className="hud">
      <img className="hud-heart" src={uiImage('icon_heart')} alt="" />
      <div className="health" role="img" aria-label={`Health ${health} of ${maxHealth}`}>
        <div className="health-fill" style={fillStyle} />
        <span>
          {health} / {maxHealth}
        </span>
      </div>

      <div className="counter">
        <img src={uiImage('icon_score')} alt="" />
        <output aria-label="Score">{score}</output>
      </div>
      <div className="counter">
        <img src={uiImage('icon_time')} alt="" />
        <span role="timer" aria-label="Time left">
          {formatClock(secondsLeft)}
        </span>
      </div>
      <MuteButton />
      <RoundButton icon="pause" label="Pause (P)" onClick={session.pause} />

      <p className="sr-only" role="status">
        {PHASE_ANNOUNCEMENT[phase]}
      </p>
    </div>
  )
}
