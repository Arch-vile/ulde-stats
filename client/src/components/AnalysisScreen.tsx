import { useState, useEffect } from 'react'
import { listGames, loadGame } from '../api'
import { computeStats, computeThrowMatrix, pct, failPct, taPct, dropForcedPct, catchPct, avgHold, goalAttempts, goalConvPct } from '../stats'
import type { GameMeta, Event } from '../types'
import type { PlayerStats } from '../stats'
import { GameReviewScreen } from './GameReviewScreen'

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

type ThrowSortKey = 'throws' | 'throwaways' | 'dropsForced' | 'completions' | 'goalsThrown' | 'holdCount' | 'goalDropsForced' | 'goalThrowaways'
type CatchSortKey = 'catches' | 'drops' | 'goalDropsReceived' | 'goalsScored'

interface AnalysisScreenProps {
  onBack: () => void
}

type View = 'select' | 'stats'

export function AnalysisScreen({ onBack }: AnalysisScreenProps) {
  const [games, setGames] = useState<GameMeta[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [eventsByGame, setEventsByGame] = useState<Map<string, Event[]>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [view, setView] = useState<View>('select')
  const [throwSort, toggleThrowSort] = useSort<ThrowSortKey>('throws')
  const [catchSort, toggleCatchSort] = useSort<CatchSortKey>('catches')
  const [reviewGame, setReviewGame] = useState<{ meta: GameMeta; events: Event[] } | null>(null)

  useEffect(() => {
    listGames().then(gs => {
      const sorted = [...gs].sort((a, b) => b.date.localeCompare(a.date))
      setGames(sorted)
    })
  }, [])

  function loadGameEvents(id: string) {
    if (eventsByGame.has(id)) return
    setLoading(l => new Set(l).add(id))
    loadGame(id).then(({ events }) => {
      setEventsByGame(m => new Map(m).set(id, events))
      setLoading(l => { const s = new Set(l); s.delete(id); return s })
    })
  }

  function toggleGame(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
      loadGameEvents(id)
    }
    setSelected(next)
  }

  function selectAll() {
    games.forEach(g => loadGameEvents(g.id))
    setSelected(new Set(games.map(g => g.id)))
  }

  async function openReview(g: GameMeta) {
    const events = eventsByGame.get(g.id) ?? await loadGame(g.id).then(r => {
      setEventsByGame(m => new Map(m).set(g.id, r.events))
      return r.events
    })
    setReviewGame({ meta: g, events })
  }

  // ── Play-by-play view ──────────────────────────────────────────────────────
  if (reviewGame) {
    return (
      <GameReviewScreen
        meta={reviewGame.meta}
        events={reviewGame.events}
        onBack={() => setReviewGame(null)}
      />
    )
  }

  // ── Game selection page ────────────────────────────────────────────────────
  if (view === 'select') {
    const anyLoading = loading.size > 0 && [...selected].some(id => loading.has(id))
    return (
      <div className="game-select-screen">
        <div className="game-select-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2 className="game-select-title">Analysis</h2>
        </div>
        <div className="game-select-list">
          {games.length === 0 && <p className="muted game-select-empty">No games recorded yet.</p>}
          {games.map(g => (
            <div key={g.id} className={`game-select-row ${selected.has(g.id) ? 'selected' : ''}`}>
              <label className="game-select-label">
                <input
                  type="checkbox"
                  checked={selected.has(g.id)}
                  onChange={() => toggleGame(g.id)}
                />
                <div className="game-select-info">
                  <span className="game-select-date">{g.date}</span>
                  <span className="game-select-matchup">
                    {g.teamName ? `${g.teamName} vs ` : ''}{g.opponent}
                    {g.tournament ? <span className="game-select-tournament"> · {g.tournament}</span> : ''}
                  </span>
                </div>
              </label>
              <button className="btn-text btn-pbp" onClick={() => openReview(g)}>
                Play-by-play
              </button>
            </div>
          ))}
        </div>
        <div className="game-select-actions">
          {games.length > 0 && (
            <button className="btn-text" onClick={selectAll}>Select all</button>
          )}
          <button
            className="btn-primary"
            disabled={selected.size === 0 || anyLoading}
            onClick={() => setView('stats')}
          >
            {anyLoading ? 'Loading…' : `Statistics${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Stats page ─────────────────────────────────────────────────────────────
  const selectedGameEvents: Event[][] = [...selected]
    .filter(id => eventsByGame.has(id))
    .map(id => eventsByGame.get(id)!)

  const { players, team } = computeStats(selectedGameEvents)
  const matrix = computeThrowMatrix(selectedGameEvents)

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

  return (
    <div className="analysis-screen">
      <div className="analysis-topbar">
        <button className="btn-back" onClick={() => setView('select')}>← Games</button>
        <span className="analysis-topbar-title">
          {selected.size === 1
            ? (() => { const g = games.find(g => selected.has(g.id)); return g ? `${g.date} · ${g.opponent}` : '' })()
            : `${selected.size} games`}
        </span>
      </div>

      <div className="analysis-main">
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
                <Th label="Goal att." k="goalDropsForced" active={throwSort.key==='goalDropsForced'} dir={throwSort.dir} onClick={toggleThrowSort} title="Goal attempts (goal + goal-drop + goal-TA)" />
                <Th label="Conv%" k="goalThrowaways" active={throwSort.key==='goalThrowaways'} dir={throwSort.dir} onClick={toggleThrowSort} title="Goal conversion rate" />
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
                    <td className="muted">{goalAttempts(p) || '—'}</td>
                    <td className={p.goalsThrown > 0 ? 'stat-good' : 'muted'}>{goalAttempts(p) > 0 ? goalConvPct(p) : '—'}</td>
                    <td className="muted">{avgHold(p)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <dl className="stats-legend">
          <div><dt>Throws</dt><dd>Total passes attempted</dd></div>
          <div><dt>Fail%</dt><dd>Share of throws that resulted in a turnover (TA or drop)</dd></div>
          <div><dt>TA</dt><dd>Throwaways — disc thrown out of bounds or uncontested</dd></div>
          <div><dt>TA%</dt><dd>Throwaway rate (TA / throws)</dd></div>
          <div><dt>Drops caused</dt><dd>Times the receiver dropped your throw</dd></div>
          <div><dt>Drop%</dt><dd>Drop rate on your throws (drops caused / throws)</dd></div>
          <div><dt>Comp</dt><dd>Completed passes (success + goal)</dd></div>
          <div><dt>Ast</dt><dd>Goal assists — completions that scored a goal</dd></div>
          <div><dt>Goal att.</dt><dd>Goal attempts — throws where a goal was intended (goal + goal-drop + goal-TA)</dd></div>
          <div><dt>Conv%</dt><dd>Goal conversion rate (goals scored / goal attempts)</dd></div>
          <div><dt>Avg hold</dt><dd>Average seconds holding the disc before releasing</dd></div>
        </dl>

        <div className="stats-section-label">Receiving</div>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="stats-th stats-th-name">Player</th>
                <Th label="Catches" k="catches" active={catchSort.key==='catches'} dir={catchSort.dir} onClick={toggleCatchSort} title="Successful catches" />
                <Th label="Drops" k="drops" active={catchSort.key==='drops'} dir={catchSort.dir} onClick={toggleCatchSort} title="Drops" />
                <Th label="Catch%" k="catches" active={false} dir={catchSort.dir} onClick={toggleCatchSort} title="Catch success rate" />
                <Th label="Goal drops" k="goalDropsReceived" active={catchSort.key==='goalDropsReceived'} dir={catchSort.dir} onClick={toggleCatchSort} title="Times you dropped a goal pass" />
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
                  <td className={p.goalDropsReceived > 0 ? 'stat-bad' : 'muted'}>{p.goalDropsReceived || '—'}</td>
                  <td className={p.goalsScored > 0 ? 'stat-good' : 'muted'}>{p.goalsScored || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="stats-legend">
          <div><dt>Catches</dt><dd>Successful receptions (pass completed to you)</dd></div>
          <div><dt>Drops</dt><dd>Times you failed to catch a throw intended for you</dd></div>
          <div><dt>Catch%</dt><dd>Catch success rate (catches / (catches + drops))</dd></div>
          <div><dt>Goal drops</dt><dd>Times you dropped a pass thrown as a goal attempt</dd></div>
          <div><dt>Goals</dt><dd>Goals scored by catching a goal pass</dd></div>
        </dl>

        {matrix.throwers.length > 0 && (
          <>
            <div className="stats-section-label">Throw Distribution</div>
            <div className="stats-table-wrap matrix-wrap">
              <table className="stats-table throw-matrix">
                <thead>
                  <tr>
                    <th className="stats-th stats-th-name">Thrower \ Receiver</th>
                    {matrix.receivers.map(r => (
                      <th key={r} className="stats-th">{r}</th>
                    ))}
                    <th className="stats-th">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.throwers.map(thrower => {
                    const total = matrix.throwTotals[thrower] ?? 0
                    return (
                      <tr key={thrower}>
                        <td className="stats-name">{thrower}</td>
                        {matrix.receivers.map(receiver => {
                          const count = matrix.counts[thrower]?.[receiver] ?? 0
                          const frac = total > 0 ? count / total : 0
                          const pctVal = total > 0 ? Math.round(frac * 100) : 0
                          return (
                            <td
                              key={receiver}
                              className="matrix-cell"
                              style={{ '--intensity': frac } as React.CSSProperties}
                            >
                              {count > 0 ? <><span className="matrix-count">{count}</span><span className="matrix-pct">{pctVal}%</span></> : <span className="muted">—</span>}
                            </td>
                          )
                        })}
                        <td className="muted">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <dl className="stats-legend">
              <div><dt>Throw Distribution</dt><dd>Each cell shows the number of throws and percentage of that thrower's total directed at that receiver. Shading intensity reflects share of throws.</dd></div>
            </dl>
          </>
        )}
      </div>
    </div>
  )
}
