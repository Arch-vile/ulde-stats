import { Router } from 'express'
import { createGame, listGames, loadGame } from '../services/csv'

const router = Router()

router.post('/', (req, res) => {
  const { opponent, date } = req.body as { opponent: string; date: string }
  const gameId = createGame(opponent, date)
  res.json({ gameId })
})

router.get('/', (_req, res) => {
  res.json(listGames())
})

router.get('/:id', (req, res) => {
  const { meta, events } = loadGame(req.params.id)
  res.json({ meta, events })
})

export default router
