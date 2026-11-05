import type { Request, RequestHandler, Response } from 'express'
import { resolverPeriodo } from './reportes.periodo'
import { periodoConActividadQuery, periodoQuery, retencionQuery } from './reportes.schemas'
import type { ReportesService } from './reportes.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearReportesController(service: ReportesService) {
  const conPeriodo = (
    reporte: (p: ReturnType<typeof resolverPeriodo>) => Promise<unknown>
  ): RequestHandler =>
    asyncHandler(async (req, res) => {
      res.json(await reporte(resolverPeriodo(periodoQuery.parse(req.query))))
    })

  const conActividad = (
    reporte: (p: ReturnType<typeof resolverPeriodo>, actividad?: string) => Promise<unknown>
  ): RequestHandler =>
    asyncHandler(async (req, res) => {
      const q = periodoConActividadQuery.parse(req.query)
      res.json(await reporte(resolverPeriodo(q), q.actividad))
    })

  return {
    resumen: conPeriodo((p) => service.resumen(p)),
    crecimiento: conPeriodo((p) => service.crecimiento(p)),
    retencion: asyncHandler(async (req, res) => {
      const { meses } = retencionQuery.parse(req.query)
      res.json(await service.retencion(meses))
    }),
    viajes: conActividad((p, a) => service.viajes(p, a)),
    comunidad: conPeriodo((p) => service.comunidad(p)),
    seguridad: conActividad((p, a) => service.seguridad(p, a)),
    destinos: conActividad((p, a) => service.destinos(p, a)),
    adopcion: conPeriodo((p) => service.adopcion(p)),
    gastos: conActividad((p, a) => service.gastos(p, a)),
  }
}
