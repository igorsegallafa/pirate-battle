import { useSyncExternalStore } from 'react'

export interface Store<T> {
  get(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

const STORAGE_PREFIX = 'pirate-battle:'

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** A store mirrored to localStorage. Unreadable or invalid stored data falls back to `fallback`. */
export function createPersistentStore<T>(name: string, fallback: T, isValid: (value: T) => boolean = () => true): Store<T> {
  const key = STORAGE_PREFIX + name
  const store = createStore(readStored(key, fallback, isValid))
  return {
    ...store,
    set(value) {
      store.set(value)
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage full or blocked: the value still applies for this visit.
      }
    },
  }
}

function readStored<T>(key: string, fallback: T, isValid: (value: T) => boolean): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value = JSON.parse(raw) as T
    return isValid(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function clearStoredData(): void {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key))
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get)
}
