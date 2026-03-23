import type { Event, GameMeta } from './types'
import games from 'virtual:game-data'

type RawGame = GameMeta & { events: Event[] }

const gameMap = new Map<string, RawGame>(
  (games as RawGame[]).map((g: RawGame) => [g.id, g])
)

export async function listGames(): Promise<GameMeta[]> {
  return [...gameMap.values()]
    .map(({ events: _events, ...meta }) => ({ ...meta, videoUrl: meta.videoUrl ?? '' }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function loadGame(gameId: string): Promise<{ meta: GameMeta; events: Event[] }> {
  const g = gameMap.get(gameId)
  if (!g) throw new Error(`Game not found: ${gameId}`)
  const { events, ...meta } = g
  return { meta: { ...meta, videoUrl: meta.videoUrl ?? '' }, events }
}

// Stubs — not called in viewer mode
export async function createGame(): Promise<never>     { throw new Error('Read-only viewer') }
export async function updateGameMeta(): Promise<never> { throw new Error('Read-only viewer') }
export async function saveEvent(): Promise<never>      { throw new Error('Read-only viewer') }
export async function updateEvent(): Promise<never>    { throw new Error('Read-only viewer') }
export async function deleteEvent(): Promise<never>    { throw new Error('Read-only viewer') }
