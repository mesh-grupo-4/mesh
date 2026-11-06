import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useCopilot } from 'react-native-copilot'

import {
  AdminScreen,
  ETIQUETA_ACTIVIDAD,
  ETIQUETA_ESTADO_VIAJE,
  Fila,
  Seccion,
  codigoViaje,
  mensajeError,
} from '@/components/admin/AdminUI'
import { Btn } from '@/components/MeshUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_VIAJE } from '@/components/ayuda/contenidoAyuda'
import {
  eliminarViajeAdmin,
  finalizarViajeAdmin,
  obtenerViajeAdmin,
  type ViajeAdminAnonimo,
} from '@/lib/adminApi'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'

/** Anónimo: el backoffice gestiona, no vigila (RN-126, RN-070). */
export default function AdminViajeScreen() {
  const { viajeId } = useLocalSearchParams<{ viajeId: string }>()
  const router = useRouter()
  const { start } = useCopilot()
  const [viaje, setViaje] = useState<ViajeAdminAnonimo | null>(null)
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

  const enCurso = viaje.estado === 'en_curso'

  return (
    <AdminScreen
      title={codigoViaje(viaje.id)}
      sub={`${ETIQUETA_ACTIVIDAD[viaje.tipo_actividad] ?? viaje.tipo_actividad} · ${ETIQUETA_ESTADO_VIAJE[viaje.estado]}`}
      onRefresh={() => void cargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_VIAJE[0]!}>
        <Seccion
          titulo="Datos del viaje"
          descripcion="Por privacidad no se muestran nombre, personas, horarios ni ruta."
        >
          <Fila titulo="Actividad" detalle={ETIQUETA_ACTIVIDAD[viaje.tipo_actividad] ?? viaje.tipo_actividad} />
          <Fila titulo="Tipo de viaje" detalle={viaje.es_grupal ? 'Grupal' : 'Individual'} />
          <Fila titulo="Integrantes registrados" detalle={String(viaje.cantidad_integrantes)} />
          <Fila
            titulo="Estado"
            detalle={viaje.posiblemente_colgado ? 'Lleva más de 24 horas en curso: puede haber quedado colgado.' : undefined}
            etiqueta={viaje.posiblemente_colgado ? 'Posible colgado' : ETIQUETA_ESTADO_VIAJE[viaje.estado]}
            tonoEtiqueta={viaje.posiblemente_colgado ? 'danger' : enCurso ? 'good' : 'mute'}
          />
        </Seccion>
      </PasoAyuda>

      <PasoAyuda {...AYUDA_ADMIN_VIAJE[1]!}>
        <Seccion
          titulo="Acción"
          descripcion={
            enCurso
              ? 'Usala solo si el viaje quedó colgado. Queda registrada en la auditoría.'
              : 'Eliminar es definitivo. Queda registrado en la auditoría.'
          }
        >
          {enCurso ? (
            <Btn variant="danger-outline" block icon="flag" disabled={ocupado} onPress={finalizar}>
              Forzar finalización
            </Btn>
          ) : (
            <Btn variant="danger" block icon="trash-2" disabled={ocupado} onPress={eliminar}>
              Eliminar viaje
            </Btn>
          )}
        </Seccion>
      </PasoAyuda>
    </AdminScreen>
  )
}
