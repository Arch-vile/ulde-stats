import { Router } from 'express'
import { appendEvent } from '../services/csv'
import type { Event } from '../types'

const router = Router({ mergeParams: true })

router.post('/', (req, res) => {
  const { id } = req.params as { id: string }
  appendEvent(id, req.body as Event)
  res.json({ ok: true })
})

export default router
