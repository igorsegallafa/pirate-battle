import type { MatchRecord } from './api/contracts'
import { DEFAULT_OPTIONS, isValidOption, type MatchOptions } from './game/config'
import { STORAGE_PREFIX, createPersistentStore } from './storage'

export const optionsStore = createPersistentStore<MatchOptions>(
  'options',
  DEFAULT_OPTIONS,
  (options) => isValidOption('sessionSeconds', options.sessionSeconds) && isValidOption('spawnSeconds', options.spawnSeconds),
)

export const lastResultStore = createPersistentStore<MatchRecord | null>('last-result', null)

export const pendingMatchesStore = createPersistentStore<MatchRecord[]>('pending-matches', [])

export const PLAYER = { id: loadPlayerId(), name: 'Captain Jack' }

function loadPlayerId(): string {
  const key = `${STORAGE_PREFIX}player-id`
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
