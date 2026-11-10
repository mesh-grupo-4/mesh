import type { Request, RequestHandler, Response } from 'express'
import {
  autocompletarQuerySchema,
  buscarLugaresQuerySchema,
  detalleLugarParamsSchema,
  detalleLugarQuerySchema,
  reverseGeocodingQuerySchema,
} from './geocoding.schemas'
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

    autocompletar: asyncHandler(async (req, res) => {
      const { q, lat, lng, sesion } = autocompletarQuerySchema.parse(req.query)
      const cerca = lat !== undefined && lng !== undefined ? { lat, lng } : undefined
      res.json(await service.autocompletar(q, { cerca, sesion }))
    }),

    detalleLugar: asyncHandler(async (req, res) => {
      const { placeId } = detalleLugarParamsSchema.parse(req.params)
      const { sesion } = detalleLugarQuerySchema.parse(req.query)
      res.json(await service.detalleLugar(placeId, sesion))
    }),

    reverse: asyncHandler(async (req, res) => {
      const { lat, lng } = reverseGeocodingQuerySchema.parse(req.query)
      const resultado = await service.reverseGeocode(lat, lng)
      res.json(resultado)
    }),
  }
}
