import { useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { MatchRecord, Page, RankingEntry } from '../api/contracts'
import { useMatchHistory, useRanking } from '../api/queries'
import { PLAYER, optionsStore } from '../appState'
import { useStore } from '../storage'
import { MenuButton, RoundButton } from './components'
import { END_REASON_LABEL, formatClock, formatDate } from './format'

export type LogTab = 'ranking' | 'history'

const TAB_LABELS: Record<LogTab, string> = { ranking: 'Ranking', history: 'Match History' }

interface Props {
  tab: LogTab
  onTabChange: (tab: LogTab) => void
  onBack: () => void
}

export function CaptainsLog({ tab, onTabChange, onBack }: Props) {
  return (
    <main className="screen">
      <section className="panel log">
        <h1>Captain's Log</h1>
        <div className="tabs" role="tablist" aria-label="Records">
          {(Object.keys(TAB_LABELS) as LogTab[]).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${name}-tab`}
              aria-selected={tab === name}
              aria-controls="log-panel"
              className={`menu-button ${tab === name ? 'primary' : 'secondary'}`}
              onClick={() => onTabChange(name)}
            >
              {TAB_LABELS[name]}
            </button>
          ))}
        </div>
        <div id="log-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
          {tab === 'ranking' ? <Ranking /> : <MatchHistory />}
        </div>
        <MenuButton onClick={onBack}>Main Menu</MenuButton>
      </section>
    </main>
  )
}

function Ranking() {
  const config = useStore(optionsStore)
  const [page, setPage] = useState(1)
  return (
    <PagedTable<RankingEntry>
      caption={`${config.sessionSeconds} second battles · ${config.spawnSeconds} second spawn interval`}
      emptyMessage="No battles recorded with these options yet."
      query={useRanking(config, page)}
      page={page}
      onPageChange={setPage}
      isHighlighted={(entry) => entry.playerId === PLAYER.id}
      columns={[
        { header: 'Rank', cell: (entry) => String(entry.rank).padStart(2, '0') },
        { header: 'Captain', cell: (entry) => <CaptainName entry={entry} /> },
        { header: 'Points', cell: (entry) => entry.score },
        { header: 'Played', cell: (entry) => formatDate(entry.playedAt) },
      ]}
    />
  )
}

function MatchHistory() {
  const [page, setPage] = useState(1)
  return (
    <PagedTable<MatchRecord>
      caption={`${PLAYER.name} · your battles`}
      emptyMessage="You have no recorded battles yet."
      query={useMatchHistory(page)}
      page={page}
      onPageChange={setPage}
      columns={[
        { header: 'Date', cell: (match) => formatDate(match.playedAt) },
        { header: 'Points', cell: (match) => match.score },
        { header: 'Duration', cell: (match) => formatClock(match.durationSeconds) },
        { header: 'Result', cell: (match) => END_REASON_LABEL[match.endReason] },
      ]}
    />
  )
}

function CaptainName({ entry }: { entry: RankingEntry }) {
  return (
    <>
      {entry.playerName} {entry.playerId === PLAYER.id && <span className="you-tag">You</span>}
    </>
  )
}

interface PagedTableProps<Row extends MatchRecord> {
  caption: string
  emptyMessage: string
  query: UseQueryResult<Page<Row>>
  page: number
  onPageChange: (page: number) => void
  columns: { header: string; cell: (row: Row) => ReactNode }[]
  isHighlighted?: (row: Row) => boolean
}

function PagedTable<Row extends MatchRecord>({
  caption,
  emptyMessage,
  query,
  page,
  onPageChange,
  columns,
  isHighlighted,
}: PagedTableProps<Row>) {
  const { data, isFetching, isError, refetch } = query

  if (!data) {
    return isError ? (
      <div className="table-message" role="alert">
        <p>Could not load the records.</p>
        <MenuButton variant="secondary" onClick={() => refetch()}>
          Try again
        </MenuButton>
      </div>
    ) : (
      <p className="table-message" role="status">
        Loading…
      </p>
    )
  }

  return (
    <>
      <p className="table-status" role="status">
        {isFetching ? 'Updating…' : isError ? 'Could not refresh; showing saved data.' : ''}
      </p>
      {data.items.length === 0 ? (
        <p className="table-message">{emptyMessage}</p>
      ) : (
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.header} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className={isHighlighted?.(row) ? 'own' : undefined}>
                {columns.map((column) => (
                  <td key={column.header}>{column.cell(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <nav className="pagination" aria-label="Pages">
        <RoundButton
          icon="turn_left"
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span>
          Page {data.page} of {data.totalPages}
        </span>
        <RoundButton
          icon="turn_right"
          label="Next page"
          disabled={page >= data.totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </nav>
    </>
  )
}
