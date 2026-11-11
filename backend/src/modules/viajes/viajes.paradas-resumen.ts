import type { CategoriaParada, TipoParada } from '@prisma/client'
import { nombreVisible } from '../../lib/nombres'

export type FilaParadaResumen = {
  id: string
  usuario_id: string
  tipo: TipoParada
  categoria: CategoriaParada | null
  inicio: Date
  fin: Date | null
  grupal: boolean
  confirmado_bien: boolean | null
  usuario: { nombre: string; apellido: string | null }
}

/**
 * Detalle de paradas para el cierre del viaje, en orden cronológico. Sin coordenadas a
 * propósito: la ubicación de terceros tendría que pasar por `privacidad.acceso` (RN-111).
 *
 * Una parada grupal (RN-045) guarda una fila por integrante con el mismo `inicio`: acá
 * vuelve a ser una sola, representada por la del líder, que es quien la abrió y la cerró.
 */
export function armarParadasDelResumen(
  filas: FilaParadaResumen[],
  usuarioId: string,
  liderId: string
) {
  const grupos = new Map<string, FilaParadaResumen[]>()
  for (const fila of filas) {
    const clave = fila.grupal ? `grupal:${fila.inicio.toISOString()}` : fila.id
    grupos.set(clave, [...(grupos.get(clave) ?? []), fila])
  }

  return [...grupos.values()]
    .map((grupo) => {
      const base = grupo.find((f) => f.usuario_id === liderId) ?? grupo[0]!
      return {
        id: base.id,
        tipo: base.tipo,
        categoria: base.categoria,
        grupal: base.grupal,
        inicio: base.inicio,
        fin: base.fin,
        duracion_seg:
          base.fin != null
            ? Math.max(0, Math.round((base.fin.getTime() - base.inicio.getTime()) / 1000))
            : null,
        nombre: nombreVisible(base.usuario.nombre, base.usuario.apellido) || 'Un integrante',
        es_propia: grupo.some((f) => f.usuario_id === usuarioId),
        confirmado_bien: base.confirmado_bien,
      }
    })
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
}
