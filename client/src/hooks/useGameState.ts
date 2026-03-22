import { useState, useRef, useCallback } from 'react'
import type { Event, Outcome } from '../types'
import { saveEvent, updateEvent, deleteEvent as deleteEventApi } from '../api'

interface GameState {
  gameId: string
  events: Event[]
  // Index of a saved pass whose target_player is still empty.
  // Filled in when the next player click confirms the receiver.
  pendingPassIndex: number | null
  players: string[]
  currentPlayer: string
  possessionId: number
  needsPossessionStart: boolean
}

// Only used for initFromEvents (loading from disk). During live recording,
// currentPlayer is tracked explicitly to avoid confusion from empty target_player.
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
        // If target is empty (pending from a previous session), keep the thrower as current
        currentPlayer = ev.target_player !== '' ? ev.target_player : ev.player
        needsPossessionStart = false
      } else if (ev.outcome === 'drop' || ev.outcome === 'throwaway' || ev.outcome === 'goal') {
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
      const lastEvent = events[events.length - 1]
      const pendingPassIndex =
        lastEvent?.event_type === 'pass' &&
        lastEvent?.target_player === '' &&
        lastEvent?.outcome === 'success'
          ? events.length - 1
          : null
      setState({
        ...initialState,
        gameId,
        events,
        pendingPassIndex,
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
      // If there's a pending pass, the current click confirms its receiver (s.currentPlayer)
      if (s.pendingPassIndex !== null) {
        const confirmed = { ...s.events[s.pendingPassIndex], target_player: s.currentPlayer }
        void updateEvent(s.gameId, confirmed)
      }

      // Save the new pass immediately with empty target — receiver confirmed on next click
      const event: Event = {
        timestamp,
        event_type: 'pass',
        player: s.currentPlayer,
        target_player: '',
        outcome: 'success',
        possession_id: s.possessionId,
        event_number: s.events.length + 1,
      }
      void saveEvent(s.gameId, event)

      setState(prev => {
        const updated = prev.pendingPassIndex !== null
          ? prev.events.map((e, i) =>
              i === prev.pendingPassIndex ? { ...e, target_player: prev.currentPlayer } : e
            )
          : [...prev.events]
        updated.push(event)
        return {
          ...prev,
          events: updated,
          currentPlayer: playerName,
          pendingPassIndex: updated.length - 1,
          needsPossessionStart: false,
        }
      })
    }
  }, [])

  const recordTurnover = useCallback((timestamp: number) => {
    const s = stateRef.current
    if (s.needsPossessionStart) return

    // Confirm the pending pass receiver before recording the turnover
    if (s.pendingPassIndex !== null) {
      const confirmed = { ...s.events[s.pendingPassIndex], target_player: s.currentPlayer }
      void updateEvent(s.gameId, confirmed)
    }

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

    setState(prev => {
      const updated = prev.pendingPassIndex !== null
        ? prev.events.map((e, i) =>
            i === prev.pendingPassIndex ? { ...e, target_player: prev.currentPlayer } : e
          )
        : [...prev.events]
      updated.push(event)
      return { ...prev, events: updated, pendingPassIndex: null, needsPossessionStart: true }
    })
  }, [])

  const updateEventOutcome = useCallback((index: number, outcome: Outcome) => {
    const s = stateRef.current
    const isPending = s.pendingPassIndex === index
    const isTerminal = outcome === 'goal' || outcome === 'drop' || outcome === 'throwaway'

    // For goal/drop on pending pass, fill in the receiver we know from currentPlayer
    const target_player =
      isPending && (outcome === 'goal' || outcome === 'drop')
        ? s.currentPlayer
        : s.events[index].target_player

    const updated = { ...s.events[index], outcome, target_player }
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
    void deleteEventApi(s.gameId, s.events[index].event_number)

    setState(prev => {
      const newEvents = prev.events.filter((_, i) => i !== index)

      let newPendingPassIndex = prev.pendingPassIndex
      if (prev.pendingPassIndex === index) {
        newPendingPassIndex = null
      } else if (prev.pendingPassIndex !== null && prev.pendingPassIndex > index) {
        newPendingPassIndex = prev.pendingPassIndex - 1
      }

      const derived = deriveState(newEvents)
      // If there's still a pending pass, currentPlayer was set explicitly — preserve it
      const currentPlayer = newPendingPassIndex !== null ? prev.currentPlayer : derived.currentPlayer

      return {
        ...prev,
        events: newEvents,
        pendingPassIndex: newPendingPassIndex,
        ...derived,
        currentPlayer,
      }
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
