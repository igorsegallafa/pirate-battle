import axios from 'axios'
import type { MatchOptions } from '../game/config'
import { API, type MatchRecord, type Page, type PageParams, type RankingEntry, type RankingParams } from './contracts'

export const PAGE_SIZE = 5

const http = axios.create({ timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 5000) })

export async function fetchRanking(config: MatchOptions, page: number, signal: AbortSignal): Promise<Page<RankingEntry>> {
  const params: RankingParams = { ...config, page, pageSize: PAGE_SIZE }
  const response = await http.get(API.ranking, { params, signal })
  return response.data
}

export async function fetchMatchHistory(playerId: string, page: number, signal: AbortSignal): Promise<Page<MatchRecord>> {
  const params: PageParams = { page, pageSize: PAGE_SIZE }
  const response = await http.get(API.playerMatches(playerId), { params, signal })
  return response.data
}

export async function submitMatch(record: MatchRecord): Promise<MatchRecord> {
  const response = await http.post(API.matches, record)
  return response.data
}
