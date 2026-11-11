import { Feather } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text } from 'react-native'

import { AdminScreen, Fila, Seccion, Vacio, mensajeError } from '@/components/admin/AdminUI'
import { describirCriterios } from '@/components/admin/insignias'
import { Btn, useTheme } from '@/components/MeshUI'
import { ETIQUETA_RAREZA } from '@/components/perfil/InsigniaChip'
import { listarInsigniasAdmin, type InsigniaAdmin } from '@/lib/adminApi'

function obtenidas(cantidad: number): string {
  if (cantidad === 0) return 'Nadie la obtuvo todavía'
  return cantidad === 1 ? '1 persona la obtuvo' : `${cantidad} personas la obtuvieron`
}

/**
 * RN-133: catálogo de insignias. El superadmin las crea, edita, desactiva y elimina;
 * se otorgan solas al finalizar un viaje (RN-074).
 */
export default function AdminInsigniasScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [insignias, setInsignias] = useState<InsigniaAdmin[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setInsignias((await listarInsigniasAdmin()).items)
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])

  // Al volver del editor, el listado refleja lo que se guardó o eliminó.
  useFocusEffect(
    useCallback(() => {
      void cargar()
    }, [cargar])
  )

  const abrir = (insigniaId: string) =>
    router.push({ pathname: '/admin/insignia/[insigniaId]', params: { insigniaId } })

  const activas = insignias?.filter((i) => i.activa) ?? []
  const inactivas = insignias?.filter((i) => !i.activa) ?? []

  const fila = (i: InsigniaAdmin) => (
    <Fila
      key={i.id}
      icono={i.icono in Feather.glyphMap ? (i.icono as keyof typeof Feather.glyphMap) : 'award'}
      titulo={i.nombre}
      detalle={`${describirCriterios(i)}\n${obtenidas(i.cantidad_otorgadas)}`}
      etiqueta={i.activa ? ETIQUETA_RAREZA[i.rareza] : 'Inactiva'}
      tonoEtiqueta={i.activa ? (i.rareza === 'comun' ? 'mute' : 'accent') : 'danger'}
      onPress={() => abrir(i.id)}
    />
  )

  return (
    <AdminScreen
      title="Insignias"
      sub={insignias ? `${activas.length} activas · ${inactivas.length} inactivas` : undefined}
      cargando={!insignias && !error}
      onRefresh={() => void cargar()}
    >
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}

      <Btn block icon="plus" onPress={() => abrir('nueva')}>
        Nueva insignia
      </Btn>

      <Seccion
        titulo="Activas"
        descripcion="Se evalúan al finalizar cada viaje y aparecen en el catálogo de la app."
      >
        {insignias && activas.length === 0 ? <Vacio texto="No hay insignias activas." /> : null}
        {activas.map(fila)}
      </Seccion>

      {inactivas.length > 0 ? (
        <Seccion
          titulo="Inactivas"
          descripcion="No se otorgan más, pero quienes ya las obtuvieron las conservan."
        >
          {inactivas.map(fila)}
        </Seccion>
      ) : null}
    </AdminScreen>
  )
}
