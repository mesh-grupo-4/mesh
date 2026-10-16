import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { AdminScreen, Fila, Seccion, mensajeError } from '@/components/admin/AdminUI'
import { useTheme } from '@/components/MeshUI'
import { obtenerEstadisticasAdmin, type EstadisticasAdmin } from '@/lib/adminApi'

function Dato({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const theme = useTheme()
  return (
    <View style={styles.dato}>
      <Text style={[styles.datoValor, { color: theme.text }]}>{valor}</Text>
      <Text style={[styles.datoEtiqueta, { color: theme.textDim }]}>{etiqueta}</Text>
    </View>
  )
}

/** Panel del backoffice: totales de la plataforma y acceso a cada gestión. */
export default function AdminPanelScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [stats, setStats] = useState<EstadisticasAdmin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setStats(await obtenerEstadisticasAdmin())
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <AdminScreen title="Administración" sub="Backoffice de Mesh" onRefresh={() => void cargar()}>
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {stats ? (
        <Seccion titulo="Plataforma">
          <View style={styles.datos}>
            <Dato valor={stats.usuarios.total} etiqueta="Usuarios" />
            <Dato valor={stats.usuarios.suspendidos} etiqueta="Suspendidos" />
            <Dato valor={stats.grupos.total} etiqueta="Grupos" />
          </View>
          <View style={styles.datos}>
            <Dato valor={stats.viajes.planificado} etiqueta="Planificados" />
            <Dato valor={stats.viajes.en_curso} etiqueta="En curso" />
            <Dato valor={stats.viajes.finalizado} etiqueta="Finalizados" />
          </View>
        </Seccion>
      ) : null}

      <Seccion titulo="Gestión">
        <Fila
          icono="bar-chart-2"
          titulo="Reportes"
          detalle="Crecimiento, retención, uso, comunidad, seguridad, destinos y gastos"
          onPress={() => router.push('/admin/reportes')}
        />
        <Fila
          icono="users"
          titulo="Usuarios"
          detalle="Editar, suspender, eliminar cuentas y otorgar el rol superadmin"
          onPress={() => router.push('/admin/usuarios')}
        />
        <Fila
          icono="grid"
          titulo="Grupos"
          detalle="Reasignar líder, quitar integrantes, eliminar grupos"
          onPress={() => router.push('/admin/grupos')}
        />
        <Fila
          icono="navigation"
          titulo="Viajes"
          detalle="Forzar la finalización de viajes colgados y eliminar viajes"
          onPress={() => router.push('/admin/viajes')}
        />
        <Fila
          icono="file-text"
          titulo="Auditoría"
          detalle="Registro de cada acción hecha desde el backoffice"
          onPress={() => router.push('/admin/auditoria')}
        />
      </Seccion>
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  datos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dato: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  datoValor: { fontSize: 24, fontWeight: '800' },
  datoEtiqueta: { fontSize: 13, marginTop: 2 },
})
