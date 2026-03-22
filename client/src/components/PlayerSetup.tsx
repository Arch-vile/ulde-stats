import { useState } from 'react'
import { updateGameMeta } from '../api'

function parseTimestamp(input: string): number {
  const parts = input.split(':').map(s => parseInt(s) || 0)
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

interface PlayerSetupProps {
  gameId: string
  opponent: string
  date: string
  onStart: (players: string[], initialTimestamp: number) => void
  onBack: () => void
}

export function PlayerSetup({ gameId, opponent, date, onStart, onBack }: PlayerSetupProps) {
  const [players, setPlayers] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [tsInput, setTsInput] = useState('0:00')
  const [loading, setLoading] = useState(false)

  const addPlayer = () => {
    const name = input.trim()
    if (!name || players.includes(name)) return
    setPlayers(p => [...p, name])
    setInput('')
  }

  const removePlayer = (name: string) => {
    setPlayers(p => p.filter(n => n !== name))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPlayer()
    }
  }

  const handleStart = async () => {
    if (players.length === 0) return
    setLoading(true)
    await updateGameMeta(gameId, { roster: players })
    setLoading(false)
    onStart(players, parseTimestamp(tsInput))
  }

  return (
    <div className="setup-screen">
      <button className="btn-back" onClick={onBack}>← Back</button>
      <h2>{date} vs {opponent}</h2>
      <h3>Roster</h3>
      <div className="player-input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Player name"
          autoFocus
        />
        <button className="btn-primary" onClick={addPlayer}>Add</button>
      </div>
      <div className="player-chips">
        {players.map(p => (
          <span key={p} className="chip">
            {p}
            <button className="chip-remove" onClick={() => removePlayer(p)}>×</button>
          </span>
        ))}
      </div>
      <div className="ts-row">
        <label>
          Video start time
          <input
            type="text"
            value={tsInput}
            onChange={e => setTsInput(e.target.value)}
            placeholder="0:00 or 1:23:45"
          />
        </label>
      </div>
      <button className="btn-primary btn-large" onClick={handleStart} disabled={players.length === 0 || loading}>
        {loading ? 'Saving...' : 'Start Recording'}
      </button>
    </div>
  )
}
