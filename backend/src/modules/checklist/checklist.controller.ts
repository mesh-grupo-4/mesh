import type { Request, RequestHandler, Response } from 'express'
import {
  actualizarItemSchema,
  agregarItemSchema,
  importarChecklistSchema,
} from './checklist.schemas'
import type { ChecklistService } from './checklist.service'

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void fn(req, res).catch(next)
  }
}

export function crearChecklistController(service: ChecklistService) {
  return {
    listar: asyncHandler(async (req, res) => {
      const items = await service.miChecklist(req.userId!, req.params.viajeId as string)
      res.json(items)
    }),

    agregar: asyncHandler(async (req, res) => {
      const body = agregarItemSchema.parse(req.body)
      const item = await service.agregarItem(req.userId!, req.params.viajeId as string, body)
      res.status(201).json(item)
    }),

    actualizar: asyncHandler(async (req, res) => {
      const body = actualizarItemSchema.parse(req.body)
      const item = await service.actualizarItem(
        req.userId!,
        req.params.viajeId as string,
        req.params.itemId as string,
        body
      )
      res.json(item)
    }),

    eliminar: asyncHandler(async (req, res) => {
      await service.eliminarItem(
        req.userId!,
        req.params.viajeId as string,
        req.params.itemId as string
      )
      res.status(204).send()
    }),

    importar: asyncHandler(async (req, res) => {
      const body = importarChecklistSchema.parse(req.body)
      const resultado = await service.importarDesdeViaje(
        req.userId!,
        req.params.viajeId as string,
        body
      )
      res.json(resultado)
    }),
  }
}
