import type { MatchRecord } from './api/contracts'
import { DEFAULT_OPTIONS, isValidOption, type MatchOptions } from './game/config'
import { createPersistentStore } from './storage'

export const optionsStore = createPersistentStore<MatchOptions>(
  'options',
  DEFAULT_OPTIONS,
  (options) => isValidOption('sessionSeconds', options.sessionSeconds) && isValidOption('spawnSeconds', options.spawnSeconds),
)

export const lastResultStore = createPersistentStore<MatchRecord | null>('last-result', null)

export const pendingMatchesStore = createPersistentStore<MatchRecord[]>('pending-matches', [])

const playerIdStore = createPersistentStore('player-id', '')
if (!playerIdStore.get()) playerIdStore.set(crypto.randomUUID())

export const PLAYER = { id: playerIdStore.get(), name: 'Captain Jack' }
