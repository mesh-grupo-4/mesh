import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DragToDismiss } from '@/components/DragToDismiss'
import { Btn, useTheme } from '@/components/MeshUI'
import { MeshApiError } from '@/lib/apiClient'
import { CATEGORIAS_LUGAR, type CategoriaLugar, type LugarSugerido } from '@/lib/lugaresApi'
import { ofreceCombustible } from '@/lib/activityDefaults'

type Props = {
  visible: boolean
  titulo: string
  subtitulo?: string
  /** Texto del botón de cada lugar ("Agregar", "Ir"). */
  accionLabel: string
  buscar: (categoria: CategoriaLugar) => Promise<LugarSugerido[]>
  onElegir: (lugar: LugarSugerido, categoria: CategoriaLugar) => void
  onCerrar: () => void
  /** Texto auxiliar por lugar (p. ej. distancia). */
  detalle?: (lugar: LugarSugerido) => string | null
  /** Segunda acción por lugar (p. ej. "Solo yo" junto a "Vamos todos"); va como botón secundario. */
  accionSecundaria?: {
    label: string
    onElegir: (lugar: LugarSugerido, categoria: CategoriaLugar) => void
  }
  /** Sin vehículo (bici, running, trekking) no se ofrece Combustible. */
  tipoActividad?: string | null
}

function mensajeError(e: unknown): string {
  if (e instanceof MeshApiError) {
    if (e.code === 'LUGARES_NO_DISPONIBLE') return 'La búsqueda de lugares no está habilitada en el servidor.'
    if (e.code === 'LUGARES_RATE_LIMIT') return 'Demasiadas búsquedas. Esperá unos segundos y reintentá.'
  }
  return 'No se pudieron buscar lugares. Revisá tu conexión y reintentá.'
}

/**
 * Lista de lugares sugeridos por categoría de parada (Google Places vía backend).
 * Se usa al planificar (a lo largo de la ruta) y en vivo (cerca mío).
 * Hoja desplegable como la de alertas: se cierra arrastrando la cabecera hacia abajo.
 */
export function LugaresSugeridosModal({
  visible,
  titulo,
  subtitulo,
  accionLabel,
  buscar,
  onElegir,
  onCerrar,
  detalle,
  accionSecundaria,
  tipoActividad,
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const categorias = useMemo(
    () => CATEGORIAS_LUGAR.filter((c) => c.value !== 'combustible' || ofreceCombustible(tipoActividad)),
    [tipoActividad]
  )
  const [categoria, setCategoria] = useState<CategoriaLugar>(() => categorias[0]!.value)
  const [lugares, setLugares] = useState<LugarSugerido[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(
    async (cat: CategoriaLugar) => {
      setCargando(true)
      setError(null)
      try {
        setLugares(await buscar(cat))
      } catch (e) {
        setLugares([])
        setError(mensajeError(e))
      } finally {
        setCargando(false)
      }
    },
    [buscar]
  )

  useEffect(() => {
    if (visible) void cargar(categoria)
    // Solo al abrir y al cambiar de categoría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, categoria])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <GestureHandlerRootView style={styles.root}>
      <Pressable feedback={false} style={styles.fondo} onPress={onCerrar} accessibilityLabel="Cerrar" />
      <DragToDismiss
        onDismiss={onCerrar}
        style={[
          styles.hoja,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
        ]}
        // Solo la cabecera arrastra: si fuera toda la hoja, scrollear la lista la cerraría.
        cabecera={
          <>
            <View style={[styles.asa, { backgroundColor: theme.borderStrong }]} />
            <View style={styles.cabecera}>
              <View style={styles.cabeceraTexto}>
                <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
                {subtitulo ? <Text style={[styles.subtitulo, { color: theme.textDim }]}>{subtitulo}</Text> : null}
              </View>
              <Btn variant="ghost" size="sm" icon="x" onPress={onCerrar}>
                Cerrar
              </Btn>
            </View>
          </>
        }
      >

        <View style={styles.chips}>
          {categorias.map((c) => {
            const activa = c.value === categoria
            return (
              <Pressable
                key={c.value}
                onPress={() => setCategoria(c.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: activa ? theme.accent : theme.surface2,
                    borderColor: activa ? theme.accentLine : theme.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: activa }}
              >
                <Text style={styles.chipEmoji}>{c.emoji}</Text>
                <Text style={[styles.chipTxt, { color: activa ? theme.onAccent : theme.textDim }]}>{c.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {cargando ? (
          <View style={styles.estado}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : error ? (
          <View style={styles.estado}>
            <Text style={[styles.estadoTxt, { color: theme.danger }]}>{error}</Text>
            <Btn variant="outline" size="sm" icon="refresh-cw" onPress={() => void cargar(categoria)}>
              Reintentar
            </Btn>
          </View>
        ) : lugares.length === 0 ? (
          <View style={styles.estado}>
            <Text style={[styles.estadoTxt, { color: theme.textDim }]}>No encontramos lugares de esta categoría.</Text>
          </View>
        ) : (
          <FlatList
            data={lugares}
            keyExtractor={(l) => l.id}
            style={styles.lista}
            ItemSeparatorComponent={() => <View style={[styles.separador, { backgroundColor: theme.border }]} />}
            renderItem={({ item }) => {
              const extra = detalle?.(item)
              return (
                <View style={[styles.fila, accionSecundaria && styles.filaDoble]}>
                  <View style={[styles.filaTexto, accionSecundaria && styles.filaTextoDoble]}>
                    <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    {item.direccion || extra ? (
                      <Text style={[styles.direccion, { color: theme.textDim }]} numberOfLines={2}>
                        {[extra, item.direccion].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.acciones}>
                    {accionSecundaria ? (
                      <Btn size="sm" variant="outline" onPress={() => accionSecundaria.onElegir(item, categoria)}>
                        {accionSecundaria.label}
                      </Btn>
                    ) : null}
                    <Btn size="sm" onPress={() => onElegir(item, categoria)}>
                      {accionLabel}
                    </Btn>
                  </View>
                </View>
              )
            }}
          />
        )}
      </DragToDismiss>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  // Misma forma que la hoja de alertas (CrearAlertaSheet).
  hoja: {
    maxHeight: '75%',
    minHeight: '45%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  asa: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cabeceraTexto: { flex: 1 },
  titulo: { fontSize: 20, fontWeight: '800' },
  subtitulo: { fontSize: 14, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 16 },
  chipTxt: { fontSize: 15, fontWeight: '600' },
  estado: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 32 },
  estadoTxt: { fontSize: 15, textAlign: 'center' },
  lista: { marginTop: 4 },
  separador: { height: StyleSheet.hairlineWidth },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  // Con dos botones, el nombre del lugar no entra al lado: los botones van abajo.
  filaDoble: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  filaTexto: { flex: 1 },
  // En columna, flex: 1 dejaría el texto sin alto: toma el de su contenido.
  filaTextoDoble: { flex: 0 },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  nombre: { fontSize: 16, fontWeight: '600' },
  direccion: { fontSize: 14, marginTop: 2 },
})
