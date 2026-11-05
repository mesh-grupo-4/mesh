import type { Request, RequestHandler, Response } from 'express'
import {
  listarRecorridosQuery,
  recorridoIdParamSchema,
  valorarRecorridoBody,
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
      res.json(await service.listar(req.userId!, listarRecorridosQuery.parse(req.query)))
    }),

    obtener: asyncHandler(async (req, res) => {
      const { recorridoId } = recorridoIdParamSchema.parse(req.params)
      res.json(await service.obtener(req.userId!, recorridoId))
    }),

    valorar: asyncHandler(async (req, res) => {
      const { recorridoId } = recorridoIdParamSchema.parse(req.params)
      const { recomiendo } = valorarRecorridoBody.parse(req.body)
      res.status(201).json(await service.valorar(req.userId!, recorridoId, recomiendo))
    }),

    importar: asyncHandler(async (req, res) => {
      const { recorridoId } = recorridoIdParamSchema.parse(req.params)
      const out = await service.importar(req.userId!, recorridoId)
      res.status(out.ya_existia ? 200 : 201).json(out)
    }),
  }
}
