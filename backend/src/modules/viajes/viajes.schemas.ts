import { z } from 'zod'
import { CategoriaParada, GpsSource, TipoActividad } from '@prisma/client'
import type { GeoJsonLineString, GeoJsonPoint } from '../../lib/geo'
import { RANGO_PARAMETROS } from './activityDefaults'

/** RN-025: parámetros del grupo que el líder puede ajustar. */
const velocidadEsperadaSchema = z
  .number()
  .min(RANGO_PARAMETROS.velocidadEsperada.min)
  .max(RANGO_PARAMETROS.velocidadEsperada.max)
const distanciaMaxSeparacionSchema = z
  .number()
  .int()
  .min(RANGO_PARAMETROS.distanciaMaxSeparacion.min)
  .max(RANGO_PARAMETROS.distanciaMaxSeparacion.max)
const toleranciaAtrasoMinSchema = z
  .number()
  .int()
  .min(RANGO_PARAMETROS.toleranciaAtrasoMin.min)
  .max(RANGO_PARAMETROS.toleranciaAtrasoMin.max)

const pointSchema: z.ZodType<GeoJsonPoint> = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
})

const lineStringSchema: z.ZodType<GeoJsonLineString> = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
})

export const viajeIdParamSchema = z.object({
  viajeId: z.string().uuid('viajeId debe ser un UUID válido'),
})

/** Fecha/hora de salida: debe ser estrictamente posterior a ahora (RN-028). */
const fechaProgramadaFuturaSchema = z.coerce.date().superRefine((d, ctx) => {
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha programada inválida' })
    return
  }
  if (d.getTime() <= Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La fecha programada debe ser futura',
    })
  }
})

export const createViajeSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre del viaje es obligatorio').max(100),
    esGrupal: z.boolean(),
    grupoIds: z.array(z.string().uuid()).optional().default([]),
    amigoIds: z.array(z.string().uuid()).optional().default([]),
    tipoActividad: z.nativeEnum(TipoActividad),
    /** RN-065 / RN-071: `competitivo` exige viaje grupal y no moto (RN-070); lo valida el servicio. */
    modo: z.enum(['recreativo', 'entrenamiento', 'competitivo']).optional().default('recreativo'),
    fechaProgramada: fechaProgramadaFuturaSchema,
    /** Opcional: precarga la ruta desde una plantilla propia del creador. */
    rutaPlantillaId: z.string().uuid().optional().nullable(),
    /** RN-025: si no vienen, el backend aplica los defaults de la actividad (RN-021). */
    velocidadEsperada: velocidadEsperadaSchema.optional(),
    distanciaMaxSeparacion: distanciaMaxSeparacionSchema.optional(),
    toleranciaAtrasoMin: toleranciaAtrasoMinSchema.optional(),
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

export const actualizarViajeSchema = z
  .object({
    fechaProgramada: fechaProgramadaFuturaSchema.optional(),
    alertaIncidenteHabilitada: z.boolean().optional(),
    alertaIncidenteMinutos: z.number().int().min(2).max(30).nullable().optional(),
    alertasSoloLider: z.boolean().optional(),
    velocidadEsperada: velocidadEsperadaSchema.optional(),
    distanciaMaxSeparacion: distanciaMaxSeparacionSchema.optional(),
    /** `null` vuelve al default por actividad. */
    toleranciaAtrasoMin: toleranciaAtrasoMinSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const tieneCampo =
      data.fechaProgramada != null ||
      data.alertaIncidenteHabilitada != null ||
      data.alertaIncidenteMinutos !== undefined ||
      data.alertasSoloLider != null ||
      data.velocidadEsperada != null ||
      data.distanciaMaxSeparacion != null ||
      data.toleranciaAtrasoMin !== undefined
    if (!tieneCampo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enviá al menos un campo para actualizar',
      })
    }
  })

export type ActualizarViajeInput = z.infer<typeof actualizarViajeSchema>

export const putRutaSchema = z.object({
  origen: pointSchema,
  destino: pointSchema,
  origenNombre: z.string().trim().max(200).optional().nullable(),
  destinoNombre: z.string().trim().max(200).optional().nullable(),
  linestring: lineStringSchema,
  tiempoEstimadoSeg: z.number().int().positive().optional().nullable(),
  paradas: z
    .array(
      z.object({
        orden: z.number().int().min(0),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        nombre: z.string().trim().max(200).optional().nullable(),
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

export const fantasmaQuerySchema = z
  .object({
    viajeRef: z.string().uuid().optional(),
    usuarioRef: z.string().uuid().optional(),
    plantillaId: z.string().uuid().optional(),
  })
  .refine((q) => Boolean(q.plantillaId) !== Boolean(q.viajeRef), {
    message: 'Indicá viajeRef (y opcionalmente usuarioRef) o plantillaId, no ambos',
  })

export type FantasmaQuery = z.infer<typeof fantasmaQuerySchema>

export type PostPosicionesInput = z.infer<typeof postPosicionesSchema>

export const upsertUbicacionVivaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.number().optional().nullable(),
  recordedAt: z.coerce.date(),
})

export type UpsertUbicacionVivaInput = z.infer<typeof upsertUbicacionVivaSchema>
