import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { Event, EventType } from '../types'
import type { GameMeta } from '../types'
import { YouTubePlayer, type YouTubePlayerHandle } from './YouTubePlayer'

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
  { key: 'success',        label: 'Success' },
  { key: 'goal',           label: 'Goal' },
  { key: 'drop',           label: 'Pass dropped' },
  { key: 'throwaway',      label: 'Pass throwaway' },
  { key: 'goal-drop',      label: 'Goal dropped' },
  { key: 'goal-throwaway', label: 'Goal throwaway' },
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const ytRef = useRef<YouTubePlayerHandle | null>(null)
  const lastJumpedFromIdx = useRef<number>(-1)
  const isPlayingRef = useRef(false)
  const filteredRef = useRef<Event[]>([])
  const hasVideo = !!meta.videoUrl

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
  filteredRef.current = filtered

  // Largest-timestamp event <= currentVideoTime in the filtered list
  const activeEventNumber = useMemo(() => {
    let best: number | null = null
    for (const ev of filtered) {
      if (ev.timestamp <= currentVideoTime) best = ev.event_number
      else break
    }
    return best
  }, [filtered, currentVideoTime])

  function seekToTime(timestamp: number) {
    lastJumpedFromIdx.current = -1
    ytRef.current?.seekTo(timestamp)
    setCurrentVideoTime(timestamp)
  }

  // Auto-advance jump: 5s pre-roll, does NOT reset the guard
  function jumpToEvent(timestamp: number) {
    const t = Math.max(0, timestamp - 5)
    ytRef.current?.seekTo(t)
    setCurrentVideoTime(t)
  }

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      ytRef.current?.pause()
    } else {
      ytRef.current?.play()
    }
  }, [isPlaying])

  // Space key
  useEffect(() => {
    if (!hasVideo) return
    function handleKey(e: KeyboardEvent) {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [hasVideo, togglePlay])

  // Keep isPlayingRef in sync so the interval can read it without restarting
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Always poll while video is present — updates timeline highlight during scrubbing too
  useEffect(() => {
    if (!hasVideo) return
    const id = window.setInterval(() => {
      const t = ytRef.current?.getCurrentTime() ?? 0
      setCurrentVideoTime(t)

      if (!isPlayingRef.current) return

      // Find active event index in the filtered list
      const evs = filteredRef.current
      let activeIdx = -1
      for (let i = 0; i < evs.length; i++) {
        if (evs[i].timestamp <= t) activeIdx = i
        else break
      }
      if (activeIdx < 0 || activeIdx >= evs.length - 1) return

      const activeEvent = evs[activeIdx]
      const nextEvent = evs[activeIdx + 1]
      const gap = nextEvent.timestamp - activeEvent.timestamp

      // After 2s of play past the active event, if next event is 10+ seconds away, jump.
      // Guard against re-triggering: only jump once per active event index.
      if (t >= activeEvent.timestamp + 2 && gap >= 10 && lastJumpedFromIdx.current !== activeIdx) {
        lastJumpedFromIdx.current = activeIdx
        jumpToEvent(nextEvent.timestamp)
      }
    }, 200)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVideo])

  const handleYTPlay = useCallback((t: number) => {
    setIsPlaying(true)
    setCurrentVideoTime(t)
  }, [])

  const handleYTPause = useCallback((t: number) => {
    setIsPlaying(false)
    setCurrentVideoTime(t)
  }, [])

  function outcomeTag(ev: Event) {
    if (ev.event_type !== 'pass') return null
    const cls =
      ev.outcome === 'goal' ? 'review-outcome-good' :
      ev.outcome === 'success' ? '' :
      'review-outcome-bad'
    return <span className={`review-outcome ${cls}`}>{ev.outcome}</span>
  }

  const filtersEl = (
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
  )

  const eventListEl = (
    <div className="review-event-list">
      {filtered.length === 0 && (
        <p className="muted review-empty">No events match the current filters.</p>
      )}
      {filtered.map(ev => (
        <div
          key={ev.event_number}
          className={[
            'review-event-row',
            `review-et-${ev.event_type}`,
            hasVideo ? 'review-clickable' : '',
            ev.event_number === activeEventNumber ? 'review-active' : '',
          ].filter(Boolean).join(' ')}
          onClick={hasVideo ? () => seekToTime(ev.timestamp) : undefined}
        >
          <span className="review-num">#{ev.event_number}</span>
          <span className="review-time">{formatTime(ev.timestamp)}</span>
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
  )

  const header = (
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
  )

  if (!hasVideo) {
    return (
      <div className="game-review">
        {header}
        {filtersEl}
        {eventListEl}
      </div>
    )
  }

  return (
    <div className="game-review game-review--with-video">
      {header}
      <div className="game-review-body">
        <div className="game-review-left">
          {filtersEl}
          {eventListEl}
        </div>
        <div className="game-review-right">
          <div className="game-review-video">
            <YouTubePlayer
              ref={ytRef}
              videoUrl={meta.videoUrl}
              onPlay={handleYTPlay}
              onPause={handleYTPause}
            />
          </div>
          <div className="review-video-controls">
            <button className="review-video-btn" onClick={togglePlay}>
              {isPlaying ? '⏹ Stop' : '▶ Play'}
            </button>
            <span className="review-video-time muted">{formatTime(currentVideoTime)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
