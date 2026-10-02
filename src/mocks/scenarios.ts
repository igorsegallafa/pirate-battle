import { createPersistentStore } from '../storage'

export type Endpoint = 'ranking' | 'history' | 'submit'

/** 'timeout' never answers, 'network' drops the connection, a number is an HTTP status. */
export type Failure = 'timeout' | 'network' | 400 | 500 | 503

export interface Scenario {
  description: string
  fixtures: 'standard' | 'none' | 'many'
  /** Delay of each successive response, repeating; 'random' draws seeded delays instead. */
  latencyMs: number[] | 'random'
  failures: Partial<Record<Endpoint, Failure>>
  /** The match is stored before the submit failure, as when only the response gets lost. */
  submitStoresBeforeFailing?: boolean
}

const FAST = [120]
const everyEndpoint = (failure: Failure) => ({ ranking: failure, history: failure, submit: failure })

export const SCENARIOS = {
  success: { description: 'Everything works.', fixtures: 'standard', latencyMs: FAST, failures: {} },
  empty: { description: 'No other captains; lists start empty.', fixtures: 'none', latencyMs: FAST, failures: {} },
  'many-pages': { description: 'Long ranking and match history.', fixtures: 'many', latencyMs: FAST, failures: {} },
  slow: { description: 'Every response takes 2.5 s.', fixtures: 'standard', latencyMs: [2500], failures: {} },
  'variable-latency': {
    description: 'Seeded random delay between 100 ms and 2 s.',
    fixtures: 'standard',
    latencyMs: 'random',
    failures: {},
  },
  'out-of-order': {
    description: 'Responses alternate between 1.5 s and 100 ms, so they arrive out of order.',
    fixtures: 'many',
    latencyMs: [1500, 100],
    failures: {},
  },
  timeout: { description: 'No request is ever answered.', fixtures: 'standard', latencyMs: FAST, failures: everyEndpoint('timeout') },
  offline: { description: 'Every request fails to connect.', fixtures: 'standard', latencyMs: FAST, failures: everyEndpoint('network') },
  'bad-request': { description: 'Every request gets HTTP 400.', fixtures: 'standard', latencyMs: FAST, failures: everyEndpoint(400) },
  'server-error': { description: 'Every request gets HTTP 500.', fixtures: 'standard', latencyMs: FAST, failures: everyEndpoint(500) },
  'ranking-error': { description: 'Only the ranking fails (HTTP 500).', fixtures: 'standard', latencyMs: FAST, failures: { ranking: 500 } },
  'history-error': { description: 'Only the match history fails (HTTP 500).', fixtures: 'standard', latencyMs: FAST, failures: { history: 500 } },
  'submit-timeout': {
    description: 'The match is stored but its response never arrives.',
    fixtures: 'standard',
    latencyMs: FAST,
    failures: { submit: 'timeout' },
    submitStoresBeforeFailing: true,
  },
  'submit-unavailable': {
    description: 'Registering a match gets HTTP 503; lists still load.',
    fixtures: 'standard',
    latencyMs: FAST,
    failures: { submit: 503 },
  },
} satisfies Record<string, Scenario>

export type ScenarioName = keyof typeof SCENARIOS

export const scenarioStore = createPersistentStore<ScenarioName>('scenario', 'success', (name) => name in SCENARIOS)

const requested = new URLSearchParams(location.search).get('scenario')
if (requested && requested in SCENARIOS) scenarioStore.set(requested as ScenarioName)

export function currentScenario(): Scenario {
  return SCENARIOS[scenarioStore.get()]
}

const RANDOM_LATENCY = { minMs: 100, maxMs: 2000, seed: 7 }
let requestCount = 0
let randomState = RANDOM_LATENCY.seed

scenarioStore.subscribe(() => {
  requestCount = 0
  randomState = RANDOM_LATENCY.seed
})

export function nextLatencyMs(): number {
  const { latencyMs } = currentScenario()
  if (latencyMs !== 'random') return latencyMs[requestCount++ % latencyMs.length]

  // Linear congruential generator: the same delays on every run.
  randomState = (randomState * 1664525 + 1013904223) >>> 0
  return RANDOM_LATENCY.minMs + (randomState / 2 ** 32) * (RANDOM_LATENCY.maxMs - RANDOM_LATENCY.minMs)
}
