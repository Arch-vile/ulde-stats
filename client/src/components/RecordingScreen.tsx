import { useEffect, useCallback } from 'react'
import { useClock } from '../hooks/useClock'
import { useGameState } from '../hooks/useGameState'
import { ClockBar } from './ClockBar'
import { PlayerGrid } from './PlayerGrid'
import { EventTimeline } from './EventTimeline'
import type { Event, Outcome } from '../types'

interface RecordingScreenProps {
  gameId: string
  players: string[]
  initialTimestamp: number
  existingEvents?: Event[]
}

export function RecordingScreen({ gameId, players, initialTimestamp, existingEvents }: RecordingScreenProps) {
  const clock = useClock()
  const gs = useGameState()

  const toggleClock = useCallback(() => {
    if (clock.state.running) clock.pause()
    else clock.resume()
  }, [clock])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        toggleClock()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleClock])

  useEffect(() => {
    if (existingEvents && existingEvents.length > 0) {
      gs.initFromEvents(gameId, existingEvents)
      const lastTs = existingEvents[existingEvents.length - 1].timestamp
      clock.setInitialTimestamp(lastTs)
    } else {
      gs.initGame(gameId, players)
      clock.setInitialTimestamp(initialTimestamp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlayerClick = (name: string) => {
    gs.recordPlayerClick(name, clock.currentTime())
  }

  const handleTurnover = () => {
    gs.recordTurnover(clock.currentTime())
  }

  const handleUpdateOutcome = (index: number, outcome: Outcome) => {
    gs.updateEventOutcome(index, outcome)
  }

  const handleUpdateTimestamp = (index: number, timestamp: number) => {
    gs.updateEventTimestamp(index, timestamp)
  }

  const handleDeleteEvent = (index: number) => {
    gs.deleteGameEvent(index)
  }

  const events = gs.state.events
  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const lastIsPass = lastEvent?.event_type === 'pass'
  const lastEventIndex = events.length - 1

  const handleOutcome = (outcome: Outcome) => {
    if (lastIsPass) handleUpdateOutcome(lastEventIndex, outcome)
  }

  const OUTCOME_BUTTONS: { label: string; outcome: Outcome; className: string }[] = [
    { label: 'GOAL', outcome: 'goal', className: 'btn-outcome-goal' },
    { label: 'DROP', outcome: 'drop', className: 'btn-outcome-bad' },
    { label: 'THROWAWAY', outcome: 'throwaway', className: 'btn-outcome-bad' },
    { label: 'GOAL DROP', outcome: 'goal-drop', className: 'btn-outcome-bad' },
    { label: 'GOAL TA', outcome: 'goal-throwaway', className: 'btn-outcome-bad' },
  ]

  return (
    <div className="recording-screen">
      <ClockBar
        currentTime={clock.currentTime}
        running={clock.state.running}
        speed={clock.state.speed}
        onPause={clock.pause}
        onResume={clock.resume}
        onSpeedChange={clock.setSpeed}
        onSeek={clock.seekTo}
      />
      <div className="recording-main">
        <div className="recording-left">
          <PlayerGrid
            players={gs.state.players}
            currentPlayer={gs.state.currentPlayer}
            needsPossessionStart={gs.state.needsPossessionStart}
            onPlayerClick={handlePlayerClick}
          />
          <div className="action-bar">
            {OUTCOME_BUTTONS.map(({ label, outcome, className }) => (
              <button
                key={outcome}
                className={`btn-action ${className} ${lastIsPass && lastEvent?.outcome === outcome ? 'active' : ''}`}
                onClick={() => handleOutcome(outcome)}
                disabled={!lastIsPass}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="btn-turnover"
            onClick={handleTurnover}
            disabled={gs.state.needsPossessionStart}
          >
            TURNOVER
          </button>
          <button
            className={`btn-game-pause ${gs.state.isPaused ? 'active' : ''}`}
            onClick={() => gs.state.isPaused
              ? gs.recordGameContinue(clock.currentTime())
              : gs.recordGamePause(clock.currentTime())
            }
          >
            {gs.state.isPaused ? 'GAME CONTINUED' : 'GAME PAUSED'}
          </button>
        </div>
        <div className="recording-right">
          <EventTimeline
            events={gs.state.events}
            onUpdateOutcome={handleUpdateOutcome}
            onUpdateTimestamp={handleUpdateTimestamp}
            onDeleteEvent={handleDeleteEvent}
          />
        </div>
      </div>
    </div>
  )
}
