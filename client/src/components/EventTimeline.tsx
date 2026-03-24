import { useState } from 'react'
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

function hasMismatchedThrower(events: Event[], index: number): boolean {
  const ev = events[index]
  if (ev.event_type !== 'pass') return false
  for (let i = index - 1; i >= 0; i--) {
    const prev = events[i]
    if (prev.event_type === 'game-paused' || prev.event_type === 'game-continued') continue
    if (prev.event_type === 'pass' && prev.outcome === 'success') return ev.player !== prev.target_player
    return false // possession_start, turnover, or non-success pass — no expectation
  }
  return false
}

const OUTCOMES: Outcome[] = ['success', 'goal', 'drop', 'throwaway', 'goal-drop', 'goal-throwaway']
const EVENT_TYPES: EventType[] = ['possession_start', 'pass', 'turnover', 'game-paused', 'game-continued']

interface EntryForm {
  event_type: EventType
  player: string
  target_player: string
  outcome: Outcome
  timestamp: string
}

const emptyForm: EntryForm = {
  event_type: 'pass',
  player: '',
  target_player: '',
  outcome: 'success',
  timestamp: '',
}

interface EventTimelineProps {
  events: Event[]
  players: string[]
  onUpdateEvent: (index: number, fields: Partial<Omit<Event, 'event_number'>>) => void
  onDeleteEvent: (index: number) => void
  onInsertEvent: (afterEventNumber: number, event: Omit<Event, 'event_number'>) => void
}

export function EventTimeline({ events, players, onUpdateEvent, onDeleteEvent, onInsertEvent }: EventTimelineProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EntryForm>(emptyForm)
  const [insertingAfter, setInsertingAfter] = useState<number | null>(null)
  const [insertForm, setInsertForm] = useState<EntryForm>(emptyForm)

  function openInsert(afterEventNumber: number, prevTimestamp: number, nextTimestamp: number | null) {
    const mid = nextTimestamp !== null ? Math.round((prevTimestamp + nextTimestamp) / 2) : prevTimestamp
    setInsertingAfter(afterEventNumber)
    setEditingIndex(null)
    setInsertForm({ ...emptyForm, timestamp: formatTime(mid) })
  }

  function openEdit(index: number, ev: Event) {
    setEditingIndex(index)
    setInsertingAfter(null)
    setEditForm({
      event_type: ev.event_type,
      player: ev.player,
      target_player: ev.target_player,
      outcome: ev.event_type === 'pass' ? (ev.outcome as Outcome) : 'success',
      timestamp: formatTime(ev.timestamp),
    })
  }

  function buildEventFields(form: EntryForm): Omit<Event, 'event_number'> {
    const needsPlayer = form.event_type !== 'game-paused' && form.event_type !== 'game-continued'
    return {
      timestamp: parseTime(form.timestamp) ?? 0,
      event_type: form.event_type,
      player: needsPlayer ? form.player.trim() : '',
      target_player: form.event_type === 'pass' ? form.target_player.trim() : '',
      outcome: form.event_type === 'pass' ? form.outcome : form.event_type === 'turnover' ? 'turnover' : '',
    }
  }

  function isFormValid(form: EntryForm): boolean {
    if (parseTime(form.timestamp) === null) return false
    const needsPlayer = form.event_type !== 'game-paused' && form.event_type !== 'game-continued'
    if (needsPlayer && !form.player.trim()) return false
    if (form.event_type === 'pass' && !form.target_player.trim()) return false
    return true
  }

  function submitInsert() {
    if (insertingAfter === null || !isFormValid(insertForm)) return
    onInsertEvent(insertingAfter, buildEventFields(insertForm))
    setInsertingAfter(null)
  }

  function submitEdit(index: number) {
    if (!isFormValid(editForm)) return
    onUpdateEvent(index, buildEventFields(editForm))
    setEditingIndex(null)
  }

  function renderForm(
    form: EntryForm,
    setForm: React.Dispatch<React.SetStateAction<EntryForm>>,
    onSubmit: () => void,
    onCancel: () => void,
    submitLabel: string,
  ) {
    const showPlayer = form.event_type !== 'game-paused' && form.event_type !== 'game-continued'
    const showTarget = form.event_type === 'pass'
    const showOutcome = form.event_type === 'pass'
    return (
      <div className="insert-form" onClick={e => e.stopPropagation()}>
        <select
          value={form.event_type}
          onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))}
        >
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className="ev-time-input"
          value={form.timestamp}
          onChange={e => setForm(f => ({ ...f, timestamp: e.target.value }))}
          placeholder="m:ss"
        />
        {showPlayer && (
          <input
            list="timeline-players"
            value={form.player}
            onChange={e => setForm(f => ({ ...f, player: e.target.value }))}
            placeholder="player"
          />
        )}
        {showTarget && (
          <input
            list="timeline-players"
            value={form.target_player}
            onChange={e => setForm(f => ({ ...f, target_player: e.target.value }))}
            placeholder="to"
          />
        )}
        {showOutcome && (
          <select
            value={form.outcome}
            onChange={e => setForm(f => ({ ...f, outcome: e.target.value as Outcome }))}
          >
            {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <button className="insert-submit" onClick={onSubmit}>{submitLabel}</button>
        <button className="insert-cancel" onClick={onCancel}>✕</button>
      </div>
    )
  }

  const possessionGroups: { index: number; event: Event }[][] = []
  events.forEach((ev, i) => {
    if (ev.event_type === 'possession_start' || possessionGroups.length === 0) {
      possessionGroups.push([])
    }
    possessionGroups[possessionGroups.length - 1].push({ index: i, event: ev })
  })

  return (
    <div className="event-timeline">
      <datalist id="timeline-players">
        {players.map(p => <option key={p} value={p} />)}
      </datalist>
      {[...possessionGroups].reverse().map((evs, gi) => {
        const pid = possessionGroups.length - gi
        const reversedEvs = [...evs].reverse()
        return (
          <div key={gi} className="possession-group">
            <div className="possession-header">Possession {pid}</div>
            {reversedEvs.map(({ index, event: ev }, rowIdx) => {
              const isLast = index === events.length - 1
              const isEditing = editingIndex === index
              const nextInOrder = rowIdx > 0 ? reversedEvs[rowIdx - 1].event : null
              return (
                <div key={index}>
                  {insertingAfter === ev.event_number ? (
                    renderForm(insertForm, setInsertForm, submitInsert, () => setInsertingAfter(null), 'Add')
                  ) : (
                    <div
                      className="insert-between"
                      onClick={() => openInsert(ev.event_number, ev.timestamp, nextInOrder?.timestamp ?? null)}
                    >+</div>
                  )}
                  {isEditing ? (
                    renderForm(editForm, setEditForm, () => submitEdit(index), () => setEditingIndex(null), 'Save')
                  ) : (
                    <div
                      className={[
                        'event-row',
                        isLast ? 'last-event' : '',
                        ev.event_type === 'possession_start' ? 'ev-start' : '',
                        ev.event_type === 'turnover' ? 'ev-turnover' : '',
                        ev.event_type === 'game-paused' ? 'ev-game-paused' : '',
                        ev.event_type === 'game-continued' ? 'ev-game-continued' : '',
                        (index > 0 && ev.timestamp < events[index - 1].timestamp) || hasMismatchedThrower(events, index) ? 'ev-warn' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => openEdit(index, ev)}
                    >
                      <span className="ev-num">#{ev.event_number}</span>
                      <span className="ev-time">{formatTime(ev.timestamp)}</span>
                      <span className="ev-label">
                        {eventLabel(ev)}
                        {outcomeSuffix(ev)}
                      </span>
                      <button
                        className="ev-delete"
                        onClick={e => { e.stopPropagation(); onDeleteEvent(index) }}
                        title="Delete event"
                      >×</button>
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
