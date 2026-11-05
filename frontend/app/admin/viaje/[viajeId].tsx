import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Text } from 'react-native'
import { useCopilot } from 'react-native-copilot'

import {
  AdminScreen,
  ETIQUETA_ACTIVIDAD,
  ETIQUETA_ESTADO_VIAJE,
  Fila,
  Seccion,
  fechaAdmin,
  mensajeError,
  nombreCompleto,
} from '@/components/admin/AdminUI'
import { Btn, useTheme } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_VIAJE } from '@/components/ayuda/contenidoAyuda'
import {
  eliminarViajeAdmin,
  finalizarViajeAdmin,
  obtenerViajeAdmin,
  type ViajeAdminDetalle,
} from '@/lib/adminApi'
import { formatKmCompact } from '@/lib/format'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'

/** Sin posiciones ni velocidades: el backoffice gestiona, no vigila (RN-126, RN-070). */
export default function AdminViajeScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>()
  const router = useRouter()
  const theme = useTheme()
  const { start } = useCopilot()
  const [viaje, setViaje] = useState<ViajeAdminDetalle | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setViaje(await obtenerViajeAdmin(viajeId))
    } catch (e) {
      meshAlert('No se pudo cargar el viaje', mensajeError(e))
    }
  }, [viajeId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const ejecutar = useCallback(async (accion: () => Promise<unknown>) => {
    setOcupado(true)
    try {
      await accion()
    } catch (e) {
      meshAlert('No se pudo completar la acción', mensajeError(e))
    } finally {
      setOcupado(false)
    }
  }, [])

  if (!viaje) return <AdminScreen title="Viaje" cargando>{null}</AdminScreen>

  const finalizar = () =>
    meshConfirmDestructive({
      title: 'Forzar finalización',
      message:
        'Se cierra el viaje para todo el grupo como si lo finalizara el creador: se cierran paradas y alertas, se deja de mostrar el mapa y se genera el resumen.',
      confirmLabel: 'Finalizar viaje',
      onConfirm: () =>
        ejecutar(async () => {
          await finalizarViajeAdmin(viaje.id)
          meshSuccess('Viaje finalizado')
          await cargar()
        }),
    })

  const eliminar = () =>
    meshConfirmDestructive({
      title: 'Eliminar viaje',
      message: 'Se borra el viaje con su ruta, integrantes, recorridos y métricas. Es definitivo.',
      confirmLabel: 'Eliminar',
      onConfirm: () =>
        ejecutar(async () => {
          await eliminarViajeAdmin(viaje.id)
          meshSuccess('Viaje eliminado', undefined, () => router.back())
        }),
    })

  return (
    <AdminScreen
      title={viaje.nombre || 'Viaje sin nombre'}
      sub={`${ETIQUETA_ACTIVIDAD[viaje.tipo_actividad] ?? viaje.tipo_actividad} · ${ETIQUETA_ESTADO_VIAJE[viaje.estado]}`}
      onRefresh={() => void cargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_VIAJE[0]!}>
        <Seccion titulo="Datos">
          <Fila
            titulo="Creador"
            detalle={`${nombreCompleto(viaje.creador)} · ${viaje.creador.email}`}
            onPress={() =>
              router.push({ pathname: '/admin/usuario/[usuarioId]', params: { usuarioId: viaje.creador.id } })
            }
          />
          <Fila titulo="Programado" detalle={fechaAdmin(viaje.fecha_programada)} />
          {viaje.fecha_inicio_real ? <Fila titulo="Inicio" detalle={fechaAdmin(viaje.fecha_inicio_real)} /> : null}
          {viaje.fecha_fin_real ? <Fila titulo="Fin" detalle={fechaAdmin(viaje.fecha_fin_real)} /> : null}
          {viaje.ruta ? (
            <Fila
              titulo="Ruta"
              detalle={`${viaje.ruta.origen_nombre ?? 'Origen'} → ${viaje.ruta.destino_nombre ?? 'Destino'}${
                viaje.ruta.distancia_planeada_m ? ` · ${formatKmCompact(viaje.ruta.distancia_planeada_m)} km` : ''
              }`}
            />
          ) : null}
          <Fila
            titulo="Actividad registrada"
            detalle={`${viaje.totales.alertas} alertas · ${viaje.totales.paradas} paradas · ${viaje.totales.gastos} gastos`}
          />
        </Seccion>
      </PasoAyuda>

      <Seccion titulo={`Integrantes (${viaje.integrantes.length})`}>
        {viaje.integrantes.length === 0 ? (
          <Text style={{ color: theme.textMute }}>Sin integrantes registrados.</Text>
        ) : (
          viaje.integrantes.map((i) => (
            <Fila key={i.id} titulo={nombreCompleto(i)} detalle={i.email} etiqueta={i.estado} />
          ))
        )}
      </Seccion>

      <PasoAyuda {...AYUDA_ADMIN_VIAJE[1]!}>
        {viaje.estado === 'en_curso' ? (
          <Btn variant="danger-outline" block icon="flag" disabled={ocupado} onPress={finalizar}>
            Forzar finalización
          </Btn>
        ) : (
          <Btn variant="danger" block icon="trash-2" disabled={ocupado} onPress={eliminar}>
            Eliminar viaje
          </Btn>
        )}
      </PasoAyuda>
    </AdminScreen>
  )
}
