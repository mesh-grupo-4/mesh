import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useCopilot } from 'react-native-copilot'

import { AdminScreen, Fila, Seccion, mensajeError } from '@/components/admin/AdminUI'
import { useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_PANEL } from '@/components/ayuda/contenidoAyuda'
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
  const { start } = useCopilot()
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
    <AdminScreen
      title="Administración"
      sub="Backoffice de Mesh"
      onRefresh={() => void cargar()}
      onAyuda={() => start()}
    >
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      {stats ? (
        <PasoAyuda {...AYUDA_ADMIN_PANEL[0]!} estilo={styles.totales}>
          <>
            <Seccion titulo="Usuarios" descripcion="Cuentas registradas en Mesh.">
              <View style={styles.datos}>
                <Dato valor={stats.usuarios.total} etiqueta="Registrados" />
                <Dato valor={stats.usuarios.suspendidos} etiqueta="Suspendidos" />
                <Dato valor={stats.usuarios.superadmins} etiqueta="Superadmins" />
              </View>
            </Seccion>
            <Seccion titulo="Grupos y viajes" descripcion="Totales de toda la plataforma.">
              <View style={styles.datos}>
                <Dato valor={stats.grupos.total} etiqueta="Grupos" />
                <Dato valor={stats.viajes.finalizados} etiqueta="Viajes finalizados" />
              </View>
            </Seccion>
          </>
        </PasoAyuda>
      ) : null}

      <PasoAyuda {...AYUDA_ADMIN_PANEL[1]!}>
        <Seccion titulo="Gestión" descripcion="Cada acción queda registrada en la auditoría.">
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
            detalle="Forzar la finalización de viajes colgados y eliminar viajes, sin ver datos personales"
            onPress={() => router.push('/admin/viajes')}
          />
          <Fila
            icono="file-text"
            titulo="Auditoría"
            detalle="Registro de cada acción hecha desde el backoffice"
            onPress={() => router.push('/admin/auditoria')}
          />
        </Seccion>
      </PasoAyuda>
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  totales: { gap: 12 },
  datos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dato: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  datoValor: { fontSize: 24, fontWeight: '800' },
  datoEtiqueta: { fontSize: 13, marginTop: 2 },
})
