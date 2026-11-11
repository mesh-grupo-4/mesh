import { meshConfirmDestructive, meshError } from './meshAlert'
import { eliminarRutaPlantilla } from './rutasCompartidasApi'

/**
 * Desmarcar el corazón de una ruta guardada: pide confirmación y, si se acepta, la quita
 * de "Guardadas" (borra la plantilla). `onInicio`/`onFin` envuelven el pedido al backend.
 */
export function confirmarQuitarGuardada(opts: {
  nombre: string
  plantillaId: string
  onQuitada: () => void
  onInicio?: () => void
  onFin?: () => void
}) {
  meshConfirmDestructive({
    title: 'Quitar de guardadas',
    message: `¿Quitar “${opts.nombre}” de tus rutas guardadas?`,
    confirmLabel: 'Quitar',
    onConfirm: async () => {
      opts.onInicio?.()
      try {
        await eliminarRutaPlantilla(opts.plantillaId, '')
        opts.onQuitada()
      } catch (e) {
        meshError('No se pudo quitar', e instanceof Error ? e.message : undefined)
      } finally {
        opts.onFin?.()
      }
    },
  })
}
