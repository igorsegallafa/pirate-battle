import type { EndReason } from '../game/simulation'

export const END_REASON_LABEL: Record<EndReason, string> = { time_up: 'Time up', defeated: 'Defeated' }

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(isoDate))
}
