import type { MatchRecord } from '../api/contracts'
import { useMatchSubmission } from '../api/queries'
import { pendingMatchesStore } from '../appState'
import { useStore } from '../storage'
import { END_REASON_LABEL, formatClock } from './format'

export function MatchResult({ record }: { record: MatchRecord }) {
  return (
    <div className="match-result">
      <p className="score" aria-label={`${record.score} points`}>
        {record.score}
      </p>
      <p className="result-details">
        Points · {formatClock(record.durationSeconds)} · {END_REASON_LABEL[record.endReason]}
      </p>
      <SubmissionStatus record={record} />
    </div>
  )
}

function SubmissionStatus({ record }: { record: MatchRecord }) {
  const isPending = useStore(pendingMatchesStore).some((match) => match.id === record.id)
  const { isSubmitting, retryPending } = useMatchSubmission()

  if (!isPending) {
    return (
      <p className="hint" role="status">
        Saved to the ranking and match history.
      </p>
    )
  }
  if (isSubmitting) {
    return (
      <p className="hint" role="status">
        Saving battle record…
      </p>
    )
  }
  return (
    <p className="error" role="alert">
      Battle record not saved yet.{' '}
      <button type="button" className="link-button" onClick={retryPending}>
        Retry
      </button>
    </p>
  )
}
