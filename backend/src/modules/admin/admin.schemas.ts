import { z } from 'zod'

const paginacion = {
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}

const busqueda = z.string().trim().min(1).max(80).optional()

export const listarUsuariosQuery = z.object({
  q: busqueda,
  rol: z.enum(['usuario', 'superadmin']).optional(),
  estado: z.enum(['activo', 'suspendido']).optional(),
  ...paginacion,
})

export const listarGruposQuery = z.object({
  q: busqueda,
  ...paginacion,
})

/** Sin búsqueda por nombre: los viajes se listan anónimos (RN-126). */
export const listarViajesQuery = z.object({
  estado:z.enum(['planificado', 'en_curso', 'finalizado']).optional(),
  ...paginacion,
})

export const listarAuditoriaQuery = z.object({
  accion: z.string().trim().min(1).max(60).optional(),
  entidad: z.enum(['usuario', 'grupo', 'viaje', 'checklist']).optional(),
  entidad_id: z.string().uuid().optional(),
  ...paginacion,
})

/** Mismas reglas que `syncUsuarioSchema`, pero todo opcional: se edita lo que llega. */
export const actualizarUsuarioAdminSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
    apellido: z.string().trim().max(100).nullable(),
    telefono: z.string().trim().max(30).nullable(),
    actividad_preferida: z.enum(['moto', 'bici', 'running', 'trekking', 'otro']).nullable(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'No hay campos para actualizar')

export const cambiarRolSistemaSchema = z.object({
  rol_sistema: z.enum(['usuario', 'superadmin']),
})

export const suspenderUsuarioSchema = z.object({
  motivo: z.string().trim().min(3, 'Indicá el motivo de la suspensión').max(500),
})

export const reasignarLiderSchema = z.object({
  usuario_id: z.string().uuid(),
})

export const tipoActividadParam = z.enum(['moto', 'bici', 'running', 'trekking', 'otro'])

/**
 * RN-132: la lista completa de sugeridos de una actividad, en orden. Mismo límite de
 * texto que `checklist_item.texto` (120), y sin repetidos: la siembra los descartaría.
 */
export const definirChecklistActividadSchema = z.object({
  items: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'El ítem no puede estar vacío')
        .max(120, 'El ítem no puede superar los 120 caracteres')
    )
    .min(1, 'Dejá al menos un ítem sugerido')
    .max(30, 'Hasta 30 ítems sugeridos por actividad')
    .refine((items) => new Set(items).size === items.length, 'Hay ítems repetidos'),
})

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuery>
export type ListarGruposQuery = z.infer<typeof listarGruposQuery>
export type ListarViajesQuery = z.infer<typeof listarViajesQuery>
export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuery>
export type ActualizarUsuarioAdminInput = z.infer<typeof actualizarUsuarioAdminSchema>
export type TipoActividadParam = z.infer<typeof tipoActividadParam>
