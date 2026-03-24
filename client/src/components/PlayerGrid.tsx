import { useState, useEffect } from 'react'

const COLS = 6
const ROWS = 5

interface Pos { row: number; col: number }
type Positions = Record<string, Pos>

function initPositions(players: string[]): Positions {
  const pos: Positions = {}
  players.forEach((p, i) => {
    pos[p] = { row: Math.floor(i / COLS), col: i % COLS }
  })
  return pos
}

interface PlayerGridProps {
  players: string[]
  currentPlayer: string
  needsPossessionStart: boolean
  onPlayerClick: (name: string) => void
}

export function PlayerGrid({ players, currentPlayer, needsPossessionStart, onPlayerClick }: PlayerGridProps) {
  const [isPositioning, setIsPositioning] = useState(false)
  const [positions, setPositions] = useState<Positions>(() => initPositions(players))
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null) // "row,col"

  // Assign a position to any newly added player
  useEffect(() => {
    setPositions(prev => {
      const occupied = new Set(Object.values(prev).map(p => `${p.row},${p.col}`))
      let changed = false
      const next = { ...prev }
      players.forEach(p => {
        if (next[p]) return
        for (let i = 0; i < COLS * ROWS; i++) {
          const key = `${Math.floor(i / COLS)},${i % COLS}`
          if (!occupied.has(key)) {
            next[p] = { row: Math.floor(i / COLS), col: i % COLS }
            occupied.add(key)
            changed = true
            break
          }
        }
      })
      return changed ? next : prev
    })
  }, [players])

  function playerAtCell(row: number, col: number): string | null {
    return players.find(p => positions[p]?.row === row && positions[p]?.col === col) ?? null
  }

  function handleDrop(row: number, col: number) {
    if (!dragging) return
    const occupant = playerAtCell(row, col)
    setPositions(prev => {
      const next = { ...prev }
      if (occupant && occupant !== dragging) {
        next[occupant] = prev[dragging]  // swap
      }
      next[dragging] = { row, col }
      return next
    })
    setDragging(null)
    setDragOverCell(null)
  }

  const cellKey = (r: number, c: number) => `${r},${c}`

  return (
    <div className="player-grid-wrap">
      <div className="player-grid-toolbar">
        {isPositioning
          ? <button className="btn-text" onClick={() => setIsPositioning(false)}>Done</button>
          : <button className="btn-text" onClick={() => setIsPositioning(true)}>Position</button>
        }
      </div>
      <div className={`player-canvas${isPositioning ? ' positioning' : ''}`}>
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const player = playerAtCell(row, col)
            const key = cellKey(row, col)
            const isOver = isPositioning && dragOverCell === key && player !== dragging
            return (
              <div
                key={key}
                className={['canvas-cell', isOver ? 'drag-over' : ''].filter(Boolean).join(' ')}
                onDragOver={isPositioning ? e => { e.preventDefault(); setDragOverCell(key) } : undefined}
                onDragLeave={isPositioning ? () => setDragOverCell(prev => prev === key ? null : prev) : undefined}
                onDrop={isPositioning ? () => handleDrop(row, col) : undefined}
              >
                {player && (
                  <button
                    className={[
                      'player-btn',
                      !isPositioning && player === currentPlayer && !needsPossessionStart ? 'current' : '',
                      !isPositioning && needsPossessionStart ? 'needs-start' : '',
                      isPositioning && player === dragging ? 'dragging' : '',
                    ].filter(Boolean).join(' ')}
                    draggable={isPositioning}
                    onClick={() => { if (!isPositioning) onPlayerClick(player) }}
                    onDragStart={isPositioning ? () => setDragging(player) : undefined}
                    onDragEnd={isPositioning ? () => { setDragging(null); setDragOverCell(null) } : undefined}
                  >
                    {player}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
