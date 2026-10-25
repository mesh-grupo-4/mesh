import type { Request, RequestHandler, Response } from 'express'
import {
  listarRecorridosQuery,
  recorridoIdParamSchema,
  viajeIdParamSchema,
} from './recorridos-publicados.schemas'
import type { RecorridosPublicadosService } from './recorridos-publicados.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearRecorridosPublicadosController(service: RecorridosPublicadosService) {
  return {
    publicar: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      res.status(201).json(await service.publicar(req.userId!, viajeId))
    }),

    despublicar: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      await service.despublicar(req.userId!, viajeId)
      res.status(204).end()
    }),

    mios: asyncHandler(async (req, res) => {
      res.json(await service.idsViajesPublicados(req.userId!))
    }),

    listar: asyncHandler(async (req, res) => {
      res.json(await service.listar(listarRecorridosQuery.parse(req.query)))
    }),

    obtener: asyncHandler(async (req, res) => {
      const { recorridoId } = recorridoIdParamSchema.parse(req.params)
      res.json(await service.obtener(recorridoId))
    }),
  }
}
