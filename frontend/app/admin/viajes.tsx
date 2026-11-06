import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text } from 'react-native'
import { useCopilot } from 'react-native-copilot'

import {
  AdminScreen,
  ETIQUETA_ACTIVIDAD,
  ETIQUETA_ESTADO_VIAJE,
  Fila,
  Paginador,
  Seccion,
  Vacio,
  codigoViaje,
  useListadoAdmin,
} from '@/components/admin/AdminUI'
import { Chip, ChipRow, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_VIAJES } from '@/components/ayuda/contenidoAyuda'
import { listarViajesAdmin, type EstadoViajeApi } from '@/lib/adminApi'

/** Listado anónimo: las estadísticas de viajes están en Reportes (RN-126, RN-127). */
export default function AdminViajesScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const [estado, setEstado] = useState<EstadoViajeApi | undefined>(undefined)

  const cargar = useCallback((pagina: number) => listarViajesAdmin({ estado, pagina }), [estado])
  const { datos, error, setPagina, recargar } = useListadoAdmin(cargar, estado ?? '')

  return (
    <AdminScreen
      title="Viajes"
      sub={datos ? `${datos.total} viajes` : undefined}
      onRefresh={() => void recargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_VIAJES[0]!}>
        <ChipRow>
          <Chip active={!estado} onPress={() => setEstado(undefined)}>
            Todos
          </Chip>
          {(Object.keys(ETIQUETA_ESTADO_VIAJE) as EstadoViajeApi[]).map((e) => (
            <Chip key={e} active={estado === e} onPress={() => setEstado(e)}>
              {ETIQUETA_ESTADO_VIAJE[e]}
            </Chip>
          ))}
        </ChipRow>
      </PasoAyuda>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PasoAyuda {...AYUDA_ADMIN_VIAJES[1]!}>
        <Seccion
          titulo="Viajes anónimos"
          descripcion="Por privacidad no se muestran nombre, personas, horarios ni ruta. Esta lista es para gestionar viajes colgados; las estadísticas están en Reportes."
        >
          {datos?.items.length === 0 ? <Vacio texto="No hay viajes con ese filtro." /> : null}
          {datos?.items.map((v) => (
            <Fila
              key={v.id}
              titulo={codigoViaje(v.id)}
              detalle={`Actividad: ${ETIQUETA_ACTIVIDAD[v.tipo_actividad] ?? v.tipo_actividad} · ${v.es_grupal ? 'Grupal' : 'Individual'}\nIntegrantes registrados: ${v.cantidad_integrantes}`}
              etiqueta={v.posiblemente_colgado ? 'Posible colgado' : ETIQUETA_ESTADO_VIAJE[v.estado]}
              tonoEtiqueta={v.posiblemente_colgado ? 'danger' : v.estado === 'en_curso' ? 'good' : 'mute'}
              onPress={() => router.push({ pathname: '/admin/viaje/[viajeId]', params: { viajeId: v.id } })}
            />
          ))}
        </Seccion>
      </PasoAyuda>
      <Paginador datos={datos} onCambiar={setPagina} />
    </AdminScreen>
  )
}
