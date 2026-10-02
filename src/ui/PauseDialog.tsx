import { useEffect, useRef, useState } from 'react'
import type { GameSession } from '../game/session'
import { useStore } from '../storage'
import { MenuButton } from './components'
import { OptionsForm } from './OptionsForm'

interface Props {
  session: GameSession
  onExit: () => void
}

export function PauseDialog({ session, onExit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const paused = useStore(session.hud).phase === 'paused'
  const [showOptions, setShowOptions] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (paused) dialog?.showModal()
    else dialog?.close()
  }, [paused])

  const resume = () => {
    setShowOptions(false)
    session.resume()
  }

  return (
    <dialog ref={dialogRef} className="panel" aria-labelledby="pause-title" onClose={resume}>
      <h1 id="pause-title">{showOptions ? 'Options' : 'Paused'}</h1>
      {showOptions ? (
        <OptionsForm backLabel="Back" onBack={() => setShowOptions(false)} />
      ) : (
        <>
          <p>Ready when you are.</p>
          <MenuButton onClick={resume}>
            Resume
          </MenuButton>
          <MenuButton onClick={() => setShowOptions(true)}>Options</MenuButton>
          <MenuButton onClick={onExit}>Main Menu</MenuButton>
        </>
      )}
    </dialog>
  )
}
