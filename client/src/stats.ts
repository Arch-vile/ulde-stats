import type { Event } from './types'

export interface PlayerStats {
  name: string
  throws: number
  completions: number
  throwaways: number
  goalsThrown: number
  catches: number
  drops: number
  goalsScored: number
}

export interface TeamSummary {
  goals: number
  possessions: number
  completions: number
  throws: number
  turnovers: number
}

function pct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${Math.round((num / den) * 100)}%`
}

export function completionPct(p: PlayerStats): string {
  return pct(p.completions, p.throws)
}

export function catchPct(p: PlayerStats): string {
  return pct(p.catches, p.catches + p.drops)
}

export function computeStats(events: Event[]): { players: PlayerStats[]; team: TeamSummary } {
  const playerMap = new Map<string, PlayerStats>()

  function get(name: string): PlayerStats {
    if (!playerMap.has(name)) {
      playerMap.set(name, {
        name,
        throws: 0,
        completions: 0,
        throwaways: 0,
        goalsThrown: 0,
        catches: 0,
        drops: 0,
        goalsScored: 0,
      })
    }
    return playerMap.get(name)!
  }

  const team: TeamSummary = { goals: 0, possessions: 0, completions: 0, throws: 0, turnovers: 0 }

  for (const ev of events) {
    if (ev.event_type === 'possession_start') {
      team.possessions++
    } else if (ev.event_type === 'pass') {
      const thrower = get(ev.player)
      team.throws++
      thrower.throws++

      if (ev.outcome === 'success') {
        thrower.completions++
        team.completions++
        if (ev.target_player) get(ev.target_player).catches++
      } else if (ev.outcome === 'goal') {
        thrower.completions++
        thrower.goalsThrown++
        team.completions++
        team.goals++
        if (ev.target_player) {
          const receiver = get(ev.target_player)
          receiver.catches++
          receiver.goalsScored++
        }
      } else if (ev.outcome === 'throwaway') {
        thrower.throwaways++
        team.turnovers++
      } else if (ev.outcome === 'drop') {
        team.turnovers++
        if (ev.target_player) get(ev.target_player).drops++
      }
    } else if (ev.event_type === 'turnover') {
      team.turnovers++
    }
  }

  return { players: [...playerMap.values()], team }
}
