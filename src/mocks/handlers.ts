import { HttpResponse, delay, http } from 'msw'
import { API, type MatchRecord, type Page } from '../api/contracts'
import { createPersistentStore } from '../storage'
import { FIXTURES } from './fixtures'
import { currentScenario, nextLatencyMs, type Endpoint } from './scenarios'

const storedMatches = createPersistentStore<MatchRecord[]>('mock-matches', [])

function allMatches(): MatchRecord[] {
  return [...FIXTURES[currentScenario().fixtures], ...storedMatches.get()]
}

function storeMatch(record: MatchRecord): { saved: MatchRecord; created: boolean } {
  const existing = storedMatches.get().find((match) => match.id === record.id)
  if (existing) return { saved: existing, created: false }

  storedMatches.set([...storedMatches.get(), record])
  return { saved: record, created: true }
}

/** Waits the scenario's latency and returns its failure response for the endpoint, if any. */
async function simulateNetwork(endpoint: Endpoint): Promise<Response | undefined> {
  await delay(nextLatencyMs())
  const failure = currentScenario().failures[endpoint]
  if (failure === undefined) return
  if (failure === 'timeout') return delay('infinite').then(() => undefined)
  if (failure === 'network') return HttpResponse.error()
  return HttpResponse.json({ message: `Simulated HTTP ${failure}` }, { status: failure })
}

function paginate<T>(items: T[], query: URLSearchParams): Page<T> {
  const pageSize = Number(query.get('pageSize'))
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, Number(query.get('page'))), totalPages)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
  }
}

/** Highest score first; ties go to the earlier match, then to the lower id. */
function byRank(a: MatchRecord, b: MatchRecord): number {
  return b.score - a.score || a.playedAt.localeCompare(b.playedAt) || a.id.localeCompare(b.id)
}

export const handlers = [
  http.get(API.ranking, async ({ request }) => {
    const failure = await simulateNetwork('ranking')
    if (failure) return failure

    const query = new URL(request.url).searchParams
    const ranked = allMatches()
      .filter(
        ({ config }) =>
          config.sessionSeconds === Number(query.get('sessionSeconds')) &&
          config.spawnSeconds === Number(query.get('spawnSeconds')),
      )
      .sort(byRank)
      .map((match, index) => ({ ...match, rank: index + 1 }))
    return HttpResponse.json(paginate(ranked, query))
  }),

  http.get(API.playerMatches(':playerId'), async ({ request, params }) => {
    const failure = await simulateNetwork('history')
    if (failure) return failure

    const history = allMatches()
      .filter((match) => match.playerId === params.playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    return HttpResponse.json(paginate(history, new URL(request.url).searchParams))
  }),

  http.post(API.matches, async ({ request }) => {
    const record = (await request.json()) as MatchRecord
    if (currentScenario().submitStoresBeforeFailing) storeMatch(record)

    const failure = await simulateNetwork('submit')
    if (failure) return failure

    const { saved, created } = storeMatch(record)
    return HttpResponse.json(saved, { status: created ? 201 : 200 })
  }),
]
