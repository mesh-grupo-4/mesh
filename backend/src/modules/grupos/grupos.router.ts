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
gruposRouter.get('/:grupoId/miembros', requireUser, c.miembros)
gruposRouter.patch('/:grupoId/miembros/:usuarioId/rol', requireUser, c.cambiarRol)
gruposRouter.get('/:grupoId/viajes-planificados', requireUser, c.viajesPlanificados)
gruposRouter.post('/:grupoId/abandonar', requireUser, c.abandonar)
gruposRouter.get('/:grupoId', requireUser, c.detalle)
gruposRouter.delete('/:grupoId', requireUser, c.eliminar)
