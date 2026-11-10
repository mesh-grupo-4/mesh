import { Feather } from '@expo/vector-icons'
import { Modal, StyleSheet, Text, View } from 'react-native'

import { Btn, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { ETIQUETA_RAREZA, coloresRareza } from '@/components/perfil/InsigniaChip'
import type { InsigniaObtenidaApi } from '@/lib/insigniasApi'
import { formatearEnArg } from '@/lib/tiempoArg'

type Props = {
  insignia: InsigniaObtenidaApi | null
  onClose: () => void
}

/** Detalle de una insignia obtenida: rareza, cómo se consigue y cuándo se ganó. */
export function DetalleInsigniaModal({ insignia, onClose }: Props) {
  const theme = useTheme()
  if (!insignia) return null
  const { color, fondo, borde } = coloresRareza(theme, insignia.rareza)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        feedback={false}
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Cerrar detalle de la insignia"
      >
        <Pressable
          feedback={false}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: borde }]}
          // Evita que el toque dentro de la tarjeta la cierre.
          onPress={() => {}}
        >
          <View style={[styles.iconoWrap, { backgroundColor: fondo, borderColor: borde }]}>
            <Feather name={insignia.icono as keyof typeof Feather.glyphMap} size={38} color={color} />
          </View>
          <Text style={[styles.rareza, { color }]}>{ETIQUETA_RAREZA[insignia.rareza]}</Text>
          <Text style={[styles.nombre, { color: theme.text }]}>{insignia.nombre}</Text>
          {insignia.descripcion ? (
            <Text style={[styles.descripcion, { color: theme.textDim }]}>{insignia.descripcion}</Text>
          ) : null}
          {/* RN-105: fecha en hora argentina. */}
          <Text style={[styles.fecha, { color: theme.textMute }]}>
            Conseguida el{' '}
            {formatearEnArg(insignia.obtenida_at, { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Btn variant="secondary" block onPress={onClose} style={{ marginTop: 8 }}>
            Cerrar
          </Btn>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderRadius: 20,
    borderWidth: 2,
  },
  iconoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  rareza: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  nombre: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  descripcion: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  fecha: { fontSize: 13, marginTop: 2 },
})
