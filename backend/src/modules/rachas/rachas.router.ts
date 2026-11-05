import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearRachasController } from './rachas.controller'
import { RachasService } from './rachas.service'

const service = new RachasService(prisma)
const c = crearRachasController(service)

export const rachasRouter = Router()

rachasRouter.get('/mia', requireUser, c.mia)
rachasRouter.get('/usuario/:usuarioId', requireUser, c.deUsuario)
