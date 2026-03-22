import { useState, useRef, useCallback } from 'react'
import type { Event, Outcome } from '../types'
import { saveEvent, updateEvent, deleteEvent as deleteEventApi } from '../api'

interface GameState {
  gameId: string
  events: Event[]
  // Index of the most recently saved pass — tracked so outcome edits know which event to update
  pendingPassIndex: number | null
  players: string[]
  currentPlayer: string
  possessionId: number
  needsPossessionStart: boolean
}

function deriveState(
  events: Event[],
): Pick<GameState, 'currentPlayer' | 'possessionId' | 'needsPossessionStart'> {
  if (events.length === 0) return { currentPlayer: '', possessionId: 0, needsPossessionStart: true }

  let currentPlayer = ''
  let possessionId = 0
  let needsPossessionStart = true

  for (const ev of events) {
    possessionId = ev.possession_id
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
    }
  }

  return { currentPlayer, possessionId, needsPossessionStart }
}

const initialState: GameState = {
  gameId: '',
  events: [],
  pendingPassIndex: null,
  players: [],
  currentPlayer: '',
  possessionId: 0,
  needsPossessionStart: true,
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
      const nextPossessionId = s.possessionId + 1
      const event: Event = {
        timestamp,
        event_type: 'possession_start',
        player: playerName,
        target_player: '',
        outcome: '',
        possession_id: nextPossessionId,
        event_number: s.events.length + 1,
      }
      void saveEvent(s.gameId, event)
      setState(prev => ({
        ...prev,
        events: [...prev.events, event],
        currentPlayer: playerName,
        possessionId: nextPossessionId,
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
        possession_id: s.possessionId,
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
      possession_id: s.possessionId,
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
    setState(prev => ({
      ...prev,
      events: prev.events.map((e, i) => (i === index ? updated : e)),
      pendingPassIndex: isPending && isTerminal ? null : prev.pendingPassIndex,
      needsPossessionStart: isPending && isTerminal ? true : prev.needsPossessionStart,
    }))
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
    updateEventOutcome,
    updateEventTimestamp,
    deleteGameEvent,
    addPlayer,
  }
}
