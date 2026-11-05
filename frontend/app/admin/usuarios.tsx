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
import { Chip, ChipRow, Field, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_USUARIOS } from '@/components/ayuda/contenidoAyuda'
import { listarUsuariosAdmin } from '@/lib/adminApi'

type Filtro = 'todos' | 'suspendido' | 'superadmin'

export default function AdminUsuariosScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const cargar = useCallback(
    (pagina: number) =>
      listarUsuariosAdmin({
        q: q || undefined,
        pagina,
        estado: filtro === 'suspendido' ? 'suspendido' : undefined,
        rol: filtro === 'superadmin' ? 'superadmin' : undefined,
      }),
    [q, filtro]
  )
  const { datos, error, setPagina, recargar } = useListadoAdmin(cargar, `${q}|${filtro}`)

  return (
    <AdminScreen
      title="Usuarios"
      sub={datos ? `${datos.total} cuentas` : undefined}
      onRefresh={() => void recargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_USUARIOS[0]!}>
        <>
          <Field
            label="Buscar"
            leading="search"
            placeholder="Nombre, apellido o email"
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={() => setQ(texto.trim())}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <ChipRow>
            <Chip active={filtro === 'todos'} onPress={() => setFiltro('todos')}>
              Todos
            </Chip>
            <Chip active={filtro === 'suspendido'} onPress={() => setFiltro('suspendido')}>
              Suspendidos
            </Chip>
            <Chip active={filtro === 'superadmin'} onPress={() => setFiltro('superadmin')}>
              Superadmins
            </Chip>
          </ChipRow>
        </>
      </PasoAyuda>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <PasoAyuda {...AYUDA_ADMIN_USUARIOS[1]!}>
        <Seccion>
          {datos?.items.length === 0 ? <Vacio texto="No hay usuarios con ese filtro." /> : null}
          {datos?.items.map((u) => (
            <Fila
              key={u.id}
              titulo={nombreCompleto(u)}
              detalle={u.email}
              etiqueta={u.suspendido_at ? 'Suspendida' : u.rol_sistema === 'superadmin' ? 'Superadmin' : undefined}
              tonoEtiqueta={u.suspendido_at ? 'danger' : 'accent'}
              onPress={() => router.push({ pathname: '/admin/usuario/[usuarioId]', params: { usuarioId: u.id } })}
            />
          ))}
        </Seccion>
      </PasoAyuda>
      <Paginador datos={datos} onCambiar={setPagina} />
    </AdminScreen>
  )
}
