import { useState, useRef, useCallback } from 'react'
import type { Event, Outcome } from '../types'
import { saveEvent } from '../api'

interface GameState {
  gameId: string
  events: Event[]
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
        players: [...playerSet],
        ...deriveState(events),
      })
    },
    [],
  )

  const recordPlayerClick = useCallback(async (playerName: string, timestamp: number) => {
    const s = stateRef.current
    let event: Event
    let nextPossessionId = s.possessionId

    if (s.needsPossessionStart) {
      nextPossessionId = s.possessionId + 1
      event = {
        timestamp,
        event_type: 'possession_start',
        player: playerName,
        target_player: '',
        outcome: '',
        possession_id: nextPossessionId,
      }
    } else {
      event = {
        timestamp,
        event_type: 'pass',
        player: s.currentPlayer,
        target_player: playerName,
        outcome: 'success',
        possession_id: s.possessionId,
      }
    }

    void saveEvent(s.gameId, event)

    setState(prev => {
      const newEvents = [...prev.events, event]
      return { ...prev, events: newEvents, possessionId: nextPossessionId, ...deriveState(newEvents) }
    })
  }, [])

  const recordTurnover = useCallback(async (timestamp: number) => {
    const s = stateRef.current
    if (s.needsPossessionStart) return

    const event: Event = {
      timestamp,
      event_type: 'turnover',
      player: s.currentPlayer,
      target_player: '',
      outcome: 'turnover',
      possession_id: s.possessionId,
    }

    void saveEvent(s.gameId, event)

    setState(prev => {
      const newEvents = [...prev.events, event]
      return { ...prev, events: newEvents, ...deriveState(newEvents) }
    })
  }, [])

  const updateEventOutcome = useCallback((index: number, outcome: Outcome) => {
    setState(prev => {
      const newEvents = prev.events.map((e, i) => (i === index ? { ...e, outcome } : e))
      return { ...prev, events: newEvents, ...deriveState(newEvents) }
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
