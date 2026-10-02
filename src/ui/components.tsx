import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { uiImage } from '../game/assets'
import { mutedStore, playSound } from '../game/audio'
import { useStore } from '../storage'

export type Icon =
  | 'pause'
  | 'minus'
  | 'plus'
  | 'forward'
  | 'turn_left'
  | 'turn_right'
  | 'fire_front'
  | 'fire_left'
  | 'fire_right'

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function MenuButton({ variant = 'primary', onClick, ...props }: MenuButtonProps) {
  return (
    <button
      type="button"
      className={`menu-button ${variant}`}
      onClick={(event) => {
        playSound('ui_click')
        onClick?.(event)
      }}
      {...props}
    />
  )
}

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon?: Icon
  children?: ReactNode
}

export function RoundButton({ label, icon, children, ...props }: RoundButtonProps) {
  return (
    <button type="button" className="round-button" aria-label={label} title={label} {...props}>
      {icon && <img src={uiImage(`icon_${icon}`)} alt="" draggable={false} />}
      {children}
    </button>
  )
}

export function MuteButton() {
  const muted = useStore(mutedStore)
  return (
    <RoundButton label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted} onClick={() => mutedStore.set(!muted)}>
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </RoundButton>
  )
}
