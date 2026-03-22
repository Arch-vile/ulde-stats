import type { Event, GameMeta, Outcome } from './types'

const BASE = '/api'

export async function createGame(opponent: string, date: string): Promise<{ gameId: string }> {
  const res = await fetch(`${BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opponent, date }),
  })
  return res.json() as Promise<{ gameId: string }>
}

export async function listGames(): Promise<GameMeta[]> {
  const res = await fetch(`${BASE}/games`)
  return res.json() as Promise<GameMeta[]>
}

export async function loadGame(gameId: string): Promise<{ meta: GameMeta; events: Event[] }> {
  const res = await fetch(`${BASE}/games/${gameId}`)
  return res.json() as Promise<{ meta: GameMeta; events: Event[] }>
}

export async function saveEvent(gameId: string, event: Event): Promise<void> {
  await fetch(`${BASE}/games/${gameId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
}

export async function updateOutcome(gameId: string, eventNumber: number, outcome: Outcome): Promise<void> {
  await fetch(`${BASE}/games/${gameId}/events/${eventNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome }),
  })
}
