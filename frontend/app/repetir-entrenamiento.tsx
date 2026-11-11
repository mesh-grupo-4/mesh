import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { useTheme } from '@/components/MeshUI'
import { HojaOpciones, OpcionHoja } from '@/components/viaje-nuevo/HojaOpciones'
import {
  obtenerSesion,
  type RecorridoRepeticionApi,
  type SesionApi,
} from '@/lib/entrenamientosApi'
import { formatKm } from '@/lib/format'
import { paramTexto } from '@/lib/nuevoViaje'
import { formatearEnArg } from '@/lib/tiempoArg'

/**
 * RN-066: "Repetir" una sesión de entrenamiento. Primero se elige qué recorrido
 * usar (lo planificado o lo que realmente se hizo) y después se pasa al selector
 * "Salir ahora / Planificar". Si la sesión solo tiene uno de los dos recorridos,
 * no se pregunta.
 */
export default function RepetirEntrenamientoScreen() {
  const theme = useTheme()
  const raw = useLocalSearchParams<{ viajeId?: string | string[] }>()
  const viajeId = paramTexto(raw.viajeId)

  const [sesion, setSesion] = useState<SesionApi | null>(null)
  const [error, setError] = useState<string | null>(null)

  const continuar = (s: SesionApi, recorrido: RecorridoRepeticionApi) => {
    router.replace({
      pathname: '/nuevo-viaje',
      params: {
        repetirViajeId: s.viaje_id,
        recorrido,
        tipoActividad: s.tipo_actividad,
        nombre: s.circuito?.nombre ?? s.nombre,
      },
    })
  }

  useEffect(() => {
    if (!viajeId) {
      setError('No encontramos esa sesión.')
      return
    }
    let cancelado = false
    obtenerSesion(viajeId)
      .then((s) => {
        if (cancelado) return
        // Con un solo recorrido disponible no hay nada que elegir.
        if (s.repetir.planificado !== s.repetir.real) {
          continuar(s, s.repetir.planificado ? 'planificado' : 'real')
          return
        }
        setSesion(s)
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar la sesión.')
      })
    return () => {
      cancelado = true
    }
  }, [viajeId])

  if (error) {
    return (
      <HojaOpciones titulo="Repetir entrenamiento">
        <Text style={[styles.aviso, { color: theme.textDim }]}>{error}</Text>
      </HojaOpciones>
    )
  }

  if (!sesion) {
    return (
      <HojaOpciones titulo="Repetir entrenamiento">
        <View style={styles.cargando}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </HojaOpciones>
    )
  }

  if (!sesion.repetir.planificado && !sesion.repetir.real) {
    return (
      <HojaOpciones titulo="Repetir entrenamiento">
        <Text style={[styles.aviso, { color: theme.textDim }]}>
          Esta sesión no tiene un recorrido para repetir: no tenía ruta planificada ni quedó registro
          de GPS.
        </Text>
      </HojaOpciones>
    )
  }

  const fecha = sesion.fecha_fin_real
    ? formatearEnArg(sesion.fecha_fin_real, { day: '2-digit', month: 'short' })
    : null

  return (
    <HojaOpciones
      titulo="Repetir entrenamiento"
      subtitulo={`${sesion.nombre}${fecha ? ` · ${fecha}` : ''}. ¿Qué recorrido querés hacer?`}
    >
      <OpcionHoja
        icon="map"
        titulo="Lo planificado"
        detalle="La ruta que habías armado para esa sesión, con sus paradas."
        destacada
        onPress={() => continuar(sesion, 'planificado')}
      />
      <OpcionHoja
        icon="activity"
        titulo="Lo que hice"
        detalle={`El recorrido que realmente hiciste esa vez (${formatKm(sesion.distancia_m)}), con desvíos y vueltas extra.`}
        onPress={() => continuar(sesion, 'real')}
      />
    </HojaOpciones>
  )
}

const styles = StyleSheet.create({
  cargando: { paddingVertical: 32, alignItems: 'center' },
  aviso: { fontSize: 16, lineHeight: 22, paddingBottom: 12 },
})
