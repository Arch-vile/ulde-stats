import { useState } from 'react'
import { LaunchScreen } from './components/LaunchScreen'
import { GameSetup } from './components/GameSetup'
import { PlayerSetup } from './components/PlayerSetup'
import { RecordingScreen } from './components/RecordingScreen'
import { AnalysisScreen } from './components/AnalysisScreen'
import type { AppPhase, Event, GameMeta } from './types'
import './App.css'

interface GameContext {
  gameId: string
  teamName: string
  opponent: string
  tournament: string
  date: string
  players: string[]
  initialTimestamp: number
  existingEvents?: Event[]
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('idle')
  const [ctx, setCtx] = useState<GameContext | null>(null)

  const handleGameCreated = (gameId: string, meta: Omit<GameMeta, 'id' | 'roster'>) => {
    setCtx({ gameId, ...meta, players: [], initialTimestamp: 0 })
    setPhase('playerSetup')
  }

  const handlePlayerSetupDone = (players: string[], initialTimestamp: number) => {
    setCtx(c => (c ? { ...c, players, initialTimestamp } : c))
    setPhase('recording')
  }

  const handleOpenGame = (_gameId: string, meta: GameMeta, events: Event[]) => {
    setCtx({
      gameId: meta.id,
      teamName: meta.teamName,
      opponent: meta.opponent,
      tournament: meta.tournament,
      date: meta.date,
      players: meta.roster,
      initialTimestamp: events.length > 0 ? events[events.length - 1].timestamp : 0,
      existingEvents: events,
    })
    setPhase('recording')
  }

  return (
    <div className="app">
      {phase === 'idle' && (
        <LaunchScreen onNewGame={() => setPhase('setup')} onOpenGame={handleOpenGame} onAnalysis={() => setPhase('analysis')} />
      )}
      {phase === 'setup' && (
        <GameSetup onGameCreated={handleGameCreated} onBack={() => setPhase('idle')} />
      )}
      {phase === 'playerSetup' && ctx && (
        <PlayerSetup
          gameId={ctx.gameId}
          opponent={ctx.opponent}
          date={ctx.date}
          onStart={handlePlayerSetupDone}
          onBack={() => setPhase('setup')}
        />
      )}
      {phase === 'analysis' && (
        <AnalysisScreen onBack={() => setPhase('idle')} />
      )}
      {phase === 'recording' && ctx && (
        <RecordingScreen
          gameId={ctx.gameId}
          players={ctx.players}
          initialTimestamp={ctx.initialTimestamp}
          existingEvents={ctx.existingEvents}
        />
      )}
    </div>
  )
}
