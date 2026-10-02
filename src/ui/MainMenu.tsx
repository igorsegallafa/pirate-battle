import { lastResultStore } from '../appState'
import { uiImage } from '../game/assets'
import { useStore } from '../storage'
import { MenuButton, MuteButton } from './components'
import type { LogTab } from './CaptainsLog'
import { MatchResult } from './MatchResult'
import { NetworkScenarioPanel } from './NetworkScenarioPanel'

const CONTROLS = [
  { action: 'Sail forward', keys: 'W or ↑' },
  { action: 'Turn', keys: 'A / D or ← / →' },
  { action: 'Fire front cannon', keys: 'Space' },
  { action: 'Fire broadside', keys: 'Q (left) · E (right)' },
  { action: 'Pause', keys: 'P or Esc' },
]

interface Props {
  onPlay: () => void
  onOptions: () => void
  onOpenLog: (tab: LogTab) => void
}

export function MainMenu({ onPlay, onOptions, onOpenLog }: Props) {
  const lastResult = useStore(lastResultStore)

  return (
    <main className="screen">
      <div className="panel menu">
        <div className="menu-column">
          <h1>
            <img className="title" src={uiImage('title_pirate_battle')} alt="Pirate Battle" />
          </h1>
          <p className="tagline">Set sail. Take command.</p>
          <MenuButton onClick={onPlay}>Play</MenuButton>
          <MenuButton onClick={onOptions}>Options</MenuButton>
        </div>

        <div className="menu-column">
          <section aria-labelledby="controls-title">
            <h2 id="controls-title">Controls</h2>
            <dl className="controls-help">
              {CONTROLS.map(({ action, keys }) => (
                <div key={action}>
                  <dt>{action}</dt>
                  <dd>{keys}</dd>
                </div>
              ))}
            </dl>
            <p className="hint">On touch screens, use the on-screen buttons.</p>
          </section>

          <div className="tabs">
            <MenuButton variant="secondary" onClick={() => onOpenLog('ranking')}>
              Ranking
            </MenuButton>
            <MenuButton variant="secondary" onClick={() => onOpenLog('history')}>
              Match History
            </MenuButton>
          </div>

          {lastResult && (
            <section aria-labelledby="last-battle-title">
              <h2 id="last-battle-title">Last battle</h2>
              <MatchResult record={lastResult} />
            </section>
          )}
        </div>
      </div>

      <div className="corner-tools">
        <MuteButton />
        <NetworkScenarioPanel />
      </div>
    </main>
  )
}
