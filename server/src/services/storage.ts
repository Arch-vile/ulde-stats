import fs from 'fs'
import path from 'path'
import type { Event, Game, GameMeta } from '../types'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function filePath(gameId: string): string {
  return path.join(DATA_DIR, `${gameId}.json`)
}

function writeGameToDisk(game: Game): void {
  fs.writeFileSync(filePath(game.id), JSON.stringify(game, null, 2))
}

// In-memory store
const store = new Map<string, Game>()
const dirty = new Set<string>()

setInterval(() => {
  for (const gameId of dirty) {
    const game = store.get(gameId)
    if (game) writeGameToDisk(game)
  }
  dirty.clear()
}, 1000)

function loadIntoStore(gameId: string): Game {
  const game = JSON.parse(fs.readFileSync(filePath(gameId), 'utf-8')) as Game
  store.set(gameId, game)
  return game
}

function getOrLoad(gameId: string): Game {
  return store.get(gameId) ?? loadIntoStore(gameId)
}

export function createGame(meta: Omit<GameMeta, 'id'>): string {
  ensureDataDir()
  const sanitized = meta.opponent.replace(/[^a-zA-Z0-9_-]/g, '_')
  const id = `${meta.date}_${sanitized}`
  const game: Game = { ...meta, id, events: [] }
  store.set(id, game)
  writeGameToDisk(game)
  return id
}

export function updateGameMeta(gameId: string, patch: Partial<Omit<GameMeta, 'id'>>): void {
  const game = getOrLoad(gameId)
  Object.assign(game, patch)
  dirty.add(gameId)
}

export function listGames(): GameMeta[] {
  ensureDataDir()
  return fs
    .readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const game = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')) as Game
      const { events: _, ...meta } = game
      return meta
    })
}

export function loadGame(gameId: string): { meta: GameMeta; events: Event[] } {
  const { events, ...meta } = getOrLoad(gameId)
  return { meta, events }
}

export function appendEvent(gameId: string, event: Event): void {
  getOrLoad(gameId).events.push(event)
  dirty.add(gameId)
}

export function updateEvent(gameId: string, event: Event): void {
  const events = getOrLoad(gameId).events
  const idx = events.findIndex(e => e.event_number === event.event_number)
  if (idx !== -1) events[idx] = event
  dirty.add(gameId)
}

export function deleteEvent(gameId: string, eventNumber: number): Event[] {
  const events = getOrLoad(gameId).events
  const idx = events.findIndex(e => e.event_number === eventNumber)
  if (idx !== -1) {
    events.splice(idx, 1)
    events.forEach((e, i) => { e.event_number = i + 1 })
  }
  dirty.add(gameId)
  return events
}
