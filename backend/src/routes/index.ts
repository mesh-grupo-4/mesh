import { Router } from 'express'
import { viajesRouter } from '../modules/viajes/viajes.router'

export const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/viajes', viajesRouter)
