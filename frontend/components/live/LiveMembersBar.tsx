import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AvatarFallback } from '@/components/AvatarFallback'
import { useTheme } from '@/components/MeshUI'

export type LiveMember = {
  id: string
  nombre: string
  enMapa: boolean
}

type Props = {
  members: LiveMember[]
  currentUserId: string
}

export function LiveMembersBar({ members, currentUserId }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => setModalOpen(true)}
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
                !m.enMapa && styles.avatarOffline,
              ]}
            >
              <AvatarFallback nombre={m.nombre} size={32} />
            </View>
          ))}
        </ScrollView>

        <View style={[styles.legendBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
          <Feather name="users" size={16} color={theme.textDim} />
          <Text style={[styles.legendTxt, { color: theme.textDim }]}>{members.length}</Text>
        </View>
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={[styles.modalBg, { backgroundColor: theme.scrim }]} onPress={() => setModalOpen(false)}>
          <Pressable
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

            {members.map((m) => (
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
                  <Text style={[styles.memberStatus, { color: m.enMapa ? theme.good : theme.textMute }]}>
                    {m.enMapa ? 'En el mapa' : 'Sin ubicación'}
                  </Text>
                </View>
              </View>
            ))}

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
