import { useState, type FormEvent } from 'react'
import { optionsStore } from '../appState'
import { OPTION_LIMITS, isValidOption, type MatchOptions } from '../game/config'
import { MenuButton, RoundButton } from './components'

type OptionName = keyof MatchOptions

const LABELS: Record<OptionName, string> = {
  sessionSeconds: 'Game session time',
  spawnSeconds: 'Enemy spawn time',
}

interface Props {
  backLabel: string
  onBack: () => void
}

export function OptionsForm({ backLabel, onBack }: Props) {
  const [draft, setDraft] = useState<Record<OptionName, string>>(() => {
    const saved = optionsStore.get()
    return { sessionSeconds: String(saved.sessionSeconds), spawnSeconds: String(saved.spawnSeconds) }
  })
  const [saved, setSaved] = useState(false)

  const names = Object.keys(LABELS) as OptionName[]
  const isValid = (name: OptionName) => draft[name].trim() !== '' && isValidOption(name, Number(draft[name]))

  const change = (name: OptionName, value: string) => {
    setDraft({ ...draft, [name]: value })
    setSaved(false)
  }

  const stepBy = (name: OptionName, direction: 1 | -1) => {
    const { min, max, step } = OPTION_LIMITS[name]
    const current = Number(draft[name])
    const stepped = Math.min(max, Math.max(min, current + direction * step))
    change(name, String(Number.isFinite(current) ? stepped : min))
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!names.every(isValid)) return
    optionsStore.set({ sessionSeconds: Number(draft.sessionSeconds), spawnSeconds: Number(draft.spawnSeconds) })
    setSaved(true)
  }

  return (
    <form className="options" onSubmit={save} noValidate>
      {names.map((name) => {
        const { min, max } = OPTION_LIMITS[name]
        const invalid = !isValid(name)
        return (
          <div className="option" key={name}>
            <label htmlFor={name}>{LABELS[name]} (seconds)</label>
            <div className="stepper">
              <RoundButton icon="minus" label={`Decrease ${LABELS[name]}`} onClick={() => stepBy(name, -1)} />
              <input
                id={name}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                value={draft[name]}
                onChange={(event) => change(name, event.target.value)}
                aria-invalid={invalid}
                aria-describedby={`${name}-hint`}
              />
              <RoundButton icon="plus" label={`Increase ${LABELS[name]}`} onClick={() => stepBy(name, 1)} />
            </div>
            <p id={`${name}-hint`} className={invalid ? 'error' : 'hint'} role={invalid ? 'alert' : undefined}>
              {invalid ? `Enter a whole number from ${min} to ${max}.` : `From ${min} to ${max} seconds.`}
            </p>
          </div>
        )
      })}

      <p className="hint" role="status">
        {saved ? 'Options saved. They apply to the next battle.' : ''}
      </p>
      <MenuButton type="submit">Save</MenuButton>
      <MenuButton variant="secondary" onClick={onBack}>
        {backLabel}
      </MenuButton>
    </form>
  )
}
