import { Router } from 'express'
import { createGame, listGames, loadGame, updateGameMeta } from '../services/storage'
import type { GameMeta } from '../types'

const router = Router()

router.post('/', (req, res) => {
  const { date, teamName, opponent, tournament } = req.body as Omit<GameMeta, 'id' | 'roster'>
  const gameId = createGame({ date, teamName, opponent, tournament, roster: [] })
  res.json({ gameId })
})

router.patch('/:id', (req, res) => {
  const { id } = req.params
  updateGameMeta(id, req.body as Partial<Omit<GameMeta, 'id'>>)
  res.json({ ok: true })
})

router.get('/', (_req, res) => {
  res.json(listGames())
})

router.get('/:id', (req, res) => {
  const { meta, events } = loadGame(req.params.id)
  res.json({ meta, events })
})

export default router
