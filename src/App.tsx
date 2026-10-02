import { useEffect, useEffectEvent, useState } from 'react'
import type { MatchRecord } from './api/contracts'
import { useMatchSubmission } from './api/queries'
import { PLAYER, lastResultStore } from './appState'
import type { MatchOptions } from './game/config'
import type { MatchSummary } from './game/session'
import { useStore } from './storage'
import { CaptainsLog, type LogTab } from './ui/CaptainsLog'
import { MenuButton } from './ui/components'
import { GameScreen } from './ui/GameScreen'
import { MainMenu } from './ui/MainMenu'
import { MatchResult } from './ui/MatchResult'
import { OptionsForm } from './ui/OptionsForm'

type Screen = 'menu' | 'options' | 'game' | 'result' | LogTab

export function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [matchNumber, setMatchNumber] = useState(0)
  const lastResult = useStore(lastResultStore)
  const { submit, retryPending } = useMatchSubmission()

  // Matches left unconfirmed by a previous visit are sent again.
  const resendPending = useEffectEvent(retryPending)
  useEffect(() => resendPending(), [])

  const play = () => {
    setMatchNumber(matchNumber + 1)
    setScreen('game')
  }

  const recordMatch = (summary: MatchSummary, config: MatchOptions) => {
    const record: MatchRecord = {
      id: crypto.randomUUID(),
      playerId: PLAYER.id,
      playerName: PLAYER.name,
      playedAt: new Date().toISOString(),
      config,
      ...summary,
    }
    lastResultStore.set(record)
    submit(record)
  }

  const goToMenu = () => setScreen('menu')

  switch (screen) {
    case 'menu':
      return <MainMenu onPlay={play} onOptions={() => setScreen('options')} onOpenLog={setScreen} />
    case 'options':
      return (
        <main className="screen">
          <section className="panel">
            <h1>Options</h1>
            <OptionsForm backLabel="Main Menu" onBack={goToMenu} />
          </section>
        </main>
      )
    case 'game':
      return (
        <GameScreen key={matchNumber} onEnd={recordMatch} onShowResult={() => setScreen('result')} onExit={goToMenu} />
      )
    case 'result':
      return (
        <main className="screen">
          <section className="panel">
            <h1>{lastResult?.endReason === 'defeated' ? 'Ship Destroyed' : 'Battle Complete'}</h1>
            {lastResult && <MatchResult record={lastResult} />}
            <MenuButton onClick={play}>Play Again</MenuButton>
            <MenuButton onClick={goToMenu}>Main Menu</MenuButton>
          </section>
        </main>
      )
    default:
      return <CaptainsLog tab={screen} onTabChange={setScreen} onBack={goToMenu} />
  }
}
