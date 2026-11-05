import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text } from 'react-native'
import { useCopilot } from 'react-native-copilot'

import {
  AdminScreen,
  Fila,
  Paginador,
  Seccion,
  Vacio,
  nombreCompleto,
  useListadoAdmin,
} from '@/components/admin/AdminUI'
import { Field, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_GRUPOS } from '@/components/ayuda/contenidoAyuda'
import { listarGruposAdmin } from '@/lib/adminApi'

export default function AdminGruposScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')

  const cargar = useCallback(
    (pagina: number) => listarGruposAdmin({ q: q || undefined, pagina }),
    [q]
  )
  const { datos, error, setPagina, recargar } = useListadoAdmin(cargar, q)

  return (
    <AdminScreen
      title="Grupos"
      sub={datos ? `${datos.total} grupos` : undefined}
      onRefresh={() => void recargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_GRUPOS[0]!}>
        <Field
          label="Buscar"
          leading="search"
          placeholder="Nombre del grupo"
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => setQ(texto.trim())}
          returnKeyType="search"
        />
      </PasoAyuda>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PasoAyuda {...AYUDA_ADMIN_GRUPOS[1]!}>
        <Seccion>
          {datos?.items.length === 0 ? <Vacio texto="No hay grupos con ese nombre." /> : null}
          {datos?.items.map((g) => (
            <Fila
              key={g.id}
              titulo={g.nombre}
              detalle={`Líder: ${nombreCompleto(g.lider)} · ${g.cantidad_miembros} integrantes`}
              onPress={() => router.push({ pathname: '/admin/grupo/[grupoId]', params: { grupoId: g.id } })}
            />
          ))}
        </Seccion>
      </PasoAyuda>
      <Paginador datos={datos} onCambiar={setPagina} />
    </AdminScreen>
  )
}
