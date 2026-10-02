import type { MatchRecord } from '../api/contracts'
import { PLAYER } from '../appState'
import { DEFAULT_OPTIONS } from '../game/config'
import type { Scenario } from './scenarios'

const CAPTAINS = ['Captain Flint', 'Red Sparrow', 'Storm Rider', 'Sea Wolf', 'Black Marlin', 'Iron Kraken', 'Salty Meg']

/** Includes ties, so the ranking tie-break is visible. */
const STANDARD_SCORES = [38, 32, 27, 27, 24, 21, 19, 19, 16, 14, 11, 9, 6]

const NEWEST_FIXTURE_TIME = Date.parse('2026-09-08T21:42:00Z')
const MINUTES_BETWEEN_FIXTURES = 26

interface Captain {
  id: string
  name: string
}

function fixtureMatch(index: number, captain: Captain, score: number): MatchRecord {
  const defeated = index % 3 === 2
  return {
    id: `fixture-${captain.id}-${index}`,
    playerId: captain.id,
    playerName: captain.name,
    playedAt: new Date(NEWEST_FIXTURE_TIME - index * MINUTES_BETWEEN_FIXTURES * 60_000).toISOString(),
    score,
    durationSeconds: defeated ? 50 + (index % 7) * 9 : DEFAULT_OPTIONS.sessionSeconds,
    endReason: defeated ? 'defeated' : 'time_up',
    config: DEFAULT_OPTIONS,
  }
}

function otherCaptain(index: number): Captain {
  const name = CAPTAINS[index % CAPTAINS.length]
  return { id: name.toLowerCase().replaceAll(' ', '-'), name }
}

const STANDARD = STANDARD_SCORES.map((score, index) => fixtureMatch(index, otherCaptain(index), score))

const MANY = [
  ...Array.from({ length: 40 }, (_, index) => fixtureMatch(index, otherCaptain(index), 40 - ((index * 7) % 37))),
  ...Array.from({ length: 23 }, (_, index) => fixtureMatch(index, PLAYER, 30 - ((index * 5) % 23))),
]

export const FIXTURES: Record<Scenario['fixtures'], MatchRecord[]> = { standard: STANDARD, none: [], many: MANY }
