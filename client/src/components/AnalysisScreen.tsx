import { useState, useEffect } from 'react'
import { listGames, loadGame } from '../api'
import { computeStats, computeThrowMatrix, pct, catchPct, avgHold, goalConvPct } from '../stats'
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

function sortPlayers(players: PlayerStats[], dir: SortDir, getValue: (p: PlayerStats) => number): PlayerStats[] {
  return [...players].sort((a, b) => {
    const av = getValue(a)
    const bv = getValue(b)
    return dir === 'desc' ? bv - av : av - bv
  })
}

type ThrowSortKey = 'throws' | 'throwPct' | 'goalAttempts' | 'goalPct' | 'dropsForced' | 'throwaways' | 'goalDropsForced' | 'goalThrowaways' | 'holdCount'
type CatchSortKey = 'catches' | 'drops' | 'goalDropsReceived' | 'goalsScored'

const throwExtractors: Record<ThrowSortKey, (p: PlayerStats) => number> = {
  throws:          p => p.throws,
  throwPct:        p => p.throws > 0 ? p.completions / p.throws : 0,
  goalAttempts:    p => p.goalAttempts,
  goalPct:         p => p.goalAttempts > 0 ? p.goalsThrown / p.goalAttempts : 0,
  dropsForced:     p => p.dropsForced,
  throwaways:      p => p.throwaways,
  goalDropsForced: p => p.goalDropsForced,
  goalThrowaways:  p => p.goalThrowaways,
  holdCount:       p => p.holdCount > 0 ? p.totalHoldTime / p.holdCount : 0,
}

const catchExtractors: Record<CatchSortKey, (p: PlayerStats) => number> = {
  catches:           p => p.catches,
  drops:             p => p.drops,
  goalDropsReceived: p => p.goalDropsReceived,
  goalsScored:       p => p.goalsScored,
}

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

  const throwPlayers = sortPlayers(players.filter(p => p.throws > 0), throwSort.dir, throwExtractors[throwSort.key])
  const catchPlayers = sortPlayers(players.filter(p => p.catches + p.drops > 0), catchSort.dir, catchExtractors[catchSort.key])

  const throwTeam = throwPlayers.reduce(
    (acc, p) => ({
      throws: acc.throws + p.throws,
      completions: acc.completions + p.completions,
      goalAttempts: acc.goalAttempts + p.goalAttempts,
      goalsThrown: acc.goalsThrown + p.goalsThrown,
      dropsForced: acc.dropsForced + p.dropsForced,
      throwaways: acc.throwaways + p.throwaways,
      goalDropsForced: acc.goalDropsForced + p.goalDropsForced,
      goalThrowaways: acc.goalThrowaways + p.goalThrowaways,
      totalHoldTime: acc.totalHoldTime + p.totalHoldTime,
      holdCount: acc.holdCount + p.holdCount,
    }),
    { throws: 0, completions: 0, goalAttempts: 0, goalsThrown: 0, dropsForced: 0, throwaways: 0, goalDropsForced: 0, goalThrowaways: 0, totalHoldTime: 0, holdCount: 0 }
  )

  const catchTeam = catchPlayers.reduce(
    (acc, p) => ({
      catches: acc.catches + p.catches,
      drops: acc.drops + p.drops,
      goalDropsReceived: acc.goalDropsReceived + p.goalDropsReceived,
      goalsScored: acc.goalsScored + p.goalsScored,
    }),
    { catches: 0, drops: 0, goalDropsReceived: 0, goalsScored: 0 }
  )

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
        <dl className="stats-legend">
          <div><dt>Goals</dt><dd>Total goals scored</dd></div>
          <div><dt>Possessions</dt><dd>Number of times the team received or picked up the disc</dd></div>
          <div><dt>Efficiency</dt><dd>Share of possessions that ended in a goal (goals / possessions)</dd></div>
          <div><dt>Completion %</dt><dd>Share of all throws that were successfully received</dd></div>
          <div><dt>Turnovers</dt><dd>Total turnovers — throwaways, drops, and stalls combined</dd></div>
        </dl>

        <div className="stats-section-label">Throwing</div>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="stats-th stats-th-name">Player</th>
                <Th label="Throws" k="throws" active={throwSort.key==='throws'} dir={throwSort.dir} onClick={toggleThrowSort} title="Total throws" />
                <Th label="Throw %" k="throwPct" active={throwSort.key==='throwPct'} dir={throwSort.dir} onClick={toggleThrowSort} title="Completion rate (completions / throws)" />
                <Th label="Goal attempts" k="goalAttempts" active={throwSort.key==='goalAttempts'} dir={throwSort.dir} onClick={toggleThrowSort} title="Throws intended as a goal" />
                <Th label="Goal %" k="goalPct" active={throwSort.key==='goalPct'} dir={throwSort.dir} onClick={toggleThrowSort} title="Goal conversion rate (goals / goal attempts)" />
                <Th label="Passes (D)" k="dropsForced" active={throwSort.key==='dropsForced'} dir={throwSort.dir} onClick={toggleThrowSort} title="Passes dropped by receiver" />
                <Th label="Passes (TA)" k="throwaways" active={throwSort.key==='throwaways'} dir={throwSort.dir} onClick={toggleThrowSort} title="Passes lost as throwaways" />
                <Th label="Goals (D)" k="goalDropsForced" active={throwSort.key==='goalDropsForced'} dir={throwSort.dir} onClick={toggleThrowSort} title="Goal throws dropped by receiver" />
                <Th label="Goals (TA)" k="goalThrowaways" active={throwSort.key==='goalThrowaways'} dir={throwSort.dir} onClick={toggleThrowSort} title="Goal throws lost as throwaways" />
                <Th label="Avg hold" k="holdCount" active={throwSort.key==='holdCount'} dir={throwSort.dir} onClick={toggleThrowSort} title="Average time holding disc before throwing" />
              </tr>
            </thead>
            <tbody>
              {throwPlayers.map(p => {
                const throwPct = p.throws > 0 ? p.completions / p.throws * 100 : -1
                const throwPctCls = throwPct < 0 ? 'muted' : throwPct >= 95 ? 'stat-good' : throwPct >= 90 ? 'stat-warn' : 'stat-bad'
                const goalPct = p.goalAttempts > 0 ? p.goalsThrown / p.goalAttempts * 100 : -1
                const goalPctCls = goalPct < 0 ? 'muted' : goalPct >= 90 ? 'stat-good' : goalPct >= 80 ? 'stat-warn' : 'stat-bad'
                return (
                <tr key={p.name}>
                  <td className="stats-name">{p.name}</td>
                  <td>{p.throws}</td>
                  <td className={throwPctCls}>{throwPct < 0 ? '—' : pct(p.completions, p.throws)}</td>
                  <td className="muted">{p.goalAttempts || '—'}</td>
                  <td className={goalPctCls}>{goalPct < 0 ? '—' : goalConvPct(p)}</td>
                  <td className={p.dropsForced > 0 ? 'stat-bad' : 'muted'}>{p.dropsForced || '—'}</td>
                  <td className={p.throwaways > 0 ? 'stat-bad' : 'muted'}>{p.throwaways || '—'}</td>
                  <td className={p.goalDropsForced > 0 ? 'stat-bad' : 'muted'}>{p.goalDropsForced || '—'}</td>
                  <td className={p.goalThrowaways > 0 ? 'stat-bad' : 'muted'}>{p.goalThrowaways || '—'}</td>
                  <td className="muted">{avgHold(p)}</td>
                </tr>
                )
              })}
            </tbody>
            <tfoot>
              {(() => {
                const throwPct = throwTeam.throws > 0 ? throwTeam.completions / throwTeam.throws * 100 : -1
                const throwPctCls = throwPct < 0 ? 'muted' : throwPct >= 95 ? 'stat-good' : throwPct >= 90 ? 'stat-warn' : 'stat-bad'
                const goalPct = throwTeam.goalAttempts > 0 ? throwTeam.goalsThrown / throwTeam.goalAttempts * 100 : -1
                const goalPctCls = goalPct < 0 ? 'muted' : goalPct >= 90 ? 'stat-good' : goalPct >= 80 ? 'stat-warn' : 'stat-bad'
                const avgHoldTeam = throwTeam.holdCount > 0 ? `${(throwTeam.totalHoldTime / throwTeam.holdCount).toFixed(1)}s` : '—'
                return (
                  <tr className="team-row">
                    <td className="stats-name">TEAM</td>
                    <td>{throwTeam.throws}</td>
                    <td className={throwPctCls}>{throwPct < 0 ? '—' : pct(throwTeam.completions, throwTeam.throws)}</td>
                    <td className="muted">{throwTeam.goalAttempts || '—'}</td>
                    <td className={goalPctCls}>{goalPct < 0 ? '—' : pct(throwTeam.goalsThrown, throwTeam.goalAttempts)}</td>
                    <td className={throwTeam.dropsForced > 0 ? 'stat-bad' : 'muted'}>{throwTeam.dropsForced || '—'}</td>
                    <td className={throwTeam.throwaways > 0 ? 'stat-bad' : 'muted'}>{throwTeam.throwaways || '—'}</td>
                    <td className={throwTeam.goalDropsForced > 0 ? 'stat-bad' : 'muted'}>{throwTeam.goalDropsForced || '—'}</td>
                    <td className={throwTeam.goalThrowaways > 0 ? 'stat-bad' : 'muted'}>{throwTeam.goalThrowaways || '—'}</td>
                    <td className="muted">{avgHoldTeam}</td>
                  </tr>
                )
              })()}
            </tfoot>
          </table>
        </div>

        <dl className="stats-legend">
          <div><dt>Throws</dt><dd>Total throws attempted (passes and goal attempts)</dd></div>
          <div><dt>Throw %</dt><dd>Completion rate — share of throws that were successfully received</dd></div>
          <div><dt>Goal attempts</dt><dd>Throws intended as a goal</dd></div>
          <div><dt>Goal %</dt><dd>Goal conversion rate — share of throws to goal that were successfully received</dd></div>
          <div><dt>Passes (D)</dt><dd>Passes dropped by the receiver (made contact with receiver)</dd></div>
          <div><dt>Passes (TA)</dt><dd>Pass throwaways — passes thrown out of reach of receiver (no contact with receiver)</dd></div>
          <div><dt>Goals (D)</dt><dd>Throws to goal dropped by the receiver (made contact with receiver)</dd></div>
          <div><dt>Goals (TA)</dt><dd>Goal throwaways — throws to goal out of reach of receiver</dd></div>
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
            <tfoot>
              <tr className="team-row">
                <td className="stats-name">TEAM</td>
                <td>{catchTeam.catches}</td>
                <td className={catchTeam.drops > 0 ? 'stat-bad' : 'muted'}>{catchTeam.drops || '—'}</td>
                <td className="muted">{pct(catchTeam.catches, catchTeam.catches + catchTeam.drops)}</td>
                <td className={catchTeam.goalDropsReceived > 0 ? 'stat-bad' : 'muted'}>{catchTeam.goalDropsReceived || '—'}</td>
                <td className={catchTeam.goalsScored > 0 ? 'stat-good' : 'muted'}>{catchTeam.goalsScored || '—'}</td>
              </tr>
            </tfoot>
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
