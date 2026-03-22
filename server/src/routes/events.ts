import { Router } from 'express'
import { appendEvent, updateEventOutcome } from '../services/csv'
import type { Event, Outcome } from '../types'

const router = Router({ mergeParams: true })

router.post('/', (req, res) => {
  const { id } = req.params as { id: string }
  appendEvent(id, req.body as Event)
  res.json({ ok: true })
})

router.patch('/:eventNumber', (req, res) => {
  const { id, eventNumber } = req.params as { id: string; eventNumber: string }
  const { outcome } = req.body as { outcome: Outcome }
  updateEventOutcome(id, parseInt(eventNumber), outcome)
  res.json({ ok: true })
})

export default router
