import { useState } from 'react'
import { createGame } from '../api'
import type { GameMeta } from '../types'

interface GameSetupProps {
  onGameCreated: (gameId: string, meta: Omit<GameMeta, 'id' | 'roster'>) => void
  onBack: () => void
}

export function GameSetup({ onGameCreated, onBack }: GameSetupProps) {
  const [teamName, setTeamName] = useState('')
  const [opponent, setOpponent] = useState('')
  const [tournament, setTournament] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opponent.trim()) return
    setLoading(true)
    const meta = { teamName: teamName.trim(), opponent: opponent.trim(), tournament: tournament.trim(), date }
    const { gameId } = await createGame(meta)
    setLoading(false)
    onGameCreated(gameId, meta)
  }

  return (
    <div className="setup-screen">
      <button className="btn-back" onClick={onBack}>← Back</button>
      <h2>New Game</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Our team
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            autoFocus
            placeholder="Team name"
          />
        </label>
        <label>
          Opponent
          <input
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            placeholder="Opponent team name"
          />
        </label>
        <label>
          Tournament
          <input
            type="text"
            value={tournament}
            onChange={e => setTournament(e.target.value)}
            placeholder="Tournament name (optional)"
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
