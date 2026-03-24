import { useState, useRef, useCallback } from 'react'
import type { Event, Outcome } from '../types'
import { saveEvent, insertEvent as insertEventApi, updateEvent, deleteEvent as deleteEventApi } from '../api'

interface GameState {
  gameId: string
  events: Event[]
  // Index of the most recently saved pass — tracked so outcome edits know which event to update
  pendingPassIndex: number | null
  players: string[]
  currentPlayer: string
  needsPossessionStart: boolean
  isPaused: boolean
}

function deriveState(
  events: Event[],
): Pick<GameState, 'currentPlayer' | 'needsPossessionStart' | 'isPaused'> {
  if (events.length === 0) return { currentPlayer: '', needsPossessionStart: true, isPaused: false }

  let currentPlayer = ''
  let needsPossessionStart = true
  let isPaused = false

  for (const ev of events) {
    if (ev.event_type === 'possession_start') {
      currentPlayer = ev.player
      needsPossessionStart = false
    } else if (ev.event_type === 'pass') {
      if (ev.outcome === 'success') {
        currentPlayer = ev.target_player
        needsPossessionStart = false
      } else if (ev.outcome === 'drop' || ev.outcome === 'throwaway' || ev.outcome === 'goal' || ev.outcome === 'goal-drop' || ev.outcome === 'goal-throwaway') {
        needsPossessionStart = true
      }
    } else if (ev.event_type === 'turnover') {
      needsPossessionStart = true
    } else if (ev.event_type === 'game-paused') {
      isPaused = true
    } else if (ev.event_type === 'game-continued') {
      isPaused = false
    }
  }

  return { currentPlayer, needsPossessionStart, isPaused }
}

const initialState: GameState = {
  gameId: '',
  events: [],
  pendingPassIndex: null,
  players: [],
  currentPlayer: '',
  needsPossessionStart: true,
  isPaused: false,
}

export function useGameState() {
  const [state, setState] = useState<GameState>(initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const initGame = useCallback((gameId: string, players: string[]) => {
    setState({ ...initialState, gameId, players })
  }, [])

  const initFromEvents = useCallback(
    (gameId: string, events: Event[], extraPlayers: string[] = []) => {
      const playerSet = new Set<string>(extraPlayers)
      events.forEach(e => {
        if (e.player) playerSet.add(e.player)
        if (e.target_player) playerSet.add(e.target_player)
      })
      const lastIdx = events.length - 1
      const lastIsPass = events[lastIdx]?.event_type === 'pass'
      setState({
        ...initialState,
        gameId,
        events,
        pendingPassIndex: lastIsPass ? lastIdx : null,
        players: [...playerSet],
        ...deriveState(events),
      })
    },
    [],
  )

  const recordPlayerClick = useCallback((playerName: string, timestamp: number) => {
    const s = stateRef.current

    if (s.needsPossessionStart) {
      const event: Event = {
        timestamp,
        event_type: 'possession_start',
        player: playerName,
        target_player: '',
        outcome: '',
        event_number: s.events.length + 1,
      }
      void saveEvent(s.gameId, event)
      setState(prev => ({
        ...prev,
        events: [...prev.events, event],
        currentPlayer: playerName,
        needsPossessionStart: false,
        pendingPassIndex: null,
      }))
    } else {
      const event: Event = {
        timestamp,
        event_type: 'pass',
        player: s.currentPlayer,
        target_player: playerName,
        outcome: 'success',
        event_number: s.events.length + 1,
      }
      void saveEvent(s.gameId, event)
      setState(prev => ({
        ...prev,
        events: [...prev.events, event],
        currentPlayer: playerName,
        pendingPassIndex: prev.events.length,
        needsPossessionStart: false,
      }))
    }
  }, [])

  const recordTurnover = useCallback((timestamp: number) => {
    const s = stateRef.current
    if (s.needsPossessionStart) return

    const event: Event = {
      timestamp,
      event_type: 'turnover',
      player: s.currentPlayer,
      target_player: '',
      outcome: 'turnover',
      event_number: s.events.length + 1,
    }
    void saveEvent(s.gameId, event)
    setState(prev => ({
      ...prev,
      events: [...prev.events, event],
      pendingPassIndex: null,
      needsPossessionStart: true,
    }))
  }, [])

  const updateEventOutcome = useCallback((index: number, outcome: Outcome) => {
    const s = stateRef.current
    const isTerminal = outcome === 'goal' || outcome === 'drop' || outcome === 'throwaway' || outcome === 'goal-drop' || outcome === 'goal-throwaway'
    const isPending = s.pendingPassIndex === index
    const updated = { ...s.events[index], outcome }
    void updateEvent(s.gameId, updated)
    setState(prev => {
      const newEvents = prev.events.map((e, i) => (i === index ? updated : e))
      const newPendingPassIndex = isPending && isTerminal ? null : prev.pendingPassIndex
      const derived = deriveState(newEvents)
      const currentPlayer = newPendingPassIndex !== null ? prev.currentPlayer : derived.currentPlayer
      return { ...prev, events: newEvents, pendingPassIndex: newPendingPassIndex, ...derived, currentPlayer }
    })
  }, [])

  const updateEventTimestamp = useCallback((index: number, timestamp: number) => {
    const s = stateRef.current
    const updated = { ...s.events[index], timestamp }
    void updateEvent(s.gameId, updated)
    setState(prev => ({
      ...prev,
      events: prev.events.map((e, i) => (i === index ? updated : e)),
    }))
  }, [])

  const insertGameEvent = useCallback((afterEventNumber: number, event: Omit<Event, 'event_number'>) => {
    const s = stateRef.current
    void insertEventApi(s.gameId, afterEventNumber, event).then(events => {
      setState(prev => ({ ...prev, events, pendingPassIndex: null, ...deriveState(events) }))
    })
  }, [])

  const deleteGameEvent = useCallback((index: number) => {
    const s = stateRef.current
    void deleteEventApi(s.gameId, s.events[index].event_number).then(events => {
      setState(prev => {
        let newPendingPassIndex = prev.pendingPassIndex
        if (prev.pendingPassIndex === index) {
          newPendingPassIndex = null
        } else if (prev.pendingPassIndex !== null && prev.pendingPassIndex > index) {
          newPendingPassIndex = prev.pendingPassIndex - 1
        }
        const derived = deriveState(events)
        const currentPlayer = newPendingPassIndex !== null ? prev.currentPlayer : derived.currentPlayer
        return { ...prev, events, pendingPassIndex: newPendingPassIndex, ...derived, currentPlayer }
      })
    })
  }, [])

  const recordGamePause = useCallback((timestamp: number) => {
    const s = stateRef.current
    const event: Event = {
      timestamp,
      event_type: 'game-paused',
      player: '',
      target_player: '',
      outcome: '',
      event_number: s.events.length + 1,
    }
    void saveEvent(s.gameId, event)
    setState(prev => ({
      ...prev,
      events: [...prev.events, event],
      isPaused: true,
    }))
  }, [])

  const recordGameContinue = useCallback((timestamp: number) => {
    const s = stateRef.current
    const event: Event = {
      timestamp,
      event_type: 'game-continued',
      player: '',
      target_player: '',
      outcome: '',
      event_number: s.events.length + 1,
    }
    void saveEvent(s.gameId, event)
    setState(prev => ({
      ...prev,
      events: [...prev.events, event],
      isPaused: false,
    }))
  }, [])

  const addPlayer = useCallback((name: string) => {
    setState(prev => {
      if (prev.players.includes(name)) return prev
      return { ...prev, players: [...prev.players, name] }
    })
  }, [])

  return {
    state,
    initGame,
    initFromEvents,
    recordPlayerClick,
    recordTurnover,
    recordGamePause,
    recordGameContinue,
    updateEventOutcome,
    updateEventTimestamp,
    insertGameEvent,
    deleteGameEvent,
    addPlayer,
  }
}
