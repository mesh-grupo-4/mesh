import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, useTheme } from '@/components/MeshUI'
import { MeshApiError } from '@/lib/apiClient'
import { CATEGORIAS_LUGAR, type CategoriaLugar, type LugarSugerido } from '@/lib/lugaresApi'

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
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [categoria, setCategoria] = useState<CategoriaLugar>('combustible')
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
      <Pressable style={styles.fondo} onPress={onCerrar} accessibilityLabel="Cerrar" />
      <View
        style={[
          styles.hoja,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.cabecera}>
          <View style={styles.cabeceraTexto}>
            <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
            {subtitulo ? <Text style={[styles.subtitulo, { color: theme.textDim }]}>{subtitulo}</Text> : null}
          </View>
          <Btn variant="ghost" size="sm" icon="x" onPress={onCerrar}>
            Cerrar
          </Btn>
        </View>

        <View style={styles.chips}>
          {CATEGORIAS_LUGAR.map((c) => {
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
                <View style={styles.fila}>
                  <View style={styles.filaTexto}>
                    <Text style={[styles.nombre, { color: theme.text }]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    {item.direccion || extra ? (
                      <Text style={[styles.direccion, { color: theme.textDim }]} numberOfLines={2}>
                        {[extra, item.direccion].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Btn size="sm" onPress={() => onElegir(item, categoria)}>
                    {accionLabel}
                  </Btn>
                </View>
              )
            }}
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  hoja: {
    maxHeight: '75%',
    minHeight: '45%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cabeceraTexto: { flex: 1 },
  titulo: { fontSize: 20, fontWeight: '700' },
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
  filaTexto: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '600' },
  direccion: { fontSize: 14, marginTop: 2 },
})
