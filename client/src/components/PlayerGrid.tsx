interface PlayerGridProps {
  players: string[]
  currentPlayer: string
  needsPossessionStart: boolean
  onPlayerClick: (name: string) => void
}

export function PlayerGrid({ players, currentPlayer, needsPossessionStart, onPlayerClick }: PlayerGridProps) {
  return (
    <div className="player-grid">
      {players.map(p => (
        <button
          key={p}
          className={[
            'player-btn',
            p === currentPlayer && !needsPossessionStart ? 'current' : '',
            needsPossessionStart ? 'needs-start' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onPlayerClick(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
