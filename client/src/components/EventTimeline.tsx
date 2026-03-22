import { useState, useRef, useEffect } from 'react'
import type { Event, Outcome } from '../types'

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
  return `${ev.player} → ${ev.target_player}`
}

function outcomeSuffix(ev: Event): string {
  if (ev.event_type !== 'pass') return ''
  if (ev.outcome === 'goal') return ' ✓ GOAL'
  if (ev.outcome === 'drop') return ' ✗ drop'
  if (ev.outcome === 'throwaway') return ' ✗ throwaway'
  return ''
}

const OUTCOMES: Outcome[] = ['success', 'goal', 'drop', 'throwaway']

interface EventTimelineProps {
  events: Event[]
  onUpdateOutcome: (index: number, outcome: Outcome) => void
  onUpdateTimestamp: (index: number, timestamp: number) => void
  onDeleteEvent: (index: number) => void
}

export function EventTimeline({ events, onUpdateOutcome, onUpdateTimestamp, onDeleteEvent }: EventTimelineProps) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [editingTime, setEditingTime] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
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

  const possessions = new Map<number, { index: number; event: Event }[]>()
  events.forEach((ev, i) => {
    if (!possessions.has(ev.possession_id)) possessions.set(ev.possession_id, [])
    possessions.get(ev.possession_id)!.push({ index: i, event: ev })
  })

  const possessionIds = [...possessions.keys()].sort((a, b) => b - a)

  return (
    <div className="event-timeline">
      {possessionIds.map(pid => {
        const evs = possessions.get(pid)!
        return (
          <div key={pid} className="possession-group">
            <div className="possession-header">Possession {pid}</div>
            {[...evs].reverse().map(({ index, event: ev }) => {
              const isLast = index === events.length - 1
              const isExpanded = expanded === index
              const isEditingTime = editingTime === index
              return (
                <div
                  key={index}
                  className={[
                    'event-row',
                    isLast ? 'last-event' : '',
                    ev.event_type === 'possession_start' ? 'ev-start' : '',
                    ev.event_type === 'turnover' ? 'ev-turnover' : '',
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
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
