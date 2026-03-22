import { useState, useEffect } from 'react'

function formatTime(s: number): string {
  const sec = Math.floor(Math.abs(s))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

const SPEEDS = [0.5, 1, 2]

interface ClockBarProps {
  currentTime: () => number
  running: boolean
  speed: number
  onPause: () => void
  onResume: () => void
  onSpeedChange: (s: number) => void
}

export function ClockBar({ currentTime, running, speed, onPause, onResume, onSpeedChange }: ClockBarProps) {
  const [display, setDisplay] = useState(formatTime(currentTime()))

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplay(formatTime(currentTime()))
    }, 500)
    return () => clearInterval(interval)
  }, [currentTime])

  return (
    <div className="clock-bar">
      <span className="clock-time">{display}</span>
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
