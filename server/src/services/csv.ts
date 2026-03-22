import fs from 'fs'
import path from 'path'
import type { Event, GameMeta } from '../types'

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

const HEADER = 'timestamp,event_type,player,target_player,outcome,possession_id'

export function createGame(opponent: string, date: string): string {
  ensureDataDir()
  const sanitized = opponent.replace(/[^a-zA-Z0-9_-]/g, '_')
  const gameId = `${date}_${sanitized}`
  const filePath = path.join(DATA_DIR, `${gameId}.csv`)
  fs.writeFileSync(filePath, HEADER + '\n')
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
  const filePath = path.join(DATA_DIR, `${gameId}.csv`)
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n').slice(1).filter(l => l.trim())
  const events: Event[] = lines.map(line => {
    const parts = line.split(',')
    return {
      timestamp: parseInt(parts[0]),
      event_type: parts[1] as Event['event_type'],
      player: parts[2],
      target_player: parts[3],
      outcome: parts[4] as Event['outcome'],
      possession_id: parseInt(parts[5]),
    }
  })
  return { meta: metaFromId(gameId), events }
}

export function appendEvent(gameId: string, event: Event): void {
  const filePath = path.join(DATA_DIR, `${gameId}.csv`)
  const row =
    [
      event.timestamp,
      event.event_type,
      event.player,
      event.target_player,
      event.outcome,
      event.possession_id,
    ].join(',') + '\n'
  fs.appendFileSync(filePath, row)
}
