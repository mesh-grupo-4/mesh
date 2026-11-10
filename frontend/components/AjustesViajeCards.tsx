import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ConfigAlertasCard } from '@/components/ConfigAlertasCard'
import { ParametrosGrupoCard } from '@/components/ParametrosGrupoCard'
import { meshAlert } from '@/lib/meshAlert'
import { actualizarViaje, type ViajeActualizadoApi, type ViajeDetalleApi } from '@/lib/viajesApi'

type Props = {
  viaje: ViajeDetalleApi
  userId: string
  /** Se llama con lo que devolvió el backend para que la pantalla actualice su copia del viaje. */
  onActualizado: (actualizado: ViajeActualizadoApi) => void
  inicialAbierto?: boolean
}

/**
 * Ajustes que el líder puede tocar antes y durante el viaje (RN-025): parámetros
 * del grupo y configuración de alertas. El motor relee el viaje en cada ping, así
 * que un cambio en vivo aplica al instante. El backend valida el rol (RN-030).
 */
export function AjustesViajeCards({ viaje, userId, onActualizado, inicialAbierto = false }: Props) {
  const [guardando, setGuardando] = useState(false)

  const guardar = async (input: Parameters<typeof actualizarViaje>[2]) => {
    setGuardando(true)
    try {
      onActualizado(await actualizarViaje(viaje.id, userId, input))
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudieron guardar los ajustes.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={styles.grupo}>
      <ParametrosGrupoCard
        viaje={viaje}
        editable
        guardando={guardando}
        onGuardar={(input) => void guardar(input)}
        inicialAbierto={inicialAbierto}
      />
      {viaje.es_grupal ? (
        <ConfigAlertasCard
          viaje={viaje}
          guardando={guardando}
          onGuardar={(input) => void guardar(input)}
          inicialAbierto={inicialAbierto}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  grupo: { gap: 6 },
})
