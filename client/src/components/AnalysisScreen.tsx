import { useState, useEffect } from 'react'
import { listGames, loadGame } from '../api'
import { computeStats, pct, failPct, taPct, dropForcedPct, catchPct, avgHold } from '../stats'
import type { GameMeta, Event } from '../types'
import type { PlayerStats } from '../stats'

type SortDir = 'asc' | 'desc'
interface SortState<K> { key: K; dir: SortDir }

function useSort<K>(initial: K): [SortState<K>, (k: K) => void] {
  const [sort, setSort] = useState<SortState<K>>({ key: initial, dir: 'desc' })
  function toggle(key: K) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })
  }
  return [sort, toggle]
}

function sortPlayers<K extends keyof PlayerStats>(players: PlayerStats[], sort: SortState<K>): PlayerStats[] {
  return [...players].sort((a, b) => {
    const av = a[sort.key] as number
    const bv = b[sort.key] as number
    return sort.dir === 'desc' ? bv - av : av - bv
  })
}

type ThrowSortKey = 'throws' | 'throwaways' | 'dropsForced' | 'completions' | 'goalsThrown' | 'holdCount'
type CatchSortKey = 'catches' | 'drops' | 'goalsScored'

interface AnalysisScreenProps {
  onBack: () => void
}

export function AnalysisScreen({ onBack }: AnalysisScreenProps) {
  const [games, setGames] = useState<GameMeta[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [eventsByGame, setEventsByGame] = useState<Map<string, Event[]>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [throwSort, toggleThrowSort] = useSort<ThrowSortKey>('throws')
  const [catchSort, toggleCatchSort] = useSort<CatchSortKey>('catches')

  useEffect(() => {
    listGames().then(setGames)
  }, [])

  function toggleGame(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
      if (!eventsByGame.has(id)) {
        setLoading(l => new Set(l).add(id))
        loadGame(id).then(({ events }) => {
          setEventsByGame(m => new Map(m).set(id, events))
          setLoading(l => { const s = new Set(l); s.delete(id); return s })
        })
      }
    }
    setSelected(next)
  }

  function selectAll() {
    const ids = games.map(g => g.id)
    ids.forEach(id => {
      if (!eventsByGame.has(id)) {
        setLoading(l => new Set(l).add(id))
        loadGame(id).then(({ events }) => {
          setEventsByGame(m => new Map(m).set(id, events))
          setLoading(l => { const s = new Set(l); s.delete(id); return s })
        })
      }
    })
    setSelected(new Set(ids))
  }

  const selectedGameEvents: Event[][] = [...selected]
    .filter(id => eventsByGame.has(id))
    .map(id => eventsByGame.get(id)!)

  const { players, team } = computeStats(selectedGameEvents)

  const throwPlayers = sortPlayers(players.filter(p => p.throws > 0), throwSort)
  const catchPlayers = sortPlayers(players.filter(p => p.catches + p.drops > 0), catchSort)

  function Th<K extends string>({
    label, k, active, dir, onClick, title
  }: { label: string; k: K; active: boolean; dir: SortDir; onClick: (k: K) => void; title?: string }) {
    return (
      <th className={`stats-th ${active ? 'active' : ''}`} onClick={() => onClick(k)} title={title}>
        {label}{active ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
      </th>
    )
  }

  const hasData = selectedGameEvents.length > 0 && players.length > 0
  const isLoading = loading.size > 0

  return (
    <div className="analysis-screen">
      <div className="analysis-sidebar">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="analysis-sidebar-header">
          <span>Games</span>
          <button className="btn-text" onClick={selectAll}>Select all</button>
        </div>
        <div className="game-list">
          {games.map(g => (
            <label key={g.id} className={`game-item ${selected.has(g.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(g.id)}
                onChange={() => toggleGame(g.id)}
              />
              <span className="game-item-date">{g.date}</span>
              <span className="game-item-opponent">{g.opponent}</span>
            </label>
          ))}
          {games.length === 0 && <p className="muted">No games recorded yet.</p>}
        </div>
      </div>

      <div className="analysis-main">
        {!hasData && (
          <div className="analysis-empty">
            {isLoading ? 'Loading…' : 'Select one or more games to see stats.'}
          </div>
        )}

        {hasData && (
          <>
            <div className="team-summary">
              <div className="summary-stat">
                <span className="summary-value">{team.goals}</span>
                <span className="summary-label">Goals</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">{team.possessions}</span>
                <span className="summary-label">Possessions</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">{pct(team.goals, team.possessions)}</span>
                <span className="summary-label">Efficiency</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">{pct(team.completions, team.throws)}</span>
                <span className="summary-label">Completion %</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">{team.turnovers}</span>
                <span className="summary-label">Turnovers</span>
              </div>
            </div>

            <div className="stats-section-label">Throwing</div>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th className="stats-th stats-th-name">Player</th>
                    <Th label="Throws" k="throws" active={throwSort.key==='throws'} dir={throwSort.dir} onClick={toggleThrowSort} title="Total throws" />
                    <Th label="Fail%" k="throwaways" active={throwSort.key==='throwaways'} dir={throwSort.dir} onClick={toggleThrowSort} title="Total failure rate (TA + drops caused)" />
                    <Th label="TA" k="throwaways" active={false} dir={throwSort.dir} onClick={toggleThrowSort} title="Throwaways" />
                    <Th label="TA%" k="throwaways" active={false} dir={throwSort.dir} onClick={toggleThrowSort} title="Throwaway rate" />
                    <Th label="Drops caused" k="dropsForced" active={throwSort.key==='dropsForced'} dir={throwSort.dir} onClick={toggleThrowSort} title="Times your throw was dropped by receiver" />
                    <Th label="Drop%" k="dropsForced" active={false} dir={throwSort.dir} onClick={toggleThrowSort} title="Drop rate on your throws" />
                    <Th label="Comp" k="completions" active={throwSort.key==='completions'} dir={throwSort.dir} onClick={toggleThrowSort} title="Completions" />
                    <Th label="Ast" k="goalsThrown" active={throwSort.key==='goalsThrown'} dir={throwSort.dir} onClick={toggleThrowSort} title="Goals thrown (assists)" />
                    <Th label="Avg hold" k="holdCount" active={throwSort.key==='holdCount'} dir={throwSort.dir} onClick={toggleThrowSort} title="Average time holding disc before throwing" />
                  </tr>
                </thead>
                <tbody>
                  {throwPlayers.map(p => {
                    const failRate = p.throws > 0 ? (p.throwaways + p.dropsForced) / p.throws : 0
                    return (
                      <tr key={p.name}>
                        <td className="stats-name">{p.name}</td>
                        <td>{p.throws}</td>
                        <td className={failRate > 0.2 ? 'stat-bad' : failRate > 0 ? '' : 'muted'}>{failPct(p)}</td>
                        <td className={p.throwaways > 0 ? 'stat-bad' : 'muted'}>{p.throwaways || '—'}</td>
                        <td className="muted">{taPct(p)}</td>
                        <td className={p.dropsForced > 0 ? 'stat-bad' : 'muted'}>{p.dropsForced || '—'}</td>
                        <td className="muted">{dropForcedPct(p)}</td>
                        <td>{p.completions}</td>
                        <td className={p.goalsThrown > 0 ? 'stat-good' : 'muted'}>{p.goalsThrown || '—'}</td>
                        <td className="muted">{avgHold(p)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="stats-section-label">Receiving</div>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th className="stats-th stats-th-name">Player</th>
                    <Th label="Catches" k="catches" active={catchSort.key==='catches'} dir={catchSort.dir} onClick={toggleCatchSort} title="Successful catches" />
                    <Th label="Drops" k="drops" active={catchSort.key==='drops'} dir={catchSort.dir} onClick={toggleCatchSort} title="Drops" />
                    <Th label="Catch%" k="catches" active={false} dir={catchSort.dir} onClick={toggleCatchSort} title="Catch success rate" />
                    <Th label="Goals" k="goalsScored" active={catchSort.key==='goalsScored'} dir={catchSort.dir} onClick={toggleCatchSort} title="Goals scored" />
                  </tr>
                </thead>
                <tbody>
                  {catchPlayers.map(p => (
                    <tr key={p.name}>
                      <td className="stats-name">{p.name}</td>
                      <td>{p.catches}</td>
                      <td className={p.drops > 0 ? 'stat-bad' : 'muted'}>{p.drops || '—'}</td>
                      <td className="muted">{catchPct(p)}</td>
                      <td className={p.goalsScored > 0 ? 'stat-good' : 'muted'}>{p.goalsScored || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
