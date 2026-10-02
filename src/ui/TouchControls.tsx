import type { PointerEvent } from 'react'
import type { GameSession } from '../game/session'
import type { Action } from '../game/simulation'
import { RoundButton, type Icon } from './components'

interface Control {
  action: Action
  icon: Icon
  label: string
  key: string
}

const MOVEMENT: Control[] = [
  { action: 'turnLeft', icon: 'turn_left', label: 'Turn left', key: 'A' },
  { action: 'forward', icon: 'forward', label: 'Sail forward', key: 'W' },
  { action: 'turnRight', icon: 'turn_right', label: 'Turn right', key: 'D' },
]

const ATTACKS: Control[] = [
  { action: 'fireLeft', icon: 'fire_left', label: 'Fire left broadside', key: 'Q' },
  { action: 'fireFront', icon: 'fire_front', label: 'Fire front cannon', key: 'Space' },
  { action: 'fireRight', icon: 'fire_right', label: 'Fire right broadside', key: 'E' },
]

export function TouchControls({ session }: { session: GameSession }) {
  const renderControl = ({ action, icon, label, key }: Control) => {
    const press = (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      session.setAction(action, true)
    }
    const release = () => session.setAction(action, false)

    return (
      <RoundButton
        key={action}
        icon={icon}
        label={`${label} (${key})`}
        tabIndex={-1}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <kbd>{key}</kbd>
      </RoundButton>
    )
  }

  return (
    <>
      <div className="controls controls-left">{MOVEMENT.map(renderControl)}</div>
      <div className="controls controls-right">{ATTACKS.map(renderControl)}</div>
    </>
  )
}
