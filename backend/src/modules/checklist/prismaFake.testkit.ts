import type { PrismaClient } from '@prisma/client'

/**
 * Prisma en memoria para los tests del checklist.
 *
 * El servicio no hace cálculos aislados: siembra, sincroniza copias e importa
 * comparando filas. Con `vi.fn()` sueltos habría que aceptar de antemano el
 * resultado de cada consulta, así que los tests no probarían la lógica real.
 * Esta implementación cubre el subconjunto de Prisma que el servicio usa —
 * incluida la cascada de `origen_item_id`, que en producción hace la FK.
 *
 * Convención `*.testkit.ts`: excluido de `tsconfig.json`, no llega a `dist/`
 * (regla del proyecto: nada de mocks en código de producción).
 */

export type FilaChecklist = {
  id: string
  viaje_id: string
  usuario_id: string
  origen_item_id: string | null
  texto: string
  origen: string
  completado: boolean
  orden: number
  created_at: Date
  updated_at: Date
}

type Where = Record<string, unknown>

function coincide(fila: Record<string, unknown>, where: Where | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([campo, esperado]) => {
    const actual = fila[campo]
    if (esperado !== null && typeof esperado === 'object') {
      const cond = esperado as { in?: unknown[]; not?: unknown }
      if (cond.in) return cond.in.includes(actual)
      if ('not' in cond) return actual !== cond.not
    }
    return actual === esperado
  })
}

function ordenar<T extends Record<string, unknown>>(
  filas: T[],
  orderBy: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[] | undefined
): T[] {
  if (!orderBy) return filas
  const criterios = Array.isArray(orderBy) ? orderBy : [orderBy]
  return [...filas].sort((a, b) => {
    for (const criterio of criterios) {
      const [campo, dir] = Object.entries(criterio)[0] as [string, 'asc' | 'desc']
      const va = a[campo] as number | string | Date
      const vb = b[campo] as number | string | Date
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
    }
    return 0
  })
}

export type OpcionesFake = {
  viaje: { creador_id: string; estado: string; tipo_actividad: string }
  /** Viajes extra, por id, para probar la importación desde otro viaje. */
  otrosViajes?: Record<string, { creador_id: string; estado: string; tipo_actividad: string }>
  /** Integrantes confirmados del viaje principal, sin contar al creador. */
  integrantes?: string[]
  viajeId: string
  filasIniciales?: FilaChecklist[]
}

export function crearPrismaFake(opts: OpcionesFake) {
  const filas: FilaChecklist[] = [...(opts.filasIniciales ?? [])]
  let secuencia = filas.length

  const nuevaFila = (data: Partial<FilaChecklist>): FilaChecklist => {
    secuencia += 1
    const ahora = new Date(Date.UTC(2026, 7, 26, 12, 0, secuencia))
    return {
      id: `item-${secuencia}`,
      viaje_id: data.viaje_id as string,
      usuario_id: data.usuario_id as string,
      origen_item_id: data.origen_item_id ?? null,
      texto: data.texto as string,
      origen: data.origen as string,
      completado: data.completado ?? false,
      orden: data.orden as number,
      created_at: ahora,
      updated_at: ahora,
    }
  }

  const esDuplicado = (f: FilaChecklist) =>
    filas.some(
      (x) => x.viaje_id === f.viaje_id && x.usuario_id === f.usuario_id && x.texto === f.texto
    )

  /** Cascada de `checklist_item_origen_item_id_fkey ON DELETE CASCADE`. */
  const borrarConCopias = (id: string) => {
    const hijos = filas.filter((f) => f.origen_item_id === id).map((f) => f.id)
    for (let i = filas.length - 1; i >= 0; i -= 1) {
      if (filas[i]!.id === id || hijos.includes(filas[i]!.id)) filas.splice(i, 1)
    }
  }

  const viajes: Record<string, { creador_id: string; estado: string; tipo_actividad: string }> = {
    [opts.viajeId]: opts.viaje,
    ...(opts.otrosViajes ?? {}),
  }

  const prisma = {
    viaje: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(viajes[where.id] ?? null),
    },
    viajeIntegrante: {
      findUnique: ({ where }: { where: { viaje_id_usuario_id: { usuario_id: string } } }) => {
        const uid = where.viaje_id_usuario_id.usuario_id
        return Promise.resolve(
          (opts.integrantes ?? []).includes(uid) ? { estado: 'confirmado' } : null
        )
      },
      findMany: ({ where }: { where: Where }) =>
        Promise.resolve(
          (opts.integrantes ?? [])
            .map((usuario_id) => ({ usuario_id, viaje_id: opts.viajeId, estado: 'confirmado' }))
            .filter((f) => coincide(f, where))
            .map((f) => ({ usuario_id: f.usuario_id }))
        ),
    },
    checklistItem: {
      findMany: ({ where, orderBy }: { where?: Where; orderBy?: never }) =>
        Promise.resolve(ordenar(filas.filter((f) => coincide(f, where)), orderBy)),

      findFirst: ({ where, orderBy }: { where?: Where; orderBy?: never }) =>
        Promise.resolve(ordenar(filas.filter((f) => coincide(f, where)), orderBy)[0] ?? null),

      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(filas.find((f) => f.id === where.id) ?? null),

      create: ({ data }: { data: Partial<FilaChecklist> }) => {
        const fila = nuevaFila(data)
        if (esDuplicado(fila)) return Promise.reject(new Error('unique constraint'))
        filas.push(fila)
        return Promise.resolve(fila)
      },

      createMany: ({ data }: { data: Partial<FilaChecklist>[] }) => {
        let count = 0
        for (const d of data) {
          const fila = nuevaFila(d)
          if (esDuplicado(fila)) continue
          filas.push(fila)
          count += 1
        }
        return Promise.resolve({ count })
      },

      update: ({ where, data }: { where: { id: string }; data: Partial<FilaChecklist> }) => {
        const fila = filas.find((f) => f.id === where.id)!
        Object.assign(fila, data, { updated_at: new Date(fila.updated_at.getTime() + 1000) })
        return Promise.resolve(fila)
      },

      updateMany: ({ where, data }: { where: Where; data: Partial<FilaChecklist> }) => {
        const objetivo = filas.filter((f) => coincide(f, where))
        objetivo.forEach((f) => Object.assign(f, data))
        return Promise.resolve({ count: objetivo.length })
      },

      delete: ({ where }: { where: { id: string } }) => {
        const fila = filas.find((f) => f.id === where.id)!
        borrarConCopias(where.id)
        return Promise.resolve(fila)
      },

      groupBy: ({ where }: { where: Where }) => {
        const porUsuario = new Map<string, number>()
        for (const f of filas.filter((x) => coincide(x, where))) {
          porUsuario.set(f.usuario_id, Math.max(porUsuario.get(f.usuario_id) ?? -1, f.orden))
        }
        return Promise.resolve(
          [...porUsuario].map(([usuario_id, orden]) => ({ usuario_id, _max: { orden } }))
        )
      },
    },
  } as unknown as PrismaClient

  return { prisma, filas }
}
