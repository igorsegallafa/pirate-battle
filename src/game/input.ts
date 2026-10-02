import type { Action, InputState } from './simulation'

export const KEY_BINDINGS: Record<string, Action> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
}

const PAUSE_KEYS = ['Escape', 'KeyP']

/** Captures the game keys until the returned function is called. */
export function listenToKeyboard(input: InputState, onPause: () => void): () => void {
  const listeners = new AbortController()

  const onKey = (event: KeyboardEvent) => {
    const action = KEY_BINDINGS[event.code]
    if (action) {
      input[action] = event.type === 'keydown'
      event.preventDefault()
    } else if (event.type === 'keydown' && PAUSE_KEYS.includes(event.code)) {
      onPause()
      event.preventDefault()
    }
  }

  window.addEventListener('keydown', onKey, { signal: listeners.signal })
  window.addEventListener('keyup', onKey, { signal: listeners.signal })
  return () => listeners.abort()
}
