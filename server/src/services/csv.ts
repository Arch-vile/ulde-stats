import fs from 'fs'
import path from 'path'
import type { Event, GameMeta, Outcome } from '../types'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function metaFromId(id: string): GameMeta {
  const date = id.slice(0, 10)
  const opponent = id.slice(11)
  return { id, date, opponent }
}

const HEADER = 'event_number,timestamp,event_type,player,target_player,outcome,possession_id'

function parseEvent(line: string): Event {
  const parts = line.split(',')
  return {
    event_number: parseInt(parts[0]),
    timestamp: parseInt(parts[1]),
    event_type: parts[2] as Event['event_type'],
    player: parts[3],
    target_player: parts[4],
    outcome: parts[5] as Event['outcome'],
    possession_id: parseInt(parts[6]),
  }
}

function serializeEvent(event: Event): string {
  return [
    event.event_number,
    event.timestamp,
    event.event_type,
    event.player,
    event.target_player,
    event.outcome,
    event.possession_id,
  ].join(',')
}

function writeGameToDisk(gameId: string, events: Event[]): void {
  const filePath = path.join(DATA_DIR, `${gameId}.csv`)
  const rows = [HEADER, ...events.map(serializeEvent)].join('\n') + '\n'
  fs.writeFileSync(filePath, rows)
}

// In-memory store
const store = new Map<string, Event[]>()
const dirty = new Set<string>()

setInterval(() => {
  for (const gameId of dirty) {
    const events = store.get(gameId)
    if (events) writeGameToDisk(gameId, events)
  }
  dirty.clear()
}, 1000)

function loadIntoStore(gameId: string): Event[] {
  const filePath = path.join(DATA_DIR, `${gameId}.csv`)
  const content = fs.readFileSync(filePath, 'utf-8')
  const events = content.trim().split('\n').slice(1).filter(l => l.trim()).map(parseEvent)
  store.set(gameId, events)
  return events
}

function getOrLoad(gameId: string): Event[] {
  return store.get(gameId) ?? loadIntoStore(gameId)
}

export function createGame(opponent: string, date: string): string {
  ensureDataDir()
  const sanitized = opponent.replace(/[^a-zA-Z0-9_-]/g, '_')
  const gameId = `${date}_${sanitized}`
  const events: Event[] = []
  store.set(gameId, events)
  writeGameToDisk(gameId, events)
  return gameId
}

export function listGames(): GameMeta[] {
  ensureDataDir()
  return fs
    .readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.csv'))
    .map(f => metaFromId(f.slice(0, -4)))
}

export function loadGame(gameId: string): { meta: GameMeta; events: Event[] } {
  return { meta: metaFromId(gameId), events: getOrLoad(gameId) }
}

export function appendEvent(gameId: string, event: Event): void {
  getOrLoad(gameId).push(event)
  dirty.add(gameId)
}

export function updateEventOutcome(gameId: string, eventNumber: number, outcome: Outcome): void {
  const events = getOrLoad(gameId)
  const ev = events.find(e => e.event_number === eventNumber)
  if (ev) ev.outcome = outcome
  dirty.add(gameId)
}
