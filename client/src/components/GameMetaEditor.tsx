import { useState } from 'react'
import { updateGameMeta } from '../api'

interface MetaFields {
  teamName: string
  opponent: string
  tournament: string
  date: string
  videoUrl: string
}

interface GameMetaEditorProps {
  gameId: string
  initial: MetaFields
  onSave: (meta: MetaFields) => void
  onClose: () => void
}

export function GameMetaEditor({ gameId, initial, onSave, onClose }: GameMetaEditorProps) {
  const [teamName, setTeamName] = useState(initial.teamName)
  const [opponent, setOpponent] = useState(initial.opponent)
  const [tournament, setTournament] = useState(initial.tournament)
  const [date, setDate] = useState(initial.date)
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const meta: MetaFields = {
      teamName: teamName.trim(),
      opponent: opponent.trim(),
      tournament: tournament.trim(),
      date,
      videoUrl: videoUrl.trim(),
    }
    await updateGameMeta(gameId, meta)
    setSaving(false)
    onSave(meta)
  }

  return (
    <div className="meta-editor-overlay" onClick={onClose}>
      <div className="meta-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="meta-editor-header">
          <h3>Edit game</h3>
          <button className="meta-editor-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSave}>
          <label>
            Our team
            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Team name"
              autoFocus
            />
          </label>
          <label>
            Opponent
            <input
              type="text"
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              placeholder="Opponent team name"
            />
          </label>
          <label>
            Tournament
            <input
              type="text"
              value={tournament}
              onChange={e => setTournament(e.target.value)}
              placeholder="Tournament name (optional)"
            />
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>
            YouTube URL
            <input
              type="text"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... (optional)"
            />
          </label>
          <div className="meta-editor-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!opponent.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
