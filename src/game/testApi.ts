import type { Match } from './simulation'

/** Exposed on `window.__pirateBattle` when the URL has `?e2e`, for automated tests and profiling. */
export interface TestApi {
  match: Match
  /** Runs the simulation and rendering for this much game time. Needs `&clock=manual`. */
  advance(milliseconds: number): void
}

declare global {
  interface Window {
    __pirateBattle?: TestApi
  }
}
