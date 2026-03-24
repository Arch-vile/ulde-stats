import { useState, useEffect, useCallback, useRef } from 'react'
import { useClock } from '../hooks/useClock'
import { useGameState } from '../hooks/useGameState'
import { ClockBar } from './ClockBar'
import { PlayerGrid } from './PlayerGrid'
import { EventTimeline } from './EventTimeline'
import { GameMetaEditor } from './GameMetaEditor'
import { YouTubePlayer, type YouTubePlayerHandle } from './YouTubePlayer'
import type { Event, Outcome } from '../types'

interface GameMeta {
  teamName: string
  opponent: string
  tournament: string
  date: string
  videoUrl: string
}

interface RecordingScreenProps {
  gameId: string
  meta: GameMeta
  players: string[]
  initialTimestamp: number
  existingEvents?: Event[]
}

export function RecordingScreen({ gameId, meta: initialMeta, players, initialTimestamp, existingEvents }: RecordingScreenProps) {
  const clock = useClock()
  const gs = useGameState()
  const [meta, setMeta] = useState(initialMeta)
  const [showMetaEditor, setShowMetaEditor] = useState(false)
  const ytRef = useRef<YouTubePlayerHandle | null>(null)

  const toggleClock = useCallback(() => {
    if (clock.state.running) {
      clock.pause()
      ytRef.current?.pause()
    } else {
      clock.resume()
      ytRef.current?.play()
    }
  }, [clock.state.running, clock.pause, clock.resume])

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
    const hasVideo = !!initialMeta.videoUrl
    if (existingEvents && existingEvents.length > 0) {
      gs.initFromEvents(gameId, existingEvents, players)
      const lastTs = existingEvents[existingEvents.length - 1].timestamp
      if (hasVideo) {
        clock.seekTo(lastTs)
      } else {
        clock.setInitialTimestamp(lastTs)
      }
    } else {
      gs.initGame(gameId, players)
      if (hasVideo) {
        clock.seekTo(initialTimestamp)
      } else {
        clock.setInitialTimestamp(initialTimestamp)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When video is present, read time directly from the YT player for accuracy
  const getTime = useCallback(() => {
    return ytRef.current?.getCurrentTime() ?? clock.currentTime()
  }, [clock.currentTime])

  // Video events sync the app clock
  const handleYTPlay = useCallback((t: number) => {
    clock.seekTo(t)
    clock.resume()
  }, [clock.seekTo, clock.resume])

  const handleYTPause = useCallback((t: number) => {
    clock.seekTo(t)
    clock.pause()
  }, [clock.seekTo, clock.pause])

  // ClockBar controls also drive the video
  const handlePause = useCallback(() => {
    clock.pause()
    ytRef.current?.pause()
  }, [clock.pause])

  const handleResume = useCallback(() => {
    clock.resume()
    ytRef.current?.play()
  }, [clock.resume])

  const handleSeek = useCallback((s: number) => {
    clock.seekTo(s)
    ytRef.current?.seekTo(s)
  }, [clock.seekTo])

  const handleSpeedChange = useCallback((s: number) => {
    clock.setSpeed(s)
    ytRef.current?.setPlaybackRate(s)
  }, [clock.setSpeed])

  const handlePlayerClick = (name: string) => {
    gs.recordPlayerClick(name, getTime())
  }

  const handleTurnover = () => {
    gs.recordTurnover(getTime())
  }

  const handleUpdateOutcome = (index: number, outcome: Outcome) => {
    gs.updateEventOutcome(index, outcome)
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
      <div className="recording-game-header">
        <div className="recording-game-info">
          <span className="recording-game-date">{meta.date}</span>
          <span className="recording-game-matchup">
            {meta.teamName ? `${meta.teamName} vs ` : ''}{meta.opponent}
            {meta.tournament ? ` · ${meta.tournament}` : ''}
          </span>
        </div>
        <button className="btn-text" onClick={() => setShowMetaEditor(true)}>Edit</button>
      </div>
      {showMetaEditor && (
        <GameMetaEditor
          gameId={gameId}
          initial={meta}
          onSave={updated => { setMeta(updated); setShowMetaEditor(false) }}
          onClose={() => setShowMetaEditor(false)}
        />
      )}
      <div className="recording-body">
        <div className="recording-video-area">
          {meta.videoUrl ? (
            <YouTubePlayer
              ref={ytRef}
              videoUrl={meta.videoUrl}
              initialTime={initialTimestamp}
              onPlay={handleYTPlay}
              onPause={handleYTPause}
            />
          ) : (
            <span className="recording-no-video">No video URL set</span>
          )}
        </div>
        <div className="recording-sidebar">
          <ClockBar
            currentTime={getTime}
            running={clock.state.running}
            speed={clock.state.speed}
            onPause={handlePause}
            onResume={handleResume}
            onSpeedChange={handleSpeedChange}
            onSeek={handleSeek}
          />
          <div className="recording-sidebar-controls">
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
                ? gs.recordGameContinue(getTime())
                : gs.recordGamePause(getTime())
              }
            >
              {gs.state.isPaused ? 'GAME CONTINUED' : 'GAME PAUSED'}
            </button>
          </div>
          <div className="recording-sidebar-timeline">
            <EventTimeline
              events={gs.state.events}
              players={gs.state.players}
              onUpdateEvent={gs.updateGameEvent}
              onDeleteEvent={handleDeleteEvent}
              onInsertEvent={gs.insertGameEvent}
              onSeek={handleSeek}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
