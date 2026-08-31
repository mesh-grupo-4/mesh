import type { Request, RequestHandler, Response } from 'express'
import { buscarLugaresQuerySchema, reverseGeocodingQuerySchema } from './geocoding.schemas'
import type { GeocodingService } from './geocoding.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearGeocodingController(service: GeocodingService) {
  return {
    buscar: asyncHandler(async (req, res) => {
      const { q } = buscarLugaresQuerySchema.parse(req.query)
      const resultados = await service.buscar(q)
      res.json(resultados)
    }),

    reverse: asyncHandler(async (req, res) => {
      const { lat, lng } = reverseGeocodingQuerySchema.parse(req.query)
      const resultado = await service.reverseGeocode(lat, lng)
      res.json(resultado)
    }),
  }
}
