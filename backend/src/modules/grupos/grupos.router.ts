import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { GruposService } from './grupos.service'
import { crearGruposController } from './grupos.controller'

const service = new GruposService(prisma)
const c = crearGruposController(service)

export const gruposRouter = Router()

gruposRouter.get('/', requireUser, c.listar)
gruposRouter.post('/', requireUser, c.crear)
gruposRouter.get('/:grupoId', requireUser, c.detalle)
