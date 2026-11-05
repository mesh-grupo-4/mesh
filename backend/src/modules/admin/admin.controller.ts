import type { Request, RequestHandler, Response } from 'express'
import { z } from 'zod'
import {
  actualizarUsuarioAdminSchema,
  cambiarRolSistemaSchema,
  listarAuditoriaQuery,
  listarGruposQuery,
  listarUsuariosQuery,
  listarViajesQuery,
  reasignarLiderSchema,
  suspenderUsuarioSchema,
} from './admin.schemas'
import type { AdminService } from './admin.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

const uuid = z.string().uuid()

/** Valida el parámetro de path para que un id mal formado sea 400 y no un 500 de Prisma. */
function param(req: Request, nombre: string): string {
  return uuid.parse(req.params[nombre])
}

export function crearAdminController(service: AdminService) {
  return {
    estadisticas: asyncHandler(async (_req, res) => {
      res.json(await service.estadisticas())
    }),

    // ── Usuarios ──
    listarUsuarios: asyncHandler(async (req, res) => {
      res.json(await service.listarUsuarios(listarUsuariosQuery.parse(req.query)))
    }),
    detalleUsuario: asyncHandler(async (req, res) => {
      res.json(await service.detalleUsuario(param(req, 'usuarioId')))
    }),
    actualizarUsuario: asyncHandler(async (req, res) => {
      const body = actualizarUsuarioAdminSchema.parse(req.body)
      res.json(await service.actualizarUsuario(req.userId!, param(req, 'usuarioId'), body))
    }),
    cambiarRol: asyncHandler(async (req, res) => {
      const { rol_sistema } = cambiarRolSistemaSchema.parse(req.body)
      res.json(await service.cambiarRolSistema(req.userId!, param(req, 'usuarioId'), rol_sistema))
    }),
    suspender: asyncHandler(async (req, res) => {
      const { motivo } = suspenderUsuarioSchema.parse(req.body)
      res.json(await service.suspenderUsuario(req.userId!, param(req, 'usuarioId'), motivo))
    }),
    reactivar: asyncHandler(async (req, res) => {
      res.json(await service.reactivarUsuario(req.userId!, param(req, 'usuarioId')))
    }),
    eliminarUsuario: asyncHandler(async (req, res) => {
      res.json(await service.eliminarUsuario(req.userId!, param(req, 'usuarioId')))
    }),

    // ── Grupos ──
    listarGrupos: asyncHandler(async (req, res) => {
      res.json(await service.listarGrupos(listarGruposQuery.parse(req.query)))
    }),
    detalleGrupo: asyncHandler(async (req, res) => {
      res.json(await service.detalleGrupo(param(req, 'grupoId')))
    }),
    reasignarLider: asyncHandler(async (req, res) => {
      const { usuario_id } = reasignarLiderSchema.parse(req.body)
      res.json(await service.reasignarLider(req.userId!, param(req, 'grupoId'), usuario_id))
    }),
    quitarMiembro: asyncHandler(async (req, res) => {
      res.json(
        await service.quitarMiembro(req.userId!, param(req, 'grupoId'), param(req, 'usuarioId'))
      )
    }),
    eliminarGrupo: asyncHandler(async (req, res) => {
      res.json(await service.eliminarGrupo(req.userId!, param(req, 'grupoId')))
    }),

    // ── Viajes ──
    listarViajes: asyncHandler(async (req, res) => {
      res.json(await service.listarViajes(listarViajesQuery.parse(req.query)))
    }),
    detalleViaje: asyncHandler(async (req, res) => {
      res.json(await service.detalleViaje(param(req, 'viajeId')))
    }),
    finalizarViaje: asyncHandler(async (req, res) => {
      res.json(await service.finalizarViaje(req.userId!, param(req, 'viajeId')))
    }),
    eliminarViaje: asyncHandler(async (req, res) => {
      res.json(await service.eliminarViaje(req.userId!, param(req, 'viajeId')))
    }),

    // ── Auditoría ──
    auditoria: asyncHandler(async (req, res) => {
      res.json(await service.listarAuditoria(listarAuditoriaQuery.parse(req.query)))
    }),
  }
}
