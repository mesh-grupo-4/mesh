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
gruposRouter.get('/invitaciones/pendientes', requireUser, c.invitacionesPendientes)
gruposRouter.post('/invitaciones/:invitacionId/responder', requireUser, c.responderInvitacion)
gruposRouter.get('/:grupoId/miembros', requireUser, c.miembros)
gruposRouter.patch('/:grupoId/miembros/:usuarioId/rol', requireUser, c.cambiarRol)
gruposRouter.get('/:grupoId/grupos-para-invitar', requireUser, c.gruposParaInvitar)
gruposRouter.get('/:grupoId/usuarios-para-invitar', requireUser, c.usuariosParaInvitar)
gruposRouter.post('/:grupoId/invitar-usuarios', requireUser, c.invitarUsuarios)
gruposRouter.post('/:grupoId/invitar-desde-grupos', requireUser, c.invitarDesdeGrupos)
gruposRouter.post('/:grupoId/abandonar', requireUser, c.abandonar)
gruposRouter.get('/:grupoId', requireUser, c.detalle)
gruposRouter.delete('/:grupoId', requireUser, c.eliminar)
