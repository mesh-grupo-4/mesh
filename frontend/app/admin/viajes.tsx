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
  fechaAdmin,
  nombreCompleto,
  useListadoAdmin,
} from '@/components/admin/AdminUI'
import { Chip, ChipRow, Field, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_VIAJES } from '@/components/ayuda/contenidoAyuda'
import { listarViajesAdmin, type EstadoViajeApi } from '@/lib/adminApi'

export default function AdminViajesScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<EstadoViajeApi | undefined>(undefined)

  const cargar = useCallback(
    (pagina: number) => listarViajesAdmin({ q: q || undefined, estado, pagina }),
    [q, estado]
  )
  const { datos, error, setPagina, recargar } = useListadoAdmin(cargar, `${q}|${estado ?? ''}`)

  return (
    <AdminScreen
      title="Viajes"
      sub={datos ? `${datos.total} viajes` : undefined}
      onRefresh={() => void recargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_VIAJES[0]!}>
        <>
          <Field
            label="Buscar"
            leading="search"
            placeholder="Nombre del viaje"
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={() => setQ(texto.trim())}
            returnKeyType="search"
          />
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
        </>
      </PasoAyuda>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PasoAyuda {...AYUDA_ADMIN_VIAJES[1]!}>
        <Seccion>
          {datos?.items.length === 0 ? <Vacio texto="No hay viajes con ese filtro." /> : null}
          {datos?.items.map((v) => (
            <Fila
              key={v.id}
              titulo={v.nombre || 'Viaje sin nombre'}
              detalle={`${ETIQUETA_ACTIVIDAD[v.tipo_actividad] ?? v.tipo_actividad} · ${fechaAdmin(v.fecha_programada)} · ${nombreCompleto(v.creador)}`}
              etiqueta={ETIQUETA_ESTADO_VIAJE[v.estado]}
              tonoEtiqueta={v.estado === 'en_curso' ? 'good' : 'mute'}
              onPress={() => router.push({ pathname: '/admin/viaje/[viajeId]', params: { viajeId: v.id } })}
            />
          ))}
        </Seccion>
      </PasoAyuda>
      <Paginador datos={datos} onCambiar={setPagina} />
    </AdminScreen>
  )
}
