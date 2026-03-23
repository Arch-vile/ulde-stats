import { useState, useRef, useEffect } from 'react'
import type { Event, EventType, Outcome } from '../types'

function formatTime(s: number): string {
  const sec = Math.floor(Math.abs(s))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

function parseTime(value: string): number | null {
  const parts = value.trim().split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

function eventLabel(ev: Event): string {
  if (ev.event_type === 'possession_start') return `▶ ${ev.player}`
  if (ev.event_type === 'turnover') return `↩ ${ev.player} turnover`
  if (ev.event_type === 'game-paused') return '⏸ Game paused'
  if (ev.event_type === 'game-continued') return '▶ Game continued'
  return `${ev.player} → ${ev.target_player}`
}

function outcomeSuffix(ev: Event): string {
  if (ev.event_type !== 'pass') return ''
  if (ev.outcome === 'goal') return ' ✓ GOAL'
  if (ev.outcome === 'drop') return ' ✗ drop'
  if (ev.outcome === 'throwaway') return ' ✗ throwaway'
  if (ev.outcome === 'goal-drop') return ' ✗ goal drop'
  if (ev.outcome === 'goal-throwaway') return ' ✗ goal TA'
  return ''
}

const OUTCOMES: Outcome[] = ['success', 'goal', 'drop', 'throwaway', 'goal-drop', 'goal-throwaway']
const EVENT_TYPES: EventType[] = ['possession_start', 'pass', 'turnover', 'game-paused', 'game-continued']

interface InsertForm {
  event_type: EventType
  player: string
  target_player: string
  outcome: Outcome
  timestamp: string
}

interface EventTimelineProps {
  events: Event[]
  players: string[]
  onUpdateOutcome: (index: number, outcome: Outcome) => void
  onUpdateTimestamp: (index: number, timestamp: number) => void
  onDeleteEvent: (index: number) => void
  onInsertEvent: (afterEventNumber: number, event: Omit<Event, 'event_number'>) => void
}

export function EventTimeline({ events, players, onUpdateOutcome, onUpdateTimestamp, onDeleteEvent, onInsertEvent }: EventTimelineProps) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editingTime, setEditingTime] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [insertingAfter, setInsertingAfter] = useState<number | null>(null)
  const [insertForm, setInsertForm] = useState<InsertForm>({
    event_type: 'pass',
    player: '',
    target_player: '',
    outcome: 'success',
    timestamp: '',
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTime !== null) inputRef.current?.select()
  }, [editingTime])

  function startEditTime(index: number, current: number, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingTime(index)
    setEditValue(formatTime(current))
  }

  function commitEditTime(index: number) {
    const parsed = parseTime(editValue)
    if (parsed !== null) onUpdateTimestamp(index, parsed)
    setEditingTime(null)
  }

  function openInsert(afterEventNumber: number, prevTimestamp: number, nextTimestamp: number | null) {
    const mid = nextTimestamp !== null
      ? Math.round((prevTimestamp + nextTimestamp) / 2)
      : prevTimestamp
    setInsertingAfter(afterEventNumber)
    setInsertForm({ event_type: 'pass', player: '', target_player: '', outcome: 'success', timestamp: formatTime(mid) })
  }

  function submitInsert() {
    if (insertingAfter === null) return
    const timestamp = parseTime(insertForm.timestamp)
    if (timestamp === null) return
    const needsPlayer = insertForm.event_type !== 'game-paused' && insertForm.event_type !== 'game-continued'
    if (needsPlayer && !insertForm.player.trim()) return
    if (insertForm.event_type === 'pass' && !insertForm.target_player.trim()) return

    onInsertEvent(insertingAfter, {
      timestamp,
      event_type: insertForm.event_type,
      player: needsPlayer ? insertForm.player.trim() : '',
      target_player: insertForm.event_type === 'pass' ? insertForm.target_player.trim() : '',
      outcome: insertForm.event_type === 'pass' ? insertForm.outcome : insertForm.event_type === 'turnover' ? 'turnover' : '',
    })
    setInsertingAfter(null)
  }

  const possessionGroups: { index: number; event: Event }[][] = []
  events.forEach((ev, i) => {
    if (ev.event_type === 'possession_start' || possessionGroups.length === 0) {
      possessionGroups.push([])
    }
    possessionGroups[possessionGroups.length - 1].push({ index: i, event: ev })
  })

  function renderInsertForm() {
    const showPlayer = insertForm.event_type !== 'game-paused' && insertForm.event_type !== 'game-continued'
    const showTarget = insertForm.event_type === 'pass'
    const showOutcome = insertForm.event_type === 'pass'
    return (
      <div className="insert-form" onClick={e => e.stopPropagation()}>
        <select
          value={insertForm.event_type}
          onChange={e => setInsertForm(f => ({ ...f, event_type: e.target.value as EventType }))}
        >
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className="ev-time-input"
          value={insertForm.timestamp}
          onChange={e => setInsertForm(f => ({ ...f, timestamp: e.target.value }))}
          placeholder="m:ss"
        />
        {showPlayer && (
          <input
            list="insert-players"
            value={insertForm.player}
            onChange={e => setInsertForm(f => ({ ...f, player: e.target.value }))}
            placeholder="player"
          />
        )}
        {showTarget && (
          <input
            list="insert-players"
            value={insertForm.target_player}
            onChange={e => setInsertForm(f => ({ ...f, target_player: e.target.value }))}
            placeholder="to"
          />
        )}
        {showOutcome && (
          <select
            value={insertForm.outcome}
            onChange={e => setInsertForm(f => ({ ...f, outcome: e.target.value as Outcome }))}
          >
            {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <datalist id="insert-players">
          {players.map(p => <option key={p} value={p} />)}
        </datalist>
        <button className="insert-submit" onClick={submitInsert}>Add</button>
        <button className="insert-cancel" onClick={() => setInsertingAfter(null)}>✕</button>
      </div>
    )
  }

  return (
    <div className="event-timeline">
      {[...possessionGroups].reverse().map((evs, gi) => {
        const pid = possessionGroups.length - gi
        // evs is in forward order; display reversed
        const reversedEvs = [...evs].reverse()
        return (
          <div key={gi} className="possession-group">
            <div className="possession-header">Possession {pid}</div>
            {reversedEvs.map(({ index, event: ev }, rowIdx) => {
              const isLast = index === events.length - 1
              const isExpanded = expanded === index
              const isEditingTime = editingTime === index
              // The event after this one in display order (i.e. the previous in actual order)
              const nextInOrder = rowIdx > 0 ? reversedEvs[rowIdx - 1].event : null
              return (
                <div key={index}>
                  {insertingAfter === ev.event_number ? (
                    renderInsertForm()
                  ) : (
                    <div
                      className="insert-between"
                      onClick={() => openInsert(
                        ev.event_number,
                        ev.timestamp,
                        nextInOrder?.timestamp ?? null
                      )}
                    >+</div>
                  )}
                  <div
                    className={[
                      'event-row',
                      isLast ? 'last-event' : '',
                      ev.event_type === 'possession_start' ? 'ev-start' : '',
                      ev.event_type === 'turnover' ? 'ev-turnover' : '',
                      ev.event_type === 'game-paused' ? 'ev-game-paused' : '',
                      ev.event_type === 'game-continued' ? 'ev-game-continued' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setExpanded(isExpanded ? null : index)}
                  >
                    <span className="ev-num">#{ev.event_number}</span>
                    {isEditingTime ? (
                      <input
                        ref={inputRef}
                        className="ev-time-input"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitEditTime(index)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEditTime(index)
                          if (e.key === 'Escape') setEditingTime(null)
                          e.stopPropagation()
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="ev-time"
                        title="Click to edit"
                        onClick={e => startEditTime(index, ev.timestamp, e)}
                      >
                        {formatTime(ev.timestamp)}
                      </span>
                    )}
                    <span className="ev-label">
                      {eventLabel(ev)}
                      {outcomeSuffix(ev)}
                    </span>
                    <button
                      className="ev-delete"
                      onClick={e => { e.stopPropagation(); onDeleteEvent(index) }}
                      title="Delete event"
                    >×</button>
                    {isExpanded && ev.event_type === 'pass' && (
                      <div className="outcome-picker" onClick={e => e.stopPropagation()}>
                        {OUTCOMES.map(o => (
                          <button
                            key={o}
                            className={`outcome-btn ${ev.outcome === o ? 'active' : ''}`}
                            onClick={() => {
                              onUpdateOutcome(index, o)
                              setExpanded(null)
                            }}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
