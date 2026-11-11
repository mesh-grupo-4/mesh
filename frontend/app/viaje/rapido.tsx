import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { ActivityTile, Btn, TopBar, useTheme } from '@/components/MeshUI'
import { DestinoPicker } from '@/components/viaje-rapido/DestinoPicker'
import { ActividadGrid } from '@/components/viaje-nuevo/ActividadGrid'
import { SelectorModo } from '@/components/viaje-nuevo/SelectorModo'
import { useUbicacionActual } from '@/hooks/useUbicacionActual'
import { useVolverInterno } from '@/hooks/useVolver'
import { ACTIVIDADES, esMotorizado, etiquetaActividad } from '@/lib/activityDefaults'
import { resolveBackendUserId } from '@/lib/apiClient'
import { meshAlert } from '@/lib/meshAlert'
import { paramTexto } from '@/lib/nuevoViaje'
import { guardarRutaRapida, type PuntoDestino } from '@/lib/rutaRapida'
import { formatearEnArg } from '@/lib/tiempoArg'
import { crearViaje, type ModoViajeApi, type TipoActividadApi } from '@/lib/viajesApi'

type Paso = 'actividad' | 'destino' | 'plantilla' | 'creando'

function actividadValida(raw: string | undefined): TipoActividadApi | null {
  return ACTIVIDADES.some((a) => a.id === raw) ? (raw as TipoActividadApi) : null
}

function modoValido(raw: string | undefined): ModoViajeApi | null {
  return raw === 'recreativo' || raw === 'entrenamiento' || raw === 'competitivo' ? raw : null
}

/**
 * "Viaje YA": modo + actividad → destino (opcional) → se crea el viaje y se pasa a la
 * sala de espera con el QR. Con una ruta de "Mis rutas" (plantilla) o al repetir una
 * sesión de entrenamiento (RN-066) no se pregunta ni actividad ni destino: ya vienen.
 */
export default function ViajeRapidoScreen() {
  const theme = useTheme()
  const { backendUserId } = useAuth()
  const raw = useLocalSearchParams<{
    plantillaId?: string | string[]
    tipoActividad?: string | string[]
    grupo?: string | string[]
    modo?: string | string[]
    repetirViajeId?: string | string[]
    recorrido?: string | string[]
    nombre?: string | string[]
  }>()
  const plantillaId = paramTexto(raw.plantillaId) ?? null
  const grupoId = paramTexto(raw.grupo) ?? null
  const actividadPlantilla = actividadValida(paramTexto(raw.tipoActividad))
  // RN-066: repetir una sesión de entrenamiento; el backend fija modo, actividad y recorrido.
  const repetirViajeId = paramTexto(raw.repetirViajeId) ?? null
  const recorridoRepetir = paramTexto(raw.recorrido) === 'planificado' ? 'planificado' : 'real'
  const nombreRepetir = paramTexto(raw.nombre) ?? null

  const [paso, setPaso] = useState<Paso>(plantillaId || repetirViajeId ? 'plantilla' : 'actividad')
  const [actividad, setActividad] = useState<TipoActividadApi>(actividadPlantilla ?? 'otro')
  // RN-065: recreativo por defecto, así elegir el modo no suma un toque a quien no le importa.
  // Desde la tab Entrenar llega ya en entrenamiento.
  const [modo, setModo] = useState<ModoViajeApi>(
    repetirViajeId ? 'entrenamiento' : (modoValido(paramTexto(raw.modo)) ?? 'recreativo')
  )
  const { ubicacion } = useUbicacionActual()

  // Volver desde el destino regresa a elegir actividad; mientras se crea el viaje no se sale.
  useVolverInterno(paso === 'destino' || paso === 'creando', () => {
    if (paso === 'destino') setPaso('actividad')
  })

  const crear = async (tipo: TipoActividadApi, destino: PuntoDestino | null) => {
    const pasoAnterior = paso
    setPaso('creando')
    try {
      const userId = resolveBackendUserId(backendUserId)
      const hora = formatearEnArg(new Date(), { hour: '2-digit', minute: '2-digit' })
      const viaje = await crearViaje(
        {
          nombre:
            (repetirViajeId ? nombreRepetir : null) ??
            `${modo === 'entrenamiento' ? 'Entrenamiento' : 'Viaje rápido'} · ${etiquetaActividad(tipo)} · ${hora}`,
          esGrupal: true,
          grupoIds: grupoId ? [grupoId] : [],
          tipoActividad: tipo,
          inmediato: true,
          // RN-070: el backend rechaza competitivo y entrenamiento en moto/auto; acá nunca se llega a mandarlos.
          modo: modo !== 'recreativo' && esMotorizado(tipo) ? 'recreativo' : modo,
          rutaPlantillaId: plantillaId,
          repetir: repetirViajeId ? { viajeId: repetirViajeId, recorrido: recorridoRepetir } : null,
        },
        userId
      )

      let rutaFallo = false
      if (destino && ubicacion) {
        try {
          await guardarRutaRapida(
            viaje.id,
            userId,
            tipo,
            { lat: ubicacion.latitude, lng: ubicacion.longitude },
            destino
          )
        } catch (e) {
          console.warn('No se pudo guardar la ruta del viaje rápido:', e)
          rutaFallo = true
        }
      }

      router.replace({
        pathname: '/viaje/[viajeId]/sala',
        params: rutaFallo ? { viajeId: viaje.id, rutaFallo: '1' } : { viajeId: viaje.id },
      })
    } catch (e) {
      meshAlert('Error', e instanceof Error ? e.message : 'No se pudo crear el viaje.')
      setPaso(pasoAnterior)
    }
  }

  const elegirDestino = (destino: PuntoDestino) => {
    if (!ubicacion) {
      meshAlert(
        'Sin tu ubicación',
        'Necesitamos saber dónde estás para calcular la ruta. Podés saltear el destino y salir igual.'
      )
      return
    }
    void crear(actividad, destino)
  }

  if (paso === 'destino') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <DestinoPicker
          titulo="¿A dónde van?"
          origen={ubicacion}
          onConfirm={elegirDestino}
          onSkip={() => void crear(actividad, null)}
          onCancel={() => setPaso('actividad')}
        />
      </>
    )
  }

  if (paso === 'creando') {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.creando, { color: theme.textDim }]}>Armando el viaje…</Text>
      </View>
    )
  }

  if (paso === 'plantilla') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar title={repetirViajeId ? 'Repetir entrenamiento' : 'Viaje YA'} bordered={false} />
        <View style={styles.plantilla}>
          <ActivityTile activity={actividad} size={84} />
          {repetirViajeId ? (
            <>
              <Text style={[styles.titulo, { color: theme.text }]}>
                {nombreRepetir ?? 'Salís ahora con tu recorrido'}
              </Text>
              <Text style={[styles.sub, { color: theme.textDim }]}>
                Repetís {recorridoRepetir === 'planificado' ? 'la ruta planificada' : 'lo que hiciste'} en esa
                sesión. En el mapa vas a ver tu sesión anterior como fantasma. Si querés, invitás desde la sala
                de espera.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.titulo, { color: theme.text }]}>Salís ahora con tu ruta</Text>
              <Text style={[styles.sub, { color: theme.textDim }]}>
                Usamos el recorrido guardado ({etiquetaActividad(actividad)}). Después invitás desde la sala de
                espera.
              </Text>
              <View style={styles.modoPlantilla}>
                <SelectorModo
                  modo={modo !== 'recreativo' && esMotorizado(actividad) ? 'recreativo' : modo}
                  onChange={setModo}
                  puedeCompetir={!esMotorizado(actividad)}
                  motorizado={esMotorizado(actividad)}
                />
              </View>
            </>
          )}
        </View>
        <View style={styles.footer}>
          <Btn block size="xl" icon="zap" onPress={() => void crear(actividad, null)}>
            Salir ya
          </Btn>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title="Viaje YA" bordered={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.etiqueta, { color: theme.textDim }]}>Modo</Text>
        <SelectorModo modo={modo} onChange={setModo} puedeCompetir />
        {modo !== 'recreativo' ? (
          <Text style={[styles.aviso, { color: theme.textDim }]}>
            En moto y auto no hay modo {modo === 'competitivo' ? 'competitivo' : 'entrenamiento'} (seguridad
            vial).
          </Text>
        ) : null}

        <Text style={[styles.titulo, { color: theme.text }]}>¿Qué van a hacer?</Text>
        <ActividadGrid
          deshabilitada={(a) => modo !== 'recreativo' && esMotorizado(a)}
          onElegir={(a) => {
            setActividad(a)
            setPaso('destino')
          }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  creando: { fontSize: 16, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  titulo: { fontSize: 26, fontWeight: '800', marginTop: 24, marginBottom: 16 },
  etiqueta: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  aviso: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  modoPlantilla: { alignSelf: 'stretch', marginTop: 12 },
  sub: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  plantilla: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  footer: { padding: 16, paddingBottom: 32 },
})
