import type { Request, RequestHandler, Response } from 'express'
import {
  plantillaIdParamSchema,
  shareTokenParamSchema,
} from './rutas-compartidas.schemas'
// Estos dos handlers se montan bajo /api/viajes/:viajeId/ruta/compartir.
import { viajeIdParamSchema } from '../viajes/viajes.schemas'
import type { RutasCompartidasService } from './rutas-compartidas.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearRutasCompartidasController(service: RutasCompartidasService) {
  return {
    compartir: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      const out = await service.compartirRuta(req.userId!, viajeId)
      res.json(out)
    }),

    revocar: asyncHandler(async (req, res) => {
      const { viajeId } = viajeIdParamSchema.parse(req.params)
      const out = await service.revocarCompartir(req.userId!, viajeId)
      res.json(out)
    }),

    preview: asyncHandler(async (req, res) => {
      const token = shareTokenParamSchema.parse(req.params.token)
      const out = await service.previewPorToken(req.userId!, token)
      res.json(out)
    }),

    importar: asyncHandler(async (req, res) => {
      const token = shareTokenParamSchema.parse(req.params.token)
      const out = await service.importarPorToken(req.userId!, token)
      res.status(out.ya_existia ? 200 : 201).json(out)
    }),

    listarPlantillas: asyncHandler(async (req, res) => {
      const out = await service.listarPlantillas(req.userId!)
      res.json(out)
    }),

    obtenerPlantilla: asyncHandler(async (req, res) => {
      const plantillaId = plantillaIdParamSchema.parse(req.params.plantillaId)
      const out = await service.obtenerPlantilla(req.userId!, plantillaId)
      res.json(out)
    }),

    eliminarPlantilla: asyncHandler(async (req, res) => {
      const plantillaId = plantillaIdParamSchema.parse(req.params.plantillaId)
      const out = await service.eliminarPlantilla(req.userId!, plantillaId)
      res.json(out)
    }),
  }
}
