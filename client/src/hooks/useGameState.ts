import { useState, useRef, useCallback } from 'react'
import type { Event, Outcome } from '../types'
import { saveEvent, updateOutcome } from '../api'

interface GameState {
  gameId: string
  events: Event[]
  pendingPassIndex: number | null  // index of unsaved pass — saved when next action fires
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
      setState({
        ...initialState,
        gameId,
        events,
        pendingPassIndex: null, // all loaded events already in CSV
        players: [...playerSet],
        ...deriveState(events),
      })
    },
    [],
  )

  const recordPlayerClick = useCallback(async (playerName: string, timestamp: number) => {
    const s = stateRef.current

    // Flush any pending pass with its current outcome before recording the next event
    if (s.pendingPassIndex !== null) {
      void saveEvent(s.gameId, s.events[s.pendingPassIndex])
    }

    let nextPossessionId = s.possessionId
    let event: Event

    if (s.needsPossessionStart) {
      nextPossessionId = s.possessionId + 1
      event = {
        timestamp,
        event_type: 'possession_start',
        player: playerName,
        target_player: '',
        outcome: '',
        possession_id: nextPossessionId,
        event_number: s.events.length + 1,
      }
      void saveEvent(s.gameId, event) // possession_start saved immediately
    } else {
      event = {
        timestamp,
        event_type: 'pass',
        player: s.currentPlayer,
        target_player: playerName,
        outcome: 'success',
        possession_id: s.possessionId,
        event_number: s.events.length + 1,
      }
      // pass is NOT saved yet — held pending until next action or terminal outcome
    }

    setState(prev => {
      const newEvents = [...prev.events, event]
      const pendingPassIndex = event.event_type === 'pass' ? newEvents.length - 1 : null
      return { ...prev, events: newEvents, possessionId: nextPossessionId, pendingPassIndex, ...deriveState(newEvents) }
    })
  }, [])

  const recordTurnover = useCallback(async (timestamp: number) => {
    const s = stateRef.current
    if (s.needsPossessionStart) return

    // Flush pending pass (success) before recording turnover
    if (s.pendingPassIndex !== null) {
      void saveEvent(s.gameId, s.events[s.pendingPassIndex])
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
      const newEvents = [...prev.events, event]
      return { ...prev, events: newEvents, pendingPassIndex: null, ...deriveState(newEvents) }
    })
  }, [])

  const updateEventOutcome = useCallback((index: number, outcome: Outcome) => {
    const s = stateRef.current

    const isTerminal = outcome === 'goal' || outcome === 'drop' || outcome === 'throwaway'
    const isPending = s.pendingPassIndex === index

    if (isPending && isTerminal) {
      // Pending pass getting a terminal outcome — save the full event now
      void saveEvent(s.gameId, { ...s.events[index], outcome })
    } else if (!isPending) {
      // Already-saved event — patch outcome on server
      void updateOutcome(s.gameId, s.events[index].event_number, outcome)
    }

    setState(prev => {
      const newEvents = prev.events.map((e, i) => (i === index ? { ...e, outcome } : e))
      const pendingPassIndex = isPending && isTerminal ? null : prev.pendingPassIndex
      return { ...prev, events: newEvents, pendingPassIndex, ...deriveState(newEvents) }
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
    addPlayer,
  }
}
