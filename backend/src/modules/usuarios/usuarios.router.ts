import { Router } from 'express'
import { requireUser } from '../../middleware/requireUser'
import { getMe } from './usuarios.controller'

export const usuariosRouter = Router()

usuariosRouter.get('/me', requireUser, getMe)
