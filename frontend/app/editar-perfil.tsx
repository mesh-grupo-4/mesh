import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Avatar, Btn, Chip, ChipRow, Field, TopBar, useTheme } from '@/components/MeshUI'
import { HojaInferior } from '@/components/HojaInferior'
import { Pressable } from '@/components/Pressable'
import { FilaOpcion } from '@/components/perfil/FilaOpcion'
import { ActividadPreferida, useAuth } from '@/context/AuthContext'
import { meshAlert } from '@/lib/meshAlert'
import {
  elegirFoto,
  PermisoFotoDenegado,
  quitarFotoPerfil,
  subirFotoPerfil,
  type OrigenFoto,
} from '@/lib/fotoPerfil'
import { setFotoPerfil } from '@/lib/fotosPerfilStore'

/** Lo que tarda en cerrarse la hoja: en iOS el selector no abre mientras otro modal se está yendo. */
const CIERRE_HOJA_MS = 400

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
  const { profile, updateUserProfile, setFotoPerfilLocal, backendUserId } = useAuth()
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [actividad, setActividad] = useState<ActividadPreferida>('')
  const [guardando, setGuardando] = useState(false)
  const [hojaFoto, setHojaFoto] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const foto = profile?.photoUri ?? null

  // La foto se guarda al toque, aparte del botón Guardar: ya quedó en el backend.
  const reflejarFoto = async (url: string | null) => {
    await setFotoPerfilLocal(url)
    if (backendUserId) setFotoPerfil(backendUserId, url)
  }

  const cambiarFoto = (origen: OrigenFoto) => {
    setHojaFoto(false)
    setTimeout(async () => {
      let uri: string | null
      try {
        uri = await elegirFoto(origen)
      } catch (e) {
        if (e instanceof PermisoFotoDenegado) {
          meshAlert(
            'Permiso necesario',
            origen === 'camara'
              ? 'Habilitá el acceso a la cámara desde los ajustes del teléfono para sacarte una foto.'
              : 'Habilitá el acceso a tus fotos desde los ajustes del teléfono para elegir una.'
          )
        } else {
          meshAlert('Error', 'No se pudo abrir la imagen. Probá con otra.')
        }
        return
      }
      if (!uri) return

      setSubiendoFoto(true)
      try {
        await reflejarFoto(await subirFotoPerfil(uri))
      } catch (e) {
        meshAlert('No se pudo cambiar la foto', e instanceof Error ? e.message : 'Intentá de nuevo.')
      } finally {
        setSubiendoFoto(false)
      }
    }, CIERRE_HOJA_MS)
  }

  const quitarFoto = () => {
    setHojaFoto(false)
    meshAlert('Quitar foto', 'Vas a volver a mostrar tus iniciales.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setSubiendoFoto(true)
          try {
            await quitarFotoPerfil()
            await reflejarFoto(null)
          } catch {
            meshAlert('Error', 'No se pudo quitar la foto. Intentá de nuevo.')
          } finally {
            setSubiendoFoto(false)
          }
        },
      },
    ])
  }

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
        <View style={styles.fotoSeccion}>
          <Pressable
            onPress={() => setHojaFoto(true)}
            disabled={subiendoFoto}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
          >
            <Avatar
              person={{
                nombre: nombre || profile?.nombre || 'U',
                apellido,
                color: theme.accent,
                foto,
              }}
              size="xl"
            />
            <View style={[styles.fotoBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
              {subiendoFoto ? (
                <ActivityIndicator size="small" color={theme.onAccent} />
              ) : (
                <Feather name="camera" size={18} color={theme.onAccent} />
              )}
            </View>
          </Pressable>
          <Text style={[styles.fotoTexto, { color: theme.textDim }]}>
            {subiendoFoto ? 'Guardando foto…' : foto ? 'Tocá para cambiar tu foto' : 'Tocá para agregar una foto'}
          </Text>
        </View>

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

      <HojaInferior visible={hojaFoto} titulo="Foto de perfil" onCerrar={() => setHojaFoto(false)}>
        <FilaOpcion icono="image" titulo="Elegir de la galería" onPress={() => cambiarFoto('galeria')} />
        <FilaOpcion icono="camera" titulo="Sacar una foto" onPress={() => cambiarFoto('camara')} />
        {foto ? <FilaOpcion icono="trash-2" titulo="Quitar foto" peligro onPress={quitarFoto} /> : null}
      </HojaInferior>
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
  fotoSeccion: {
    alignItems: 'center',
    gap: 10,
  },
  fotoBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoTexto: {
    fontSize: 15,
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
