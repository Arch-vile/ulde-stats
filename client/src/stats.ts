import type { Event } from './types'

export interface PlayerStats {
  name: string
  // throwing
  throws: number
  completions: number
  throwaways: number
  dropsForced: number       // times your throw was dropped by receiver
  goalsThrown: number
  goalDropsForced: number   // goal throws dropped by receiver
  goalThrowaways: number    // goal throws that were a throwaway
  totalHoldTime: number     // sum of seconds holding disc before throwing/turning over
  holdCount: number         // number of possession sequences counted
  // receiving
  catches: number           // successful receptions (success + goal)
  drops: number             // times you personally dropped
  goalDropsReceived: number // dropped a goal pass
  goalsScored: number
}

export interface TeamSummary {
  goals: number
  possessions: number
  completions: number
  throws: number
  turnovers: number
}

export function pct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${Math.round((num / den) * 100)}%`
}

export function failPct(p: PlayerStats): string {
  return pct(p.throwaways + p.dropsForced + p.goalDropsForced + p.goalThrowaways, p.throws)
}

export function taPct(p: PlayerStats): string {
  return pct(p.throwaways, p.throws)
}

export function dropForcedPct(p: PlayerStats): string {
  return pct(p.dropsForced, p.throws)
}

export function goalAttempts(p: PlayerStats): number {
  return p.goalsThrown + p.goalDropsForced + p.goalThrowaways
}

export function goalConvPct(p: PlayerStats): string {
  return pct(p.goalsThrown, goalAttempts(p))
}

export function catchPct(p: PlayerStats): string {
  return pct(p.catches, p.catches + p.drops)
}

export function avgHold(p: PlayerStats): string {
  if (p.holdCount === 0) return '—'
  return `${(p.totalHoldTime / p.holdCount).toFixed(1)}s`
}

export interface ThrowMatrix {
  throwers: string[]
  receivers: string[]
  counts: Record<string, Record<string, number>>
  throwTotals: Record<string, number>
}

export function computeThrowMatrix(eventsByGame: Event[][]): ThrowMatrix {
  const counts: Record<string, Record<string, number>> = {}
  const throwTotals: Record<string, number> = {}

  for (const events of eventsByGame) {
    for (const ev of events) {
      if (ev.event_type === 'pass' && ev.target_player) {
        const thrower = ev.player
        const receiver = ev.target_player
        if (!counts[thrower]) counts[thrower] = {}
        counts[thrower][receiver] = (counts[thrower][receiver] ?? 0) + 1
        throwTotals[thrower] = (throwTotals[thrower] ?? 0) + 1
      }
    }
  }

  const throwers = Object.keys(throwTotals).sort((a, b) => throwTotals[b] - throwTotals[a])
  const receiverTotals: Record<string, number> = {}
  for (const row of Object.values(counts)) {
    for (const [r, c] of Object.entries(row)) {
      receiverTotals[r] = (receiverTotals[r] ?? 0) + c
    }
  }
  const receivers = Object.keys(receiverTotals).sort((a, b) => receiverTotals[b] - receiverTotals[a])

  return { throwers, receivers, counts, throwTotals }
}

// Takes events grouped by game so possession times don't bleed between games
export function computeStats(eventsByGame: Event[][]): { players: PlayerStats[]; team: TeamSummary } {
  const playerMap = new Map<string, PlayerStats>()

  function get(name: string): PlayerStats {
    if (!name) return { name: '', throws: 0, completions: 0, throwaways: 0, dropsForced: 0, goalsThrown: 0, goalDropsForced: 0, goalThrowaways: 0, totalHoldTime: 0, holdCount: 0, catches: 0, drops: 0, goalDropsReceived: 0, goalsScored: 0 }
    if (!playerMap.has(name)) {
      playerMap.set(name, {
        name,
        throws: 0, completions: 0, throwaways: 0, dropsForced: 0,
        goalsThrown: 0, goalDropsForced: 0, goalThrowaways: 0,
        totalHoldTime: 0, holdCount: 0,
        catches: 0, drops: 0, goalDropsReceived: 0, goalsScored: 0,
      })
    }
    return playerMap.get(name)!
  }

  const team: TeamSummary = { goals: 0, possessions: 0, completions: 0, throws: 0, turnovers: 0 }

  for (const events of eventsByGame) {
    // discHeldSince tracks when each player got the disc within this game
    // Value: { timestamp, pauseAccumAtStart } — lets us subtract pause time from the hold
    const discHeldSince = new Map<string, { timestamp: number; pauseAccumAtStart: number }>()
    let pausedAt: number | null = null
    let totalPauseAccum = 0

    for (const ev of events) {
      if (ev.event_type === 'game-paused') {
        pausedAt = ev.timestamp
        continue
      }
      if (ev.event_type === 'game-continued') {
        if (pausedAt !== null) {
          totalPauseAccum += ev.timestamp - pausedAt
          pausedAt = null
        }
        continue
      }

      if (ev.event_type === 'possession_start') {
        team.possessions++
        discHeldSince.set(ev.player, { timestamp: ev.timestamp, pauseAccumAtStart: totalPauseAccum })

      } else if (ev.event_type === 'pass') {
        const thrower = get(ev.player)
        team.throws++
        thrower.throws++

        // Accumulate hold time for the thrower, excluding any pause intervals
        const held = discHeldSince.get(ev.player)
        if (held !== undefined) {
          const pauseDuringHold = totalPauseAccum - held.pauseAccumAtStart
          thrower.totalHoldTime += (ev.timestamp - held.timestamp) - pauseDuringHold
          thrower.holdCount++
          discHeldSince.delete(ev.player)
        }

        if (ev.outcome === 'success') {
          thrower.completions++
          team.completions++
          if (ev.target_player) {
            get(ev.target_player).catches++
            discHeldSince.set(ev.target_player, { timestamp: ev.timestamp, pauseAccumAtStart: totalPauseAccum })
          }
        } else if (ev.outcome === 'goal') {
          thrower.completions++
          thrower.goalsThrown++
          team.completions++
          team.goals++
          if (ev.target_player) {
            const receiver = get(ev.target_player)
            receiver.catches++
            receiver.goalsScored++
            // Receiver scored — no further disc holding needed
          }
        } else if (ev.outcome === 'throwaway') {
          thrower.throwaways++
          team.turnovers++
        } else if (ev.outcome === 'drop') {
          thrower.dropsForced++
          team.turnovers++
          if (ev.target_player) get(ev.target_player).drops++
        } else if (ev.outcome === 'goal-drop') {
          thrower.goalDropsForced++
          team.turnovers++
          if (ev.target_player) {
            const receiver = get(ev.target_player)
            receiver.drops++
            receiver.goalDropsReceived++
          }
        } else if (ev.outcome === 'goal-throwaway') {
          thrower.goalThrowaways++
          team.turnovers++
        }

      } else if (ev.event_type === 'turnover') {
        team.turnovers++
        const thrower = get(ev.player)
        const held = discHeldSince.get(ev.player)
        if (held !== undefined) {
          const pauseDuringHold = totalPauseAccum - held.pauseAccumAtStart
          thrower.totalHoldTime += (ev.timestamp - held.timestamp) - pauseDuringHold
          thrower.holdCount++
          discHeldSince.delete(ev.player)
        }
      }
    }
  }

  return { players: [...playerMap.values()], team }
}
