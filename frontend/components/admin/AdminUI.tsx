import { Feather } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, TopBar, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import type { Pagina } from '@/lib/adminApi'
import { formatearEnArg } from '@/lib/tiempoArg'

/** RN-105: toda fecha visible va en hora argentina. */
export function fechaAdmin(iso: string | null | undefined): string {
  return formatearEnArg(iso, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function nombreCompleto(p: { nombre: string; apellido: string | null }): string {
  return [p.nombre, p.apellido].filter(Boolean).join(' ')
}

export const ETIQUETA_ESTADO_VIAJE = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
} as const

export const ETIQUETA_ACTIVIDAD: Record<string, string> = {
  moto: 'Moto',
  bici: 'Bici',
  running: 'Running',
  trekking: 'Trekking',
  otro: 'Otro',
}

export function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Intentá de nuevo en unos segundos.'
}

/**
 * Marco común de las pantallas del backoffice. Si la persona no es superadmin no
 * muestra nada: el backend igual rechazaría cada llamada (RN-030), esto solo evita
 * una pantalla llena de errores.
 */
export function AdminScreen({
  title,
  sub,
  cargando = false,
  onRefresh,
  onAyuda,
  children,
}: {
  title: string
  sub?: string
  cargando?: boolean
  onRefresh?: () => void
  onAyuda?: () => void
  children: ReactNode
}) {
  const router = useRouter()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { esSuperadmin } = useAuth()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar title={title} sub={sub} onBack={() => router.back()} onAyuda={onAyuda} />
      {!esSuperadmin ? (
        <View style={styles.center}>
          <Feather name="lock" size={28} color={theme.textMute} />
          <Text style={[styles.vacio, { color: theme.textDim }]}>
            Esta sección es solo para superadministradores.
          </Text>
        </View>
      ) : cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.accent} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      )}
    </View>
  )
}

export function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {titulo ? <Text style={[styles.tituloSeccion, { color: theme.text }]}>{titulo}</Text> : null}
      {children}
    </View>
  )
}

export function Fila({
  titulo,
  detalle,
  etiqueta,
  tonoEtiqueta = 'mute',
  icono,
  onPress,
  acciones,
}: {
  titulo: string
  detalle?: string
  etiqueta?: string
  tonoEtiqueta?: 'mute' | 'accent' | 'danger' | 'good'
  icono?: keyof typeof Feather.glyphMap
  onPress?: () => void
  acciones?: ReactNode
}) {
  const theme = useTheme()
  const colorEtiqueta = {
    mute: theme.textDim,
    accent: theme.accent,
    danger: theme.danger,
    good: theme.good,
  }[tonoEtiqueta]

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.fila,
        { borderTopColor: theme.border, opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      {icono ? <Feather name={icono} size={18} color={theme.accent} /> : null}
      <View style={styles.filaTexto}>
        <Text style={[styles.filaTitulo, { color: theme.text }]} numberOfLines={1}>
          {titulo}
        </Text>
        {detalle ? (
          <Text style={[styles.filaDetalle, { color: theme.textDim }]} numberOfLines={2}>
            {detalle}
          </Text>
        ) : null}
        {acciones ? <View style={styles.filaAcciones}>{acciones}</View> : null}
      </View>
      {etiqueta ? (
        <Text style={[styles.etiqueta, { color: colorEtiqueta, borderColor: colorEtiqueta }]}>
          {etiqueta}
        </Text>
      ) : null}
      {onPress ? <Feather name="chevron-right" size={18} color={theme.textMute} /> : null}
    </Pressable>
  )
}

export function Vacio({ texto }: { texto: string }) {
  const theme = useTheme()
  return <Text style={[styles.vacio, { color: theme.textMute }]}>{texto}</Text>
}

export function Paginador<T>({
  datos,
  onCambiar,
}: {
  datos: Pagina<T> | null
  onCambiar: (pagina: number) => void
}) {
  const theme = useTheme()
  if (!datos || datos.total <= datos.limite) return null
  const paginas = Math.ceil(datos.total / datos.limite)
  return (
    <View style={styles.paginador}>
      <Btn
        variant="outline"
        size="sm"
        icon="chevron-left"
        disabled={datos.pagina <= 1}
        onPress={() => onCambiar(datos.pagina - 1)}
      >
        Anterior
      </Btn>
      <Text style={{ color: theme.textDim }}>
        {datos.pagina} de {paginas}
      </Text>
      <Btn
        variant="outline"
        size="sm"
        iconRight="chevron-right"
        disabled={datos.pagina >= paginas}
        onPress={() => onCambiar(datos.pagina + 1)}
      >
        Siguiente
      </Btn>
    </View>
  )
}

/**
 * Carga paginada para los listados del backoffice. `filtros` es la clave de la
 * consulta: cuando cambia se vuelve a la página 1.
 */
export function useListadoAdmin<T>(
  cargarPagina: (pagina: number) => Promise<Pagina<T>>,
  filtros: string
) {
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<Pagina<T> | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPagina(1)
  }, [filtros])

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      setDatos(await cargarPagina(pagina))
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
    // `cargarPagina` cambia con los filtros, que ya están en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtros])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { datos, cargando, error, setPagina, recargar }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  scroll: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  tituloSeccion: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  filaTexto: { flex: 1, gap: 3 },
  filaTitulo: { fontSize: 15, fontWeight: '600' },
  filaDetalle: { fontSize: 13, lineHeight: 18 },
  filaAcciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  etiqueta: {
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  vacio: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  paginador: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
