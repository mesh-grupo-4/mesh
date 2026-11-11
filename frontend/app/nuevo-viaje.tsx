import { router, useLocalSearchParams } from 'expo-router'

import { HojaOpciones, OpcionHoja } from '@/components/viaje-nuevo/HojaOpciones'
import { paramTexto, type NuevoViajeParams } from '@/lib/nuevoViaje'

/**
 * "Nuevo viaje": pregunta si salís ya o si lo planificás. Se presenta como
 * modal transparente sobre la pantalla desde la que se abrió y reenvía su
 * contexto (plantilla de ruta, grupo, modo, sesión a repetir) a la opción elegida.
 * Desde la tab Entrenar llega con `modo=entrenamiento` y cambia los textos.
 */
export default function NuevoViajeScreen() {
  const raw = useLocalSearchParams<{
    plantillaId?: string | string[]
    tipoActividad?: string | string[]
    grupo?: string | string[]
    modo?: string | string[]
    repetirViajeId?: string | string[]
    recorrido?: string | string[]
    nombre?: string | string[]
  }>()

  const params: NuevoViajeParams = {}
  const plantillaId = paramTexto(raw.plantillaId)
  const tipoActividad = paramTexto(raw.tipoActividad)
  const grupo = paramTexto(raw.grupo)
  const modo = paramTexto(raw.modo)
  const repetirViajeId = paramTexto(raw.repetirViajeId)
  const recorrido = paramTexto(raw.recorrido)
  const nombre = paramTexto(raw.nombre)
  if (plantillaId) params.plantillaId = plantillaId
  if (tipoActividad) params.tipoActividad = tipoActividad
  if (grupo) params.grupo = grupo
  if (modo) params.modo = modo
  if (repetirViajeId) params.repetirViajeId = repetirViajeId
  if (recorrido) params.recorrido = recorrido
  if (nombre) params.nombre = nombre

  const repite = Boolean(repetirViajeId)
  const entrena = repite || modo === 'entrenamiento'

  const ir = (opcion: 'rapido' | 'planificar') => {
    if (opcion === 'rapido') router.replace({ pathname: '/viaje/rapido', params })
    else router.replace({ pathname: '/viaje/crear', params })
  }

  return (
    <HojaOpciones
      titulo={repite ? 'Repetir entrenamiento' : entrena ? 'Nuevo entrenamiento' : 'Nuevo viaje'}
      subtitulo={
        entrena
          ? '¿Salís ahora o lo dejás armado para otro momento?'
          : '¿Salen ahora o lo dejás armado para otro momento?'
      }
    >
      <OpcionHoja
        icon="zap"
        titulo={entrena ? 'Salir ahora' : 'Viaje YA'}
        detalle={
          repite
            ? 'Arrancás ahora con el mismo recorrido y tu sesión anterior como fantasma.'
            : entrena
              ? 'Arrancás ahora. Elegí la actividad y, si querés, un destino.'
              : 'Arrancan ahora. Elegí la actividad y, si querés, un destino; después compartís el QR y salen.'
        }
        destacada
        onPress={() => ir('rapido')}
      />
      <OpcionHoja
        icon="calendar"
        titulo={entrena ? 'Planificar' : 'Planificar viaje'}
        detalle={
          repite
            ? 'Para otro día. Elegí fecha y hora y, si querés, a quién invitar; el recorrido ya está.'
            : entrena
              ? 'Para otro día. Definí fecha y hora, el recorrido y, si querés, a quién invitar.'
              : 'Para otro día. Definí fecha y hora, el recorrido con paradas, los parámetros del grupo y a quién invitar.'
        }
        onPress={() => ir('planificar')}
      />
    </HojaOpciones>
  )
}
