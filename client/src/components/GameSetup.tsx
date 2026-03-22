import { useState } from 'react'
import { createGame } from '../api'

interface GameSetupProps {
  onGameCreated: (gameId: string, opponent: string, date: string) => void
  onBack: () => void
}

export function GameSetup({ onGameCreated, onBack }: GameSetupProps) {
  const [opponent, setOpponent] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opponent.trim()) return
    setLoading(true)
    const { gameId } = await createGame(opponent.trim(), date)
    setLoading(false)
    onGameCreated(gameId, opponent.trim(), date)
  }

  return (
    <div className="setup-screen">
      <button className="btn-back" onClick={onBack}>
        ← Back
      </button>
      <h2>New Game</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Opponent
          <input
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            autoFocus
            placeholder="Team name"
          />
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={!opponent.trim() || loading}>
          {loading ? 'Creating...' : 'Create Game'}
        </button>
      </form>
    </div>
  )
}
