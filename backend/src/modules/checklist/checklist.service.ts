import type { PrismaClient, TipoActividad } from '@prisma/client'
import { HttpError } from '../../lib/httpError'
import { itemsSugeridos } from './checklistDefaults'
import type {
  ActualizarItemInput,
  AgregarItemInput,
  ImportarChecklistInput,
} from './checklist.schemas'

type ItemFila = {
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

type Acceso = {
  creadorId: string
  esCreador: boolean
  estado: string
  tipoActividad: TipoActividad
}

export class ChecklistService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * RN-030: el backend valida. Para tocar el checklist hay que participar del viaje
   * —creador o integrante confirmado—. A diferencia de las paradas, el checklist es
   * pre-ruta: se usa en `planificado` y sigue disponible `en_curso`.
   */
  private async assertParticipa(
    viajeId: string,
    usuarioId: string,
    codigoNotFound = 'VIAJE_NOT_FOUND'
  ): Promise<Acceso> {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id: viajeId },
      select: { creador_id: true, estado: true, tipo_actividad: true },
    })
    if (!viaje) {
      throw new HttpError(404, 'Viaje no encontrado', codigoNotFound)
    }

    const base = {
      creadorId: viaje.creador_id,
      estado: viaje.estado,
      tipoActividad: viaje.tipo_actividad,
    }
    if (viaje.creador_id === usuarioId) {
      return { ...base, esCreador: true }
    }

    const integrante = await this.prisma.viajeIntegrante.findUnique({
      where: { viaje_id_usuario_id: { viaje_id: viajeId, usuario_id: usuarioId } },
      select: { estado: true },
    })
    if (integrante?.estado !== 'confirmado') {
      throw new HttpError(403, 'Sin acceso a este viaje', 'FORBIDDEN')
    }
    return { ...base, esCreador: false }
  }

  /** Un viaje finalizado ya no se prepara: el checklist queda como registro de solo lectura. */
  private assertEditable(acceso: Acceso): void {
    if (acceso.estado === 'finalizado') {
      throw new HttpError(409, 'El viaje ya finalizó', 'INVALID_STATE')
    }
  }

  // ------------------------------------------------------------------ lectura

  /**
   * Checklist del consultante para ese viaje, sincronizado antes de devolverlo:
   * la primera vez siembra los sugeridos de la actividad (RN-026) y siempre agrega
   * los ítems base que el creador haya sumado desde la última consulta.
   */
  async miChecklist(usuarioId: string, viajeId: string) {
    const acceso = await this.assertParticipa(viajeId, usuarioId)
    await this.sincronizar(viajeId, usuarioId, acceso)

    const items = await this.prisma.checklistItem.findMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
      orderBy: [{ orden: 'asc' }, { created_at: 'asc' }],
    })
    return items.map((i) => this.mapItem(i))
  }

  /**
   * Deja el checklist del usuario al día. Es idempotente: el índice único
   * (viaje, usuario, texto) absorbe cualquier duplicado, así que se puede llamar
   * en cada lectura sin ensuciar la lista.
   */
  private async sincronizar(viajeId: string, usuarioId: string, acceso: Acceso): Promise<void> {
    // Un viaje finalizado no se re-siembra: lo que quedó registrado es el histórico.
    if (acceso.estado === 'finalizado') return

    const mios = await this.prisma.checklistItem.findMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
      select: { origen_item_id: true, orden: true },
    })

    let siguienteOrden = mios.reduce((max, i) => Math.max(max, i.orden), -1) + 1

    // Primera vez: sugeridos según el tipo de actividad (RN-026).
    if (mios.length === 0) {
      const sugeridos = itemsSugeridos(acceso.tipoActividad)
      await this.prisma.checklistItem.createMany({
        data: sugeridos.map((texto, i) => ({
          viaje_id: viajeId,
          usuario_id: usuarioId,
          texto,
          origen: 'sugerido' as const,
          orden: i,
        })),
        skipDuplicates: true,
      })
      siguienteOrden = sugeridos.length
    }

    // El creador es el dueño de los ítems base: sus propias filas son el original.
    if (acceso.esCreador) return

    const base = await this.prisma.checklistItem.findMany({
      where: { viaje_id: viajeId, usuario_id: acceso.creadorId, origen: 'lider' },
      orderBy: { orden: 'asc' },
      select: { id: true, texto: true },
    })
    if (base.length === 0) return

    const yaCopiados = new Set(mios.map((i) => i.origen_item_id).filter(Boolean))
    const faltantes = base.filter((b) => !yaCopiados.has(b.id))
    if (faltantes.length === 0) return

    await this.prisma.checklistItem.createMany({
      data: faltantes.map((b, i) => ({
        viaje_id: viajeId,
        usuario_id: usuarioId,
        origen_item_id: b.id,
        texto: b.texto,
        origen: 'lider' as const,
        orden: siguienteOrden + i,
      })),
      skipDuplicates: true,
    })
  }

  // ----------------------------------------------------------------- escritura

  /**
   * Agrega un ítem. Por defecto es personal; con `paraTodos` el creador lo define
   * como base del viaje y se propaga al checklist de cada integrante confirmado.
   */
  async agregarItem(usuarioId: string, viajeId: string, input: AgregarItemInput) {
    const acceso = await this.assertParticipa(viajeId, usuarioId)
    this.assertEditable(acceso)
    await this.sincronizar(viajeId, usuarioId, acceso)

    if (input.paraTodos && !acceso.esCreador) {
      throw new HttpError(
        403,
        'Solo el creador del viaje puede agregar ítems para todo el grupo',
        'NOT_CREATOR'
      )
    }

    const duplicado = await this.prisma.checklistItem.findFirst({
      where: { viaje_id: viajeId, usuario_id: usuarioId, texto: input.texto },
      select: { id: true },
    })
    if (duplicado) {
      throw new HttpError(409, 'Ese ítem ya está en tu checklist', 'ITEM_DUPLICADO')
    }

    const item = await this.prisma.checklistItem.create({
      data: {
        viaje_id: viajeId,
        usuario_id: usuarioId,
        texto: input.texto,
        origen: input.paraTodos ? 'lider' : 'personal',
        orden: await this.siguienteOrden(viajeId, usuarioId),
      },
    })

    if (input.paraTodos) {
      await this.propagarABasesDeIntegrantes(viajeId, usuarioId, item.id, item.texto)
    }

    return this.mapItem(item)
  }

  /** Marca o desmarca un ítem, o le corrige el texto. Solo sobre ítems propios. */
  async actualizarItem(
    usuarioId: string,
    viajeId: string,
    itemId: string,
    input: ActualizarItemInput
  ) {
    const acceso = await this.assertParticipa(viajeId, usuarioId)
    this.assertEditable(acceso)
    const item = await this.buscarItemPropio(viajeId, usuarioId, itemId)

    // El texto de un ítem base lo maneja el creador; el integrante solo lo tilda.
    if (input.texto !== undefined && this.esCopiaDeBase(item)) {
      throw new HttpError(
        403,
        'Ese ítem lo definió el creador del viaje: podés marcarlo, no editarlo',
        'ITEM_OBLIGATORIO'
      )
    }

    if (input.texto !== undefined && input.texto !== item.texto) {
      const duplicado = await this.prisma.checklistItem.findFirst({
        where: { viaje_id: viajeId, usuario_id: usuarioId, texto: input.texto },
        select: { id: true },
      })
      if (duplicado) {
        throw new HttpError(409, 'Ese ítem ya está en tu checklist', 'ITEM_DUPLICADO')
      }
    }

    const actualizado = await this.prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(input.texto !== undefined ? { texto: input.texto } : {}),
        ...(input.completado !== undefined ? { completado: input.completado } : {}),
      },
    })

    // Si el creador reescribe un ítem base, las copias del grupo lo reflejan.
    if (input.texto !== undefined && item.origen === 'lider' && item.origen_item_id === null) {
      await this.prisma.checklistItem.updateMany({
        where: { origen_item_id: itemId },
        data: { texto: input.texto },
      })
    }

    return this.mapItem(actualizado)
  }

  /**
   * Borra un ítem propio. Los ítems base solo los borra el creador, y al hacerlo
   * desaparecen del checklist de todo el grupo (cascada por `origen_item_id`).
   */
  async eliminarItem(usuarioId: string, viajeId: string, itemId: string) {
    const acceso = await this.assertParticipa(viajeId, usuarioId)
    this.assertEditable(acceso)
    const item = await this.buscarItemPropio(viajeId, usuarioId, itemId)

    if (this.esCopiaDeBase(item)) {
      throw new HttpError(
        403,
        'Ese ítem lo definió el creador del viaje y no se puede borrar',
        'ITEM_OBLIGATORIO'
      )
    }

    await this.prisma.checklistItem.delete({ where: { id: itemId } })
  }

  /**
   * RN-026 (reutilización): copia a este viaje los ítems que el usuario tenía en un
   * viaje anterior del que participó. No pisa lo que ya está: los repetidos se ignoran.
   */
  async importarDesdeViaje(usuarioId: string, viajeId: string, input: ImportarChecklistInput) {
    const acceso = await this.assertParticipa(viajeId, usuarioId)
    this.assertEditable(acceso)

    if (input.viajeOrigenId === viajeId) {
      throw new HttpError(400, 'No podés importar el checklist del mismo viaje', 'MISMO_VIAJE')
    }
    // Participar del viaje origen es el permiso para leer su checklist (RN-030).
    await this.assertParticipa(input.viajeOrigenId, usuarioId, 'VIAJE_ORIGEN_NOT_FOUND')

    await this.sincronizar(viajeId, usuarioId, acceso)

    const origen = await this.prisma.checklistItem.findMany({
      where: { viaje_id: input.viajeOrigenId, usuario_id: usuarioId },
      orderBy: [{ orden: 'asc' }, { created_at: 'asc' }],
      select: { texto: true },
    })

    const actuales = await this.prisma.checklistItem.findMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
      select: { texto: true, orden: true },
    })
    const yaEstan = new Set(actuales.map((i) => i.texto))
    const nuevos = origen.filter((i) => !yaEstan.has(i.texto))

    if (nuevos.length > 0) {
      const desde = actuales.reduce((max, i) => Math.max(max, i.orden), -1) + 1
      // Se importan como personales: el ítem base de otro viaje no obliga en este.
      await this.prisma.checklistItem.createMany({
        data: nuevos.map((i, idx) => ({
          viaje_id: viajeId,
          usuario_id: usuarioId,
          texto: i.texto,
          origen: 'personal' as const,
          orden: desde + idx,
        })),
        skipDuplicates: true,
      })
    }

    const items = await this.prisma.checklistItem.findMany({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
      orderBy: [{ orden: 'asc' }, { created_at: 'asc' }],
    })
    return {
      importados: nuevos.length,
      omitidos: origen.length - nuevos.length,
      items: items.map((i) => this.mapItem(i)),
    }
  }

  // ------------------------------------------------------------------ helpers

  private async buscarItemPropio(
    viajeId: string,
    usuarioId: string,
    itemId: string
  ): Promise<ItemFila> {
    const item = await this.prisma.checklistItem.findUnique({ where: { id: itemId } })
    if (!item || item.viaje_id !== viajeId || item.usuario_id !== usuarioId) {
      throw new HttpError(404, 'Ítem no encontrado', 'ITEM_NOT_FOUND')
    }
    return item
  }

  /** Una copia de un ítem base: el integrante la tilda, pero no la edita ni la borra. */
  private esCopiaDeBase(item: ItemFila): boolean {
    return item.origen === 'lider' && item.origen_item_id !== null
  }

  private async siguienteOrden(viajeId: string, usuarioId: string): Promise<number> {
    const ultimo = await this.prisma.checklistItem.findFirst({
      where: { viaje_id: viajeId, usuario_id: usuarioId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    })
    return (ultimo?.orden ?? -1) + 1
  }

  /**
   * Copia un ítem base recién creado al checklist de cada integrante confirmado que
   * ya tenga checklist armado. Quien todavía no lo abrió lo recibe al sincronizar.
   */
  private async propagarABasesDeIntegrantes(
    viajeId: string,
    creadorId: string,
    itemId: string,
    texto: string
  ): Promise<void> {
    const integrantes = await this.prisma.viajeIntegrante.findMany({
      where: { viaje_id: viajeId, estado: 'confirmado', usuario_id: { not: creadorId } },
      select: { usuario_id: true },
    })
    if (integrantes.length === 0) return

    const maximos = await this.prisma.checklistItem.groupBy({
      by: ['usuario_id'],
      where: { viaje_id: viajeId, usuario_id: { in: integrantes.map((i) => i.usuario_id) } },
      _max: { orden: true },
    })
    const ordenPorUsuario = new Map(maximos.map((m) => [m.usuario_id, (m._max.orden ?? -1) + 1]))

    await this.prisma.checklistItem.createMany({
      data: integrantes.map((i) => ({
        viaje_id: viajeId,
        usuario_id: i.usuario_id,
        origen_item_id: itemId,
        texto,
        origen: 'lider' as const,
        orden: ordenPorUsuario.get(i.usuario_id) ?? 0,
      })),
      skipDuplicates: true,
    })
  }

  private mapItem(i: ItemFila) {
    return {
      id: i.id,
      viaje_id: i.viaje_id,
      usuario_id: i.usuario_id,
      texto: i.texto,
      origen: i.origen,
      completado: i.completado,
      orden: i.orden,
      // El frontend solo orienta visualmente (RN-030): quién puede editar lo decide acá.
      puede_editar: !this.esCopiaDeBase(i),
      created_at: i.created_at.toISOString(),
      updated_at: i.updated_at.toISOString(),
    }
  }
}
