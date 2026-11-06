import { StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'
import { paramTexto, type NuevoViajeParams } from '@/lib/nuevoViaje'

/**
 * "Nuevo viaje": pregunta si salís ya o si lo planificás. Se presenta como
 * modal transparente sobre la pantalla desde la que se abrió y reenvía su
 * contexto (plantilla de ruta, grupo) a la opción elegida.
 */
export default function NuevoViajeScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const raw = useLocalSearchParams<{
    plantillaId?: string | string[]
    tipoActividad?: string | string[]
    grupo?: string | string[]
  }>()

  const params: NuevoViajeParams = {}
  const plantillaId = paramTexto(raw.plantillaId)
  const tipoActividad = paramTexto(raw.tipoActividad)
  const grupo = paramTexto(raw.grupo)
  if (plantillaId) params.plantillaId = plantillaId
  if (tipoActividad) params.tipoActividad = tipoActividad
  if (grupo) params.grupo = grupo

  const ir = (opcion: 'rapido' | 'planificar') => {
    if (opcion === 'rapido') router.replace({ pathname: '/viaje/rapido', params })
    else router.replace({ pathname: '/viaje/crear', params })
  }

  return (
    <View style={styles.root}>
      <Pressable
        feedback={false}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
        onPress={() => router.back()}
        accessibilityLabel="Cerrar"
      />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
        <Text style={[styles.titulo, { color: theme.text }]}>Nuevo viaje</Text>

        <Opcion
          icon="zap"
          titulo="Viaje YA"
          detalle="Salís ahora: elegís la actividad, invitás y arrancan."
          destacada
          onPress={() => ir('rapido')}
        />
        <Opcion
          icon="calendar"
          titulo="Planificar viaje"
          detalle="Fecha, recorrido, parámetros e invitados con tiempo."
          onPress={() => ir('planificar')}
        />
      </View>
    </View>
  )
}

function Opcion({
  icon,
  titulo,
  detalle,
  destacada = false,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  titulo: string
  detalle: string
  destacada?: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.opcion,
        destacada
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.opcionIcono,
          { backgroundColor: destacada ? 'rgba(255,255,255,0.2)' : theme.accentWeak },
        ]}
      >
        <Feather name={icon} size={26} color={destacada ? theme.onAccent : theme.accent} />
      </View>
      <View style={styles.opcionTexto}>
        <Text style={[styles.opcionTitulo, { color: destacada ? theme.onAccent : theme.text }]}>
          {titulo}
        </Text>
        <Text style={[styles.opcionDetalle, { color: destacada ? theme.onAccent : theme.textDim }]}>
          {detalle}
        </Text>
      </View>
      <Feather name="chevron-right" size={22} color={destacada ? theme.onAccent : theme.textMute} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 6 },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    minHeight: 88,
  },
  opcionIcono: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  opcionTexto: { flex: 1, gap: 2 },
  opcionTitulo: { fontSize: 19, fontWeight: '800' },
  opcionDetalle: { fontSize: 14, lineHeight: 19 },
})
