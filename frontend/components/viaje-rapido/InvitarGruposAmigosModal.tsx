import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Btn, useTheme } from '@/components/MeshUI'
import { listarAmigos, type AmigoApi } from '@/lib/amistadesApi'
import { listarGrupos, type GrupoListItemApi } from '@/lib/gruposApi'
import { invitarAViaje } from '@/lib/viajesApi'

type Props = {
  visible: boolean
  viajeId: string
  userId: string
  onClose: () => void
  /** Se llama con la cantidad de invitaciones nuevas. */
  onInvitados: (cantidad: number) => void
}

/** Elegir grupos y/o amigos e invitarlos a un viaje ya creado (sala de espera). */
export function InvitarGruposAmigosModal({ visible, viajeId, userId, onClose, onInvitados }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [grupos, setGrupos] = useState<GrupoListItemApi[]>([])
  const [amigos, setAmigos] = useState<AmigoApi[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gruposSel, setGruposSel] = useState<Set<string>>(new Set())
  const [amigosSel, setAmigosSel] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelado = false
    setCargando(true)
    setError(null)
    setGruposSel(new Set())
    setAmigosSel(new Set())
    Promise.all([listarGrupos(userId), listarAmigos(userId)])
      .then(([g, a]) => {
        if (cancelado) return
        setGrupos(g)
        setAmigos(a)
      })
      .catch((e) => !cancelado && setError(e instanceof Error ? e.message : 'No se pudieron cargar.'))
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [visible, userId])

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
  }

  const enviar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const r = await invitarAViaje(viajeId, { grupoIds: [...gruposSel], amigoIds: [...amigosSel] })
      onInvitados(r.invitaciones_enviadas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron enviar las invitaciones.')
    } finally {
      setEnviando(false)
    }
  }

  const total = gruposSel.size + amigosSel.size

  const fila = (id: string, titulo: string, meta: string, sel: boolean, onPress: () => void) => (
    <Pressable
      key={id}
      onPress={onPress}
      style={[
        styles.fila,
        { backgroundColor: theme.surface2, borderColor: theme.border },
        sel && { borderColor: theme.accentLine, backgroundColor: theme.accentWeak },
      ]}
    >
      <View style={styles.filaInfo}>
        <Text style={[styles.filaNombre, { color: theme.text }]} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={[styles.filaMeta, { color: theme.textDim }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Feather name={sel ? 'check-circle' : 'circle'} size={22} color={sel ? theme.accent : theme.textMute} />
    </Pressable>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable feedback={false} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.titulo, { color: theme.text }]}>Invitar al viaje</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Feather name="x" size={22} color={theme.textMute} />
            </Pressable>
          </View>

          {cargando ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: 32 }} />
          ) : (
            <ScrollView style={styles.lista} contentContainerStyle={{ gap: 8 }}>
              <Text style={[styles.seccion, { color: theme.textDim }]}>GRUPOS</Text>
              {grupos.length === 0 ? (
                <Text style={[styles.vacio, { color: theme.textMute }]}>No tenés grupos.</Text>
              ) : (
                grupos.map((g) =>
                  fila(
                    g.id,
                    g.nombre,
                    `${g.cantidad_miembros} miembros · invita al grupo entero`,
                    gruposSel.has(g.id),
                    () => toggle(gruposSel, g.id, setGruposSel)
                  )
                )
              )}

              <Text style={[styles.seccion, { color: theme.textDim }]}>AMIGOS</Text>
              {amigos.length === 0 ? (
                <Text style={[styles.vacio, { color: theme.textMute }]}>No tenés amigos todavía.</Text>
              ) : (
                amigos.map((a) =>
                  fila(a.id, a.nombre, a.email, amigosSel.has(a.id), () => toggle(amigosSel, a.id, setAmigosSel))
                )
              )}
            </ScrollView>
          )}

          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

          <Btn
            block
            size="lg"
            icon="send"
            onPress={() => void enviar()}
            disabled={total === 0 || enviando}
            loading={enviando}
          >
            {total === 0 ? 'Elegí a quién invitar' : `Invitar (${total})`}
          </Btn>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 20, fontWeight: '800' },
  lista: { flexGrow: 0 },
  seccion: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  vacio: { fontSize: 14 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  filaInfo: { flex: 1 },
  filaNombre: { fontSize: 16, fontWeight: '700' },
  filaMeta: { fontSize: 13, marginTop: 2 },
  error: { fontSize: 14 },
})
