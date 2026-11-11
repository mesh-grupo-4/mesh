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
  entidad: z.enum(['usuario', 'grupo', 'viaje', 'checklist', 'insignia']).optional(),
  entidad_id: z.string().uuid().optional(),
  ...paginacion,
})

/** Mismas reglas que `syncUsuarioSchema`, pero todo opcional: se edita lo que llega. */
export const actualizarUsuarioAdminSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
    apellido: z.string().trim().max(100).nullable(),
    telefono: z.string().trim().max(30).nullable(),
    actividad_preferida: z.enum(['moto', 'auto', 'bici', 'running', 'trekking', 'otro']).nullable(),
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

export const tipoActividadParam = z.enum(['moto', 'auto', 'bici', 'running', 'trekking', 'otro'])

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

/**
 * RN-133: campos editables de una insignia del catálogo. A propósito no hay criterio de
 * velocidad (RN-070): los objetos son estrictos, así que un `criterio_velocidad` es 400.
 */
const camposInsignia = {
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
  descripcion: z
    .string()
    .trim()
    .max(200, 'La descripción no puede superar los 200 caracteres')
    .nullable()
    .transform((d) => d || null),
  /** Nombre de ícono de Feather (`@expo/vector-icons`). La app ofrece la lista válida. */
  icono: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Ícono inválido'),
  rareza: z.enum(['comun', 'rara', 'epica', 'legendaria']),
  criterio_distancia_m: z
    .number()
    .positive('La distancia mínima tiene que ser mayor a 0')
    .max(1_000_000, 'La distancia mínima no puede superar los 1000 km')
    .nullable(),
  criterio_duracion_seg: z
    .number()
    .int()
    .positive('La duración mínima tiene que ser mayor a 0')
    .max(604_800, 'La duración mínima no puede superar los 7 días')
    .nullable(),
  criterio_actividad: tipoActividadParam.nullable(),
  activa: z.boolean(),
}

export const crearInsigniaSchema = z
  .object({
    /** Slug estable: no se edita después porque el código lo referencia (p. ej. reputación). */
    codigo: z
      .string()
      .trim()
      .min(3, 'El código tiene que tener al menos 3 caracteres')
      .max(40)
      .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'Usá minúsculas, números y guiones bajos (ej.: maraton_completa)'),
    nombre: camposInsignia.nombre,
    descripcion: camposInsignia.descripcion.default(null),
    icono: camposInsignia.icono,
    rareza: camposInsignia.rareza.default('comun'),
    criterio_distancia_m: camposInsignia.criterio_distancia_m.default(null),
    criterio_duracion_seg: camposInsignia.criterio_duracion_seg.default(null),
    criterio_actividad: camposInsignia.criterio_actividad.default(null),
    activa: camposInsignia.activa.default(true),
  })
  .strict()

/** Se edita lo que llega. El código no está: es inmutable. */
export const actualizarInsigniaSchema = z
  .object(camposInsignia)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'No hay campos para actualizar')

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuery>
export type ListarGruposQuery = z.infer<typeof listarGruposQuery>
export type ListarViajesQuery = z.infer<typeof listarViajesQuery>
export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuery>
export type ActualizarUsuarioAdminInput = z.infer<typeof actualizarUsuarioAdminSchema>
export type TipoActividadParam = z.infer<typeof tipoActividadParam>
export type CrearInsigniaInput = z.infer<typeof crearInsigniaSchema>
export type ActualizarInsigniaInput = z.infer<typeof actualizarInsigniaSchema>
