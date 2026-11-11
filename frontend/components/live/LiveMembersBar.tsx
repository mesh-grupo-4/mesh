import { Feather } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Pressable } from '@/components/Pressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvatarFallback } from '@/components/AvatarFallback'
import { Badge, Btn, useTheme } from '@/components/MeshUI'
import { listarRelacionesAmistad, solicitarAmistad, type RelacionAmistad } from '@/lib/amistadesApi'

export type LiveMember = {
  id: string
  nombre: string
  enMapa: boolean
  /** Está en el mapa pero su última posición quedó vieja (perdió señal). */
  sinSenal?: boolean
  /** RN-035 / SCRUM-33: separación respecto de mí, en metros, en tiempo real. */
  distanciaM?: number | null
  /** Supera la separación máxima configurada en el viaje (RN-025). */
  lejos?: boolean
}

export function textoDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function estadoDe(m: LiveMember): { texto: string; tono: 'good' | 'dim' | 'mute' | 'danger' } {
  if (!m.enMapa) return { texto: 'Sin ubicación', tono: 'mute' }
  if (m.sinSenal) return { texto: 'Sin señal', tono: 'dim' }
  if (m.distanciaM != null) {
    return m.lejos
      ? { texto: `A ${textoDistancia(m.distanciaM)} · fuera del rango del grupo`, tono: 'danger' }
      : { texto: `A ${textoDistancia(m.distanciaM)}`, tono: 'good' }
  }
  return { texto: 'En el mapa', tono: 'good' }
}

type Props = {
  members: LiveMember[]
  currentUserId: string
  /** Avisa al header que la lista está abierta, para que no se cierre solo con ella adentro. */
  onListaAbiertaChange?: (abierta: boolean) => void
}

export function LiveMembersBar({ members, currentUserId, onListaAbiertaChange }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [modalOpen, setModalOpen] = useState(false)
  // null hasta saber la relación con cada uno: sin eso no se ofrece agregar.
  const [relaciones, setRelaciones] = useState<Map<string, RelacionAmistad> | null>(null)
  const [enviandoA, setEnviandoA] = useState<string | null>(null)
  const [errorAmistad, setErrorAmistad] = useState<string | null>(null)

  useEffect(() => {
    if (!modalOpen) return
    onListaAbiertaChange?.(true)
    return () => onListaAbiertaChange?.(false)
  }, [modalOpen, onListaAbiertaChange])

  const cargarRelaciones = useCallback(async () => {
    try {
      const lista = await listarRelacionesAmistad()
      setRelaciones(new Map(lista.map((r) => [r.usuario_id, r.relacion])))
    } catch {
      // Sin red la lista sigue sirviendo para ver al grupo, solo no ofrece agregar.
    }
  }, [])

  const abrirLista = () => {
    setErrorAmistad(null)
    setModalOpen(true)
    void cargarRelaciones()
  }

  const agregarAmigo = async (usuarioId: string) => {
    setEnviandoA(usuarioId)
    setErrorAmistad(null)
    try {
      await solicitarAmistad(usuarioId, currentUserId)
      setRelaciones((prev) => new Map(prev).set(usuarioId, 'solicitud_enviada'))
    } catch (e: unknown) {
      // Se muestra acá porque un meshAlert, que es otro Modal, no se apila sobre este en iOS.
      setErrorAmistad(e instanceof Error ? e.message : 'No se pudo enviar la solicitud.')
      void cargarRelaciones()
    } finally {
      setEnviandoA(null)
    }
  }

  const renderAmistad = (usuarioId: string) => {
    if (usuarioId === currentUserId || !relaciones) return null
    const relacion = relaciones.get(usuarioId) ?? null
    if (relacion === 'amigo') return <Badge tone="good">Amigos</Badge>
    if (relacion === 'solicitud_enviada') return <Badge tone="mute">Solicitud enviada</Badge>
    if (relacion === 'solicitud_recibida') return <Badge tone="accent">Te envió solicitud</Badge>
    return (
      <Btn
        variant="secondary"
        size="sm"
        icon="user-plus"
        onPress={() => void agregarAmigo(usuarioId)}
        loading={enviandoA === usuarioId}
        disabled={enviandoA !== null}
      >
        Agregar
      </Btn>
    )
  }

  return (
    <>
      <Pressable
        onPress={abrirLista}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        accessibilityLabel="Ver integrantes del viaje"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.avatarScroll}
          style={styles.avatarList}
        >
          {members.map((m) => (
            <View
              key={m.id}
              style={[
                styles.avatarWrap,
                m.id === currentUserId && { borderColor: theme.good, borderWidth: 2 },
                m.lejos && { borderColor: theme.danger, borderWidth: 2 },
                (!m.enMapa || m.sinSenal) && styles.avatarOffline,
              ]}
            >
              <AvatarFallback nombre={m.nombre} size={32} />
              {m.distanciaM != null && m.id !== currentUserId ? (
                <Text
                  style={[
                    styles.avatarDist,
                    { color: m.lejos ? theme.danger : theme.textDim },
                  ]}
                  numberOfLines={1}
                >
                  {textoDistancia(m.distanciaM)}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.legendBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
          <Feather name="users" size={16} color={theme.textDim} />
          <Text style={[styles.legendTxt, { color: theme.textDim }]}>{members.length}</Text>
        </View>
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable feedback={false} style={[styles.modalBg, { backgroundColor: theme.scrim }]} onPress={() => setModalOpen(false)}>
          <Pressable
            feedback={false}
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Integrantes</Text>
            <Text style={[styles.modalHint, { color: theme.textDim }]}>
              Cada color identifica a una persona en el mapa.
            </Text>
            {errorAmistad ? (
              <Text style={[styles.errorAmistad, { color: theme.danger }]}>{errorAmistad}</Text>
            ) : null}

            <ScrollView style={styles.memberList}>
              {members.map((m) => {
                const estado = estadoDe(m)
                const colorEstado =
                  estado.tono === 'good'
                    ? theme.good
                    : estado.tono === 'danger'
                      ? theme.danger
                      : estado.tono === 'dim'
                        ? theme.textDim
                        : theme.textMute
                return (
                  <View
                    key={m.id}
                    style={[styles.memberRow, { borderBottomColor: theme.border }]}
                  >
                    <AvatarFallback nombre={m.nombre} size={40} />
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                        {m.nombre}
                        {m.id === currentUserId ? ' (vos)' : ''}
                      </Text>
                      <Text style={[styles.memberStatus, { color: colorEstado }]}>{estado.texto}</Text>
                    </View>
                    {renderAmistad(m.id)}
                  </View>
                )
              })}
            </ScrollView>

            <Pressable
              onPress={() => setModalOpen(false)}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.closeBtnTxt, { color: theme.text }]}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  avatarList: {
    flex: 1,
  },
  avatarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  avatarWrap: {
    borderRadius: 18,
    padding: 1,
    alignItems: 'center',
  },
  avatarDist: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    maxWidth: 48,
  },
  avatarOffline: {
    opacity: 0.55,
  },
  legendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  legendTxt: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1.2,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  errorAmistad: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 18,
  },
  memberList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberStatus: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
  },
  closeBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
  },
})
