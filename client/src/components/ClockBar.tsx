import { useState, useEffect, useRef } from 'react'

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

const SPEEDS = [0.5, 1, 2]

interface ClockBarProps {
  currentTime: () => number
  running: boolean
  speed: number
  onPause: () => void
  onResume: () => void
  onSpeedChange: (s: number) => void
  onSeek: (seconds: number) => void
}

export function ClockBar({ currentTime, running, speed, onPause, onResume, onSpeedChange, onSeek }: ClockBarProps) {
  const [display, setDisplay] = useState(formatTime(currentTime()))
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) return
    const interval = setInterval(() => {
      setDisplay(formatTime(currentTime()))
    }, 500)
    return () => clearInterval(interval)
  }, [currentTime, editing])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEdit() {
    setEditValue(formatTime(currentTime()))
    setEditing(true)
  }

  function commit() {
    const parsed = parseTime(editValue)
    if (parsed !== null) onSeek(parsed)
    setEditing(false)
  }

  return (
    <div className="clock-bar">
      {editing ? (
        <input
          ref={inputRef}
          className="clock-time-input"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
            e.stopPropagation()
          }}
        />
      ) : (
        <span className="clock-time" style={{ cursor: 'pointer' }} onClick={startEdit} title="Click to set time">
          {display}
        </span>
      )}
      <button className="btn-icon" onClick={running ? onPause : onResume}>
        {running ? '⏸' : '▶'}
      </button>
      <div className="speed-selector">
        {SPEEDS.map(s => (
          <button
            key={s}
            className={`btn-speed ${speed === s ? 'active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
