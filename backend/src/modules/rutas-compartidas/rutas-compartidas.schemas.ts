import { z } from 'zod'
import { CategoriaParada, TipoActividad } from '@prisma/client'
import type { GeoJsonLineString } from '../../lib/geo'

const lineStringSchema: z.ZodType<GeoJsonLineString> = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
})

export const rutaSnapshotParadaSchema = z.object({
  orden: z.number().int().min(0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  nombre: z.string().nullable(),
  categoria: z.nativeEnum(CategoriaParada),
})

export const rutaSnapshotSchema = z.object({
  tipo_actividad: z.nativeEnum(TipoActividad),
  origen: z.object({
    lat: z.number(),
    lng: z.number(),
    nombre: z.string().nullable(),
  }),
  destino: z.object({
    lat: z.number(),
    lng: z.number(),
    nombre: z.string().nullable(),
  }),
  linestring_geojson: lineStringSchema,
  distancia_planeada_m: z.number().nullable(),
  tiempo_estimado_seg: z.number().int().nullable(),
  paradas: z.array(rutaSnapshotParadaSchema),
})

export type RutaSnapshot = z.infer<typeof rutaSnapshotSchema>

export const shareTokenParamSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Token inválido')

export const plantillaIdParamSchema = z.string().uuid()
