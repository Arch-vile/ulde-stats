import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGameState } from '../useGameState'

vi.mock('../../api', () => ({
  saveEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn(),
  insertEvent: vi.fn(),
}))

import * as api from '../../api'

describe('useGameState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('possession is on the pass target after: drop → new possession → delete possession → change drop to success', async () => {
    const { result } = renderHook(() => useGameState())

    act(() => {
      result.current.initGame('game1', ['player1', 'player2', 'player3'])
    })

    // player1 starts with the disc
    act(() => { result.current.recordPlayerClick('player1', 100) })

    // player1 passes to player2 (recorded as success initially)
    act(() => { result.current.recordPlayerClick('player2', 200) })

    // mark the pass as a drop — possession lost
    act(() => { result.current.updateEventOutcome(1, 'drop') })

    // player3 picks up (new possession start)
    act(() => { result.current.recordPlayerClick('player3', 300) })

    // events at this point:
    // [0] possession_start  player1
    // [1] pass              player1 → player2  drop
    // [2] possession_start  player3

    // delete the possession_start for player3
    const eventsAfterDelete = [
      result.current.state.events[0],
      result.current.state.events[1],
    ]
    vi.mocked(api.deleteEvent).mockResolvedValueOnce(eventsAfterDelete)

    await act(async () => { result.current.deleteGameEvent(2) })

    // change the drop to a successful catch — player2 now has possession
    act(() => { result.current.updateEventOutcome(1, 'success') })

    expect(result.current.state.currentPlayer).toBe('player2')
    expect(result.current.state.needsPossessionStart).toBe(false)
  })
})
