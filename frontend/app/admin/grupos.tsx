import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text } from 'react-native'

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
import { listarGruposAdmin } from '@/lib/adminApi'

export default function AdminGruposScreen() {
  const router = useRouter()
  const theme = useTheme()
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
    >
      <Field
        label="Buscar"
        leading="search"
        placeholder="Nombre del grupo"
        value={texto}
        onChangeText={setTexto}
        onSubmitEditing={() => setQ(texto.trim())}
        returnKeyType="search"
      />
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
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
      <Paginador datos={datos} onCambiar={setPagina} />
    </AdminScreen>
  )
}
