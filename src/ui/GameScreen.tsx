import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { optionsStore } from '../appState'
import { loadGameTextures } from '../game/assets'
import { createGameConfig, type MatchOptions } from '../game/config'
import { GameSession, type MatchSummary } from '../game/session'
import { MenuButton } from './components'
import { Hud } from './Hud'
import { PauseDialog } from './PauseDialog'
import { TouchControls } from './TouchControls'

interface Props {
  onEnd: (summary: MatchSummary, options: MatchOptions) => void
  onShowResult: () => void
  onExit: () => void
}

export function GameScreen({ onEnd, onShowResult, onExit }: Props) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const [options] = useState(optionsStore.get)
  const [session, setSession] = useState<GameSession | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const endMatch = useEffectEvent((summary: MatchSummary) => onEnd(summary, options))
  const showResult = useEffectEvent(onShowResult)

  useEffect(() => {
    const arena = arenaRef.current
    if (!arena) return

    const cancellation = new AbortController()
    let started: GameSession | undefined

    loadGameTextures(setLoadProgress)
      .then((textures) => {
        const callbacks = { onEnd: endMatch, onLeave: showResult }
        return GameSession.start(arena, textures, createGameConfig(options), callbacks, cancellation.signal)
      })
      .then((newSession) => {
        started = newSession
        if (newSession) setSession(newSession)
      })
      .catch(() => {
        if (!cancellation.signal.aborted) setLoadFailed(true)
      })

    return () => {
      cancellation.abort()
      started?.destroy()
      setSession(null)
    }
  }, [attempt, options])

  const retry = () => {
    setLoadFailed(false)
    setLoadProgress(0)
    setAttempt(attempt + 1)
  }

  return (
    <main className="game-screen">
      <p className="rotate-hint">Rotate your device to landscape for a larger view.</p>
      <div className="arena" ref={arenaRef}>
        {session && (
          <>
            <Hud session={session} />
            <TouchControls session={session} />
            <PauseDialog session={session} onExit={onExit} />
          </>
        )}
        {!session && !loadFailed && (
          <div className="arena-message" role="status">
            <label htmlFor="load-progress">Loading battle assets…</label>
            <progress id="load-progress" value={loadProgress} />
          </div>
        )}
        {loadFailed && (
          <div className="arena-message" role="alert">
            <p>Could not load the battle assets.</p>
            <MenuButton onClick={retry}>Try again</MenuButton>
            <MenuButton variant="secondary" onClick={onExit}>
              Main Menu
            </MenuButton>
          </div>
        )}
      </div>
    </main>
  )
}
