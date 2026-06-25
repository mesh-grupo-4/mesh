import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { AvatarFallback } from '@/components/AvatarFallback';
import { Btn, useTheme } from '@/components/MeshUI';
import type { GrupoMiembroApi } from '@/lib/gruposApi';

type Props = {
  visible: boolean;
  miembros: GrupoMiembroApi[];
  seleccionadoId: string | null;
  procesando: boolean;
  onSeleccionar: (id: string) => void;
  onConfirmar: () => void;
  onEliminarGrupo: () => void;
  onCerrar: () => void;
};

export function TransferirLiderazgoModal({
  visible,
  miembros,
  seleccionadoId,
  procesando,
  onSeleccionar,
  onConfirmar,
  onEliminarGrupo,
  onCerrar,
}: Props) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: theme.scrim }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.contenedor,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.titulo, { color: theme.text }]}>Abandonar grupo</Text>
          <Text style={[styles.descripcion, { color: theme.textDim }]}>
            Eres el líder del grupo. Para abandonar, debes seleccionar a un nuevo líder o eliminar
            el grupo.
          </Text>

          <FlatList
            data={miembros}
            keyExtractor={(item) => item.id}
            style={styles.lista}
            renderItem={({ item }) => {
              const seleccionado = item.id === seleccionadoId;
              return (
                <Pressable
                  style={[
                    styles.fila,
                    {
                      backgroundColor: seleccionado ? theme.accentWeak : theme.surface2,
                      borderColor: seleccionado ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => onSeleccionar(item.id)}
                  disabled={procesando}
                >
                  <AvatarFallback nombre={item.nombre} />
                  <View style={styles.filaContenido}>
                    <Text style={[styles.nombre, { color: theme.text }]}>{item.nombre}</Text>
                    <Text style={[styles.email, { color: theme.textDim }]}>{item.email}</Text>
                  </View>
                  {seleccionado ? (
                    <Text style={[styles.check, { color: theme.accent }]}>✓</Text>
                  ) : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.vacio, { color: theme.textMute }]}>
                No hay otros integrantes en el grupo.
              </Text>
            }
          />

          <Btn
            variant="danger"
            block
            size="lg"
            onPress={onConfirmar}
            disabled={!seleccionadoId || procesando}
            loading={procesando}
          >
            Confirmar y abandonar
          </Btn>

          <Btn
            variant="danger-outline"
            block
            size="lg"
            onPress={onEliminarGrupo}
            disabled={procesando}
          >
            Eliminar grupo
          </Btn>

          <Btn variant="ghost" block onPress={onCerrar} disabled={procesando}>
            Cancelar
          </Btn>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contenedor: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    gap: 12,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
  },
  descripcion: {
    fontSize: 14,
    lineHeight: 20,
  },
  lista: {
    maxHeight: 280,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
    justifyContent: 'flex-start',
  },
  filaContenido: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  nombre: {
    fontSize: 15,
    fontWeight: '600',
  },
  email: {
    fontSize: 13,
  },
  check: {
    fontSize: 18,
    fontWeight: '700',
  },
  vacio: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
