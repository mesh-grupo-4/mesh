import { Router } from 'express'
import { gruposRouter } from '../modules/grupos/grupos.router'
import { usuariosRouter } from '../modules/usuarios/usuarios.router'
import { viajesRouter } from '../modules/viajes/viajes.router'

export const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/usuarios', usuariosRouter)
router.use('/grupos', gruposRouter)
router.use('/viajes', viajesRouter)
