import type { Request, RequestHandler, Response } from 'express'
import { actualizarGastoSchema, crearGastoSchema } from './gastos.schemas'
import type { GastosService } from './gastos.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearGastosController(service: GastosService) {
  return {
    registrar: asyncHandler(async (req, res) => {
      const body = crearGastoSchema.parse(req.body)
      const gasto = await service.registrarGasto(req.userId!, (req.params.viajeId as string), body)
      res.status(201).json(gasto)
    }),

    listar: asyncHandler(async (req, res) => {
      const gastos = await service.listarGastos(req.userId!, (req.params.viajeId as string))
      res.json(gastos)
    }),

    actualizar: asyncHandler(async (req, res) => {
      const body = actualizarGastoSchema.parse(req.body)
      const gasto = await service.actualizarGasto(
        req.userId!,
        (req.params.viajeId as string),
        (req.params.gastoId as string),
        body
      )
      res.json(gasto)
    }),

    eliminar: asyncHandler(async (req, res) => {
      await service.eliminarGasto(req.userId!, (req.params.viajeId as string), (req.params.gastoId as string))
      res.status(204).end()
    }),

    balance: asyncHandler(async (req, res) => {
      const balance = await service.obtenerBalance(req.userId!, (req.params.viajeId as string))
      res.json(balance)
    }),
  }
}
