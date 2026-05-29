import { Router } from 'express'
import { viajesRouter } from '../modules/viajes/viajes.router'
import { usuariosRouter } from '../modules/usuarios/usuarios.router'

export const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/usuarios', usuariosRouter)
router.use('/viajes', viajesRouter)
