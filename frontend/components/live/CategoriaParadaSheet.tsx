import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/components/MeshUI'
import { DragToDismiss } from '@/components/DragToDismiss'
import { tamanoOutdoor } from '@/constants/Typography'
import { uiConfigPorActividad } from '@/lib/activityUi'
import { CATEGORIAS_PARADA, type CategoriaParadaApi } from '@/lib/paradasApi'
import type { TipoActividadApi } from '@/lib/viajesApi'

/** Selector de categoría al registrar una parada voluntaria (RN-022). */
type Props = {
  visible: boolean
  /** `grupal`: el líder eligió detener a todo el grupo (RN-045). */
  onSeleccionar: (categoria: CategoriaParadaApi, grupal: boolean) => void
  onCancelar: () => void
  /** Solo el líder de un viaje grupal ve la opción de detener a todos. */
  puedeDetenerGrupo?: boolean
  tipoActividad?: TipoActividadApi
}

export function CategoriaParadaSheet({
  visible,
  onSeleccionar,
  onCancelar,
  puedeDetenerGrupo = false,
  tipoActividad = 'otro',
}: Props) {
  const { altoContraste, escalaBotones } = uiConfigPorActividad(tipoActividad)
  const theme = useTheme(altoContraste)
  const insets = useSafeAreaInsets()
  const alturaOpcion = Math.round(58 * escalaBotones)
  const [todoElGrupo, setTodoElGrupo] = useState(false)

  // Cada parada arranca en "Solo yo": detener a todos tiene que ser una elección explícita.
  useEffect(() => {
    if (visible) setTodoElGrupo(false)
  }, [visible])

  const elegir = (categoria: CategoriaParadaApi) => onSeleccionar(categoria, puedeDetenerGrupo && todoElGrupo)

  const accidente = CATEGORIAS_PARADA.find((c) => c.id === 'accidente')
  const resto = CATEGORIAS_PARADA.filter((c) => c.id !== 'accidente')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <GestureHandlerRootView style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancelar} />
        <DragToDismiss
          onDismiss={onCancelar}
          style={[
            styles.hoja,
            {
              backgroundColor: theme.surface,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.asa, { backgroundColor: theme.borderStrong }]} />

          <Text style={[styles.titulo, { color: theme.text }]}>¿Por qué parás?</Text>
          <Text style={[styles.subtitulo, { color: theme.textDim, fontSize: tamanoOutdoor(13.5) }]}>
            Se le avisa al grupo con el motivo.
          </Text>

          {puedeDetenerGrupo ? (
            <View style={styles.alcance}>
              {[
                { valor: false, texto: 'Solo yo', icono: 'user' as const },
                { valor: true, texto: 'Todo el grupo', icono: 'users' as const },
              ].map((o) => {
                const activo = todoElGrupo === o.valor
                return (
                  <Pressable
                    key={o.texto}
                    onPress={() => setTodoElGrupo(o.valor)}
                    style={[
                      styles.alcanceOpcion,
                      {
                        minHeight: alturaOpcion,
                        backgroundColor: activo ? theme.accent : theme.surface2,
                        borderColor: activo ? theme.accent : theme.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activo }}
                    accessibilityLabel={o.texto}
                  >
                    <Feather name={o.icono} size={18} color={activo ? '#fff' : theme.text} />
                    <Text
                      style={[
                        styles.alcanceTxt,
                        { color: activo ? '#fff' : theme.text, fontSize: tamanoOutdoor(14.5) },
                      ]}
                    >
                      {o.texto}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {accidente ? (
            <Pressable
              style={({ pressed }) => [
                styles.accidente,
                { backgroundColor: theme.danger, minHeight: Math.round(66 * escalaBotones) },
                pressed && styles.presionado,
              ]}
              onPress={() => elegir(accidente.id)}
              accessibilityRole="button"
              accessibilityLabel="Reportar un accidente"
            >
              <View style={styles.accidenteIcono}>
                <Feather name="alert-triangle" size={22} color="#fff" />
              </View>
              <View style={styles.accidenteTxtWrap}>
                <Text style={styles.accidenteTitulo}>Accidente</Text>
                <Text style={[styles.accidenteSub, { fontSize: tamanoOutdoor(12.5) }]}>
                  Avisa a todo el grupo al instante
                </Text>
              </View>
              <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ) : null}

          <View style={styles.grilla}>
            {resto.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [
                  styles.opcion,
                  { backgroundColor: theme.surface2, borderColor: theme.border, minHeight: alturaOpcion },
                  pressed && [styles.presionado, { borderColor: theme.accentLine }],
                ]}
                onPress={() => elegir(c.id)}
                accessibilityRole="button"
                accessibilityLabel={`Parada por ${c.label}`}
              >
                <View style={[styles.opcionEmojiWrap, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.emoji, { color: theme.text }]}>{c.emoji}</Text>
                </View>
                <Text
                  style={[styles.opcionTxt, { color: theme.text, fontSize: tamanoOutdoor(14.5) }]}
                  numberOfLines={2}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.cancelar,
              { backgroundColor: theme.surface2 },
              pressed && styles.presionado,
            ]}
            onPress={onCancelar}
          >
            <Text style={[styles.cancelarTxt, { color: theme.textDim }]}>Cancelar</Text>
          </Pressable>
        </DragToDismiss>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  hoja: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  asa: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 13.5,
    marginTop: 3,
    marginBottom: 16,
  },
  alcance: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  alcanceOpcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  alcanceTxt: {
    fontWeight: '800',
  },
  accidente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 66,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  accidenteIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accidenteTxtWrap: {
    flex: 1,
  },
  accidenteTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  accidenteSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  grilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  opcion: {
    // Dos por fila: objetivos grandes para tocar en movimiento (RN-052).
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
  },
  opcionEmojiWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
  },
  opcionTxt: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
  },
  presionado: {
    opacity: 0.7,
  },
  cancelar: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarTxt: {
    fontSize: 15.5,
    fontWeight: '700',
  },
})
