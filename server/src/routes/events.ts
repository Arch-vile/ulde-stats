import { Router } from 'express'
import { appendEvent, insertEvent, updateEvent, deleteEvent } from '../services/storage'
import type { Event } from '../types'

const router = Router({ mergeParams: true })

router.post('/insert', (req, res) => {
  const { id } = req.params as { id: string }
  const { after_event_number, event } = req.body as { after_event_number: number; event: Event }
  const events = insertEvent(id, after_event_number, event)
  res.json({ events })
})

router.post('/', (req, res) => {
  const { id } = req.params as { id: string }
  appendEvent(id, req.body as Event)
  res.json({ ok: true })
})

router.put('/:eventNumber', (req, res) => {
  const { id } = req.params as { id: string }
  updateEvent(id, req.body as Event)
  res.json({ ok: true })
})

router.delete('/:eventNumber', (req, res) => {
  const { id, eventNumber } = req.params as { id: string; eventNumber: string }
  const events = deleteEvent(id, parseInt(eventNumber))
  res.json({ events })
})

export default router
