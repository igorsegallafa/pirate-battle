import { QueryClient, keepPreviousData, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { PLAYER, pendingMatchesStore } from '../appState'
import type { MatchOptions } from '../game/config'
import { fetchMatchHistory, fetchRanking, submitMatch } from './client'
import type { MatchRecord } from './contracts'

const MAX_RETRIES = 2
const SUBMIT_MATCH_KEY = ['submit-match']

/** A 4xx answer will not change on its own; everything else may be transient. */
function shouldRetry(failureCount: number, error: Error): boolean {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const isClientError = status !== undefined && status < 500
  return failureCount < MAX_RETRIES && !isClientError
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
    mutations: { retry: shouldRetry },
  },
})

export function useRanking(config: MatchOptions, page: number) {
  return useQuery({
    queryKey: ['ranking', config, page],
    queryFn: ({ signal }) => fetchRanking(config, page, signal),
    placeholderData: keepPreviousData,
  })
}

export function useMatchHistory(page: number) {
  return useQuery({
    queryKey: ['history', PLAYER.id, page],
    queryFn: ({ signal }) => fetchMatchHistory(PLAYER.id, page, signal),
    placeholderData: keepPreviousData,
  })
}

export function useMatchSubmission() {
  const client = useQueryClient()
  const isSubmitting = useIsMutating({ mutationKey: SUBMIT_MATCH_KEY }) > 0

  const { mutate } = useMutation({
    mutationKey: SUBMIT_MATCH_KEY,
    mutationFn: submitMatch,
    onSuccess(_saved, record) {
      pendingMatchesStore.set(pendingMatchesStore.get().filter((match) => match.id !== record.id))
      client.invalidateQueries({ queryKey: ['ranking'] })
      client.invalidateQueries({ queryKey: ['history'] })
    },
  })

  return {
    isSubmitting,
    /** Queues the record locally first, so it survives a failed request or a refresh. */
    submit(record: MatchRecord) {
      pendingMatchesStore.set([...pendingMatchesStore.get(), record])
      mutate(record)
    },
    retryPending() {
      pendingMatchesStore.get().forEach((record) => mutate(record))
    },
  }
}
