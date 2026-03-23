import { useState, useMemo } from 'react'
import type { Event, EventType } from '../types'
import type { GameMeta } from '../types'

function videoTimestampUrl(videoUrl: string, seconds: number): string {
  const s = Math.max(0, Math.floor(seconds) - 5)
  if (videoUrl.includes('youtu.be/')) {
    const sep = videoUrl.includes('?') ? '&' : '?'
    return `${videoUrl}${sep}t=${s}`
  }
  if (videoUrl.includes('youtube.com/')) {
    const sep = videoUrl.includes('?') ? '&' : '?'
    return `${videoUrl}${sep}t=${s}`
  }
  return videoUrl
}

function formatTime(s: number): string {
  const sec = Math.floor(Math.abs(s))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  'possession_start': 'Possession start',
  'pass': 'Pass',
  'turnover': 'Turnover',
  'game-paused': 'Game paused',
  'game-continued': 'Game continued',
}

type OutcomeFilter = 'success' | 'drop' | 'throwaway' | 'goal' | 'goal-drop' | 'goal-throwaway'

const OUTCOME_FILTERS: { key: OutcomeFilter; label: string }[] = [
  { key: 'success',         label: 'Success' },
  { key: 'goal',            label: 'Goal' },
  { key: 'drop',            label: 'Pass dropped' },
  { key: 'throwaway',       label: 'Pass throwaway' },
  { key: 'goal-drop',       label: 'Goal dropped' },
  { key: 'goal-throwaway',  label: 'Goal throwaway' },
]

interface GameReviewScreenProps {
  meta: GameMeta
  events: Event[]
  onBack: () => void
}

export function GameReviewScreen({ meta, events, onBack }: GameReviewScreenProps) {
  const allPlayers = useMemo(() => {
    const set = new Set<string>()
    for (const ev of events) {
      if (ev.player) set.add(ev.player)
      if (ev.target_player) set.add(ev.target_player)
    }
    return [...set].sort()
  }, [events])

  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<OutcomeFilter>>(new Set())

  function togglePlayer(name: string) {
    setSelectedPlayers(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleOutcome(o: OutcomeFilter) {
    setSelectedOutcomes(prev => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }

  const filtered = useMemo(() => {
    return events.filter(ev => {
      if (selectedOutcomes.size > 0) {
        if (ev.event_type !== 'pass') return false
        if (!selectedOutcomes.has(ev.outcome as OutcomeFilter)) return false
      }
      if (selectedPlayers.size > 0 && !selectedPlayers.has(ev.player)) return false
      return true
    })
  }, [events, selectedPlayers, selectedOutcomes])

  function outcomeTag(ev: Event) {
    if (ev.event_type !== 'pass') return null
    const cls =
      ev.outcome === 'goal' ? 'review-outcome-good' :
      ev.outcome === 'success' ? '' :
      'review-outcome-bad'
    return <span className={`review-outcome ${cls}`}>{ev.outcome}</span>
  }

  return (
    <div className="game-review">
      <div className="game-review-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="game-review-title">
          <span className="game-review-date">{meta.date}</span>
          <span className="game-review-matchup">
            {meta.teamName ? `${meta.teamName} vs ` : ''}{meta.opponent}
            {meta.tournament ? ` · ${meta.tournament}` : ''}
          </span>
        </div>
        <span className="game-review-count muted">{filtered.length} / {events.length} events</span>
      </div>

      <div className="game-review-filters">
        <div className="review-filter-group">
          <span className="review-filter-label">Pass outcome</span>
          <div className="review-filter-chips">
            {OUTCOME_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className={`review-chip ${selectedOutcomes.has(key) ? 'active' : ''}`}
                onClick={() => toggleOutcome(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {allPlayers.length > 0 && (
          <div className="review-filter-group">
            <span className="review-filter-label">Player</span>
            <div className="review-filter-chips">
              {allPlayers.map(p => (
                <button
                  key={p}
                  className={`review-chip ${selectedPlayers.has(p) ? 'active' : ''}`}
                  onClick={() => togglePlayer(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {(selectedPlayers.size > 0 || selectedOutcomes.size > 0) && (
          <button className="btn-text" onClick={() => { setSelectedPlayers(new Set()); setSelectedOutcomes(new Set()) }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="review-event-list">
        {filtered.length === 0 && (
          <p className="muted review-empty">No events match the current filters.</p>
        )}
        {filtered.map(ev => (
          <div key={ev.event_number} className={`review-event-row review-et-${ev.event_type}`}>
            <span className="review-num">#{ev.event_number}</span>
            <span className="review-time">{formatTime(ev.timestamp)}</span>
            {meta.videoUrl ? (
              <a
                className="review-video-link"
                href={videoTimestampUrl(meta.videoUrl, ev.timestamp)}
                target="_blank"
                rel="noreferrer"
                title="Open in video"
            ><span className="yt-icon"><span className="yt-play" /></span></a>
            ) : null}
            <span className="review-type">{EVENT_TYPE_LABELS[ev.event_type]}</span>
            <span className="review-players">
              {ev.player && <span className="review-player">{ev.player}</span>}
              {ev.target_player && (
                <>
                  <span className="review-arrow">→</span>
                  <span className="review-player">{ev.target_player}</span>
                </>
              )}
            </span>
            {outcomeTag(ev)}
          </div>
        ))}
      </div>
    </div>
  )
}
