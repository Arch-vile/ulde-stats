import { useState, useEffect } from 'react'
import { listGames, loadGame } from '../api'
import { computeStats, completionPct, catchPct } from '../stats'
import type { GameMeta, Event } from '../types'
import type { PlayerStats, TeamSummary } from '../stats'

type SortKey = keyof PlayerStats
type SortDir = 'asc' | 'desc'

interface AnalysisScreenProps {
  onBack: () => void
}

export function AnalysisScreen({ onBack }: AnalysisScreenProps) {
  const [games, setGames] = useState<GameMeta[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [eventsByGame, setEventsByGame] = useState<Map<string, Event[]>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('throws')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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

  const allEvents: Event[] = [...selected]
    .filter(id => eventsByGame.has(id))
    .flatMap(id => eventsByGame.get(id)!)

  const { players, team } = computeStats(allEvents)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...players].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'desc' ? bv - av : av - bv
  })

  function th(label: string, key: SortKey, title?: string) {
    const active = sortKey === key
    return (
      <th
        key={key}
        className={`stats-th ${active ? 'active' : ''}`}
        onClick={() => handleSort(key)}
        title={title}
      >
        {label}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </th>
    )
  }

  const hasData = selected.size > 0 && allEvents.length > 0
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
                <span className="summary-value">
                  {team.possessions > 0 ? `${Math.round((team.goals / team.possessions) * 100)}%` : '—'}
                </span>
                <span className="summary-label">Efficiency</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">
                  {team.throws > 0 ? `${Math.round((team.completions / team.throws) * 100)}%` : '—'}
                </span>
                <span className="summary-label">Completion %</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">{team.turnovers}</span>
                <span className="summary-label">Turnovers</span>
              </div>
            </div>

            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th className="stats-th stats-th-name">Player</th>
                    {th('Throws', 'throws', 'Total throws')}
                    {th('Comp', 'completions', 'Completions')}
                    {th('C%', 'completions', 'Completion %')}
                    {th('TA', 'throwaways', 'Throwaways')}
                    {th('Ast', 'goalsThrown', 'Goals thrown (assists)')}
                    {th('Catches', 'catches', 'Successful catches')}
                    {th('Drops', 'drops', 'Drops')}
                    {th('Rec%', 'catches', 'Receive success rate')}
                    {th('Goals', 'goalsScored', 'Goals scored')}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.name}>
                      <td className="stats-name">{p.name}</td>
                      <td>{p.throws}</td>
                      <td>{p.completions}</td>
                      <td className="muted">{completionPct(p)}</td>
                      <td className={p.throwaways > 0 ? 'stat-bad' : ''}>{p.throwaways || '—'}</td>
                      <td className={p.goalsThrown > 0 ? 'stat-good' : ''}>{p.goalsThrown || '—'}</td>
                      <td>{p.catches}</td>
                      <td className={p.drops > 0 ? 'stat-bad' : ''}>{p.drops || '—'}</td>
                      <td className="muted">{catchPct(p)}</td>
                      <td className={p.goalsScored > 0 ? 'stat-good' : ''}>{p.goalsScored || '—'}</td>
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
