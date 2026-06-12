import { z } from 'zod'
import { CategoriaParada, GpsSource, TipoActividad } from '@prisma/client'
import type { GeoJsonLineString, GeoJsonPoint } from '../../lib/geo'

const pointSchema: z.ZodType<GeoJsonPoint> = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
})

const lineStringSchema: z.ZodType<GeoJsonLineString> = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
})

export const createViajeSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre del viaje es obligatorio').max(100),
    esGrupal: z.boolean(),
    grupoIds: z.array(z.string().uuid()).optional().default([]),
    amigoIds: z.array(z.string().uuid()).optional().default([]),
    tipoActividad: z.nativeEnum(TipoActividad),
    fechaProgramada: z.coerce.date(),
  })
  .superRefine((data, ctx) => {
    const grupoIds = data.grupoIds ?? []
    const amigoIds = data.amigoIds ?? []
    if (!data.esGrupal && grupoIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'grupoIds solo se permiten en viajes grupales',
        path: ['grupoIds'],
      })
    }
    if (!data.esGrupal && amigoIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amigoIds solo se permiten en viajes grupales',
        path: ['amigoIds'],
      })
    }
  })

export type CreateViajeInput = z.infer<typeof createViajeSchema>

export const responderInvitacionViajeSchema = z.object({
  accion: z.enum(['aceptar', 'rechazar'], {
    errorMap: () => ({ message: 'La acción debe ser aceptar o rechazar' }),
  }),
})

export type ResponderInvitacionViajeInput = z.infer<typeof responderInvitacionViajeSchema>

export const putRutaSchema = z.object({
  origen: pointSchema,
  destino: pointSchema,
  linestring: lineStringSchema,
  tiempoEstimadoSeg: z.number().int().positive().optional().nullable(),
  paradas: z
    .array(
      z.object({
        orden: z.number().int().min(0),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        categoria: z.nativeEnum(CategoriaParada).default(CategoriaParada.otro),
      })
    )
    .max(10),
})

export type PutRutaInput = z.infer<typeof putRutaSchema>

const posicionEntradaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.number().optional().nullable(),
  timestamp: z.coerce.date(),
})

export const postPosicionesSchema = z.object({
  source: z.nativeEnum(GpsSource),
  posiciones: z.array(posicionEntradaSchema).min(1).max(2000),
})

export type PostPosicionesInput = z.infer<typeof postPosicionesSchema>
