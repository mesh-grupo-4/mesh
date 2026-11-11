import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, Chip, ChipRow, Field, TopBar, useTheme } from '@/components/MeshUI'
import { ActividadPreferida, useAuth } from '@/context/AuthContext'
import { meshAlert } from '@/lib/meshAlert'

const ACTIVIDADES: { valor: ActividadPreferida; etiqueta: string; icono: keyof typeof Feather.glyphMap }[] = [
  { valor: 'moto', etiqueta: 'Moto', icono: 'compass' },
  { valor: 'auto', etiqueta: 'Auto', icono: 'navigation' },
  { valor: 'bici', etiqueta: 'Bici', icono: 'git-commit' },
  { valor: 'running', etiqueta: 'Running', icono: 'zap' },
  { valor: 'trekking', etiqueta: 'Trekking', icono: 'map' },
  { valor: 'otro', etiqueta: 'Otro', icono: 'more-horizontal' },
]

/** Consulta y edición de los datos personales, desde el lápiz del Perfil. */
export default function EditarPerfilScreen() {
  const { profile, updateUserProfile } = useAuth()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [actividad, setActividad] = useState<ActividadPreferida>('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre)
      setApellido(profile.apellido)
      setTelefono(profile.telefono ?? '')
      setActividad(profile.actividadPreferida)
    }
  }, [profile])

  const guardar = () => {
    if (!nombre.trim() || !apellido.trim()) {
      meshAlert('Campos requeridos', 'El nombre y apellido no pueden estar vacíos.')
      return
    }
    meshAlert('Guardar cambios', '¿Estás seguro que querés guardar los cambios?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Guardar',
        onPress: async () => {
          setGuardando(true)
          try {
            await updateUserProfile({
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              telefono: telefono.trim(),
              actividadPreferida: actividad,
            })
            router.back()
          } catch {
            meshAlert('Error', 'No se pudieron guardar los cambios. Intentá de nuevo.')
          } finally {
            setGuardando(false)
          }
        },
      },
    ])
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Editar perfil" bordered={false} />

      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.seccion}>
          <Text style={[styles.eyebrow, { color: theme.textDim }]}>DATOS PERSONALES</Text>
          <View style={styles.fila}>
            <View style={styles.mitad}>
              <Field
                label="Nombre"
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="words"
                placeholderTextColor={theme.textMute}
              />
            </View>
            <View style={styles.mitad}>
              <Field
                label="Apellido"
                value={apellido}
                onChangeText={setApellido}
                autoCapitalize="words"
                placeholderTextColor={theme.textMute}
              />
            </View>
          </View>

          <Field
            label="Teléfono"
            leading="phone"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            placeholderTextColor={theme.textMute}
            placeholder="ej: 351 123-4567"
          />
        </View>

        <View style={styles.seccion}>
          <Text style={[styles.eyebrow, { color: theme.textDim }]}>ACTIVIDAD PREFERIDA</Text>
          <ChipRow>
            {ACTIVIDADES.map(({ valor, etiqueta, icono }) => (
              <Chip
                key={valor}
                icon={icono}
                active={actividad === valor}
                onPress={() => setActividad(valor === actividad ? '' : valor)}
              >
                {etiqueta}
              </Chip>
            ))}
          </ChipRow>
        </View>

        <Btn variant="primary" size="lg" block onPress={guardar} loading={guardando}>
          Guardar
        </Btn>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contenido: {
    padding: 20,
    gap: 24,
  },
  seccion: {
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  fila: {
    flexDirection: 'row',
    gap: 12,
  },
  mitad: {
    flex: 1,
  },
})
