import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { GruposService } from './grupos.service'
import { crearGruposController } from './grupos.controller'
import { FotosGrupoService } from './grupos.fotos'

const service = new GruposService(prisma)
const c = crearGruposController(service, new FotosGrupoService(prisma))

export const gruposRouter = Router()

gruposRouter.get('/', requireUser, c.listar)
gruposRouter.post('/', requireUser, c.crear)
gruposRouter.get('/invitaciones/pendientes', requireUser, c.invitacionesPendientes)
gruposRouter.post('/invitaciones/:invitacionId/responder', requireUser, c.responderInvitacion)
gruposRouter.get('/:grupoId/miembros', requireUser, c.miembros)
gruposRouter.get('/:grupoId/viajes', requireUser, c.viajes)
gruposRouter.patch('/:grupoId/miembros/:usuarioId/rol', requireUser, c.cambiarRol)
gruposRouter.get('/:grupoId/grupos-para-invitar', requireUser, c.gruposParaInvitar)
gruposRouter.get('/:grupoId/amigos-para-invitar', requireUser, c.amigosParaInvitar)
gruposRouter.get('/:grupoId/buscar-usuarios', requireUser, c.buscarUsuarios)
gruposRouter.get('/:grupoId/usuarios-para-invitar', requireUser, c.usuariosParaInvitar)
gruposRouter.post('/:grupoId/invitar-usuarios', requireUser, c.invitarUsuarios)
gruposRouter.post('/:grupoId/invitar-desde-grupos', requireUser, c.invitarDesdeGrupos)
gruposRouter.post('/:grupoId/abandonar', requireUser, c.abandonar)
// Foto del grupo (Supabase Storage): subida firmada → confirmación en el backend.
gruposRouter.post('/:grupoId/foto/subida', requireUser, c.crearSubidaFoto)
gruposRouter.put('/:grupoId/foto', requireUser, c.confirmarFoto)
gruposRouter.delete('/:grupoId/foto', requireUser, c.eliminarFoto)
gruposRouter.get('/:grupoId', requireUser, c.detalle)
gruposRouter.delete('/:grupoId', requireUser, c.eliminar)
