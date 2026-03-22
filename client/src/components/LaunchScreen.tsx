import { useState, useEffect } from 'react'
import type { GameMeta, Event } from '../types'
import { listGames, loadGame } from '../api'

interface LaunchScreenProps {
  onNewGame: () => void
  onOpenGame: (gameId: string, meta: GameMeta, events: Event[]) => void
}

export function LaunchScreen({ onNewGame, onOpenGame }: LaunchScreenProps) {
  const [games, setGames] = useState<GameMeta[] | null>(null)
  const [showList, setShowList] = useState(false)

  useEffect(() => {
    if (showList) {
      listGames().then(setGames)
    }
  }, [showList])

  const handleOpen = async (gameId: string) => {
    const { meta, events } = await loadGame(gameId)
    onOpenGame(gameId, meta, events)
  }

  return (
    <div className="launch-screen">
      <h1>ulde stats</h1>
      <div className="launch-buttons">
        <button className="btn-primary btn-large" onClick={onNewGame}>
          New Game
        </button>
        <button className="btn-secondary btn-large" onClick={() => setShowList(true)}>
          Open Existing
        </button>
      </div>
      {showList && (
        <div className="game-list">
          {games === null ? (
            <p className="muted">Loading...</p>
          ) : games.length === 0 ? (
            <p className="muted">No games found.</p>
          ) : (
            games.map(g => (
              <button key={g.id} className="game-list-item" onClick={() => handleOpen(g.id)}>
                {g.date} — {g.opponent}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
