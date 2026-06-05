import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { AvatarFallback } from '@/components/AvatarFallback';
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
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={styles.overlay}>
        <View style={styles.contenedor}>
          <Text style={styles.titulo}>Abandonar grupo</Text>
          <Text style={styles.descripcion}>
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
                <TouchableOpacity
                  style={[styles.fila, seleccionado && styles.filaSeleccionada]}
                  onPress={() => onSeleccionar(item.id)}
                  disabled={procesando}
                >
                  <AvatarFallback nombre={item.nombre} />
                  <View style={styles.filaContenido}>
                    <Text style={styles.nombre}>{item.nombre}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                  </View>
                  {seleccionado && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.vacio}>No hay otros integrantes en el grupo.</Text>
            }
          />

          <TouchableOpacity
            style={[styles.botonPrimario, (!seleccionadoId || procesando) && styles.botonDeshabilitado]}
            onPress={onConfirmar}
            disabled={!seleccionadoId || procesando}
          >
            {procesando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonPrimarioTexto}>Confirmar y abandonar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonSecundario}
            onPress={onEliminarGrupo}
            disabled={procesando}
          >
            <Text style={styles.botonSecundarioTexto}>Eliminar grupo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botonCancelar} onPress={onCerrar} disabled={procesando}>
            <Text style={styles.botonCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  contenedor: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    gap: 12,
  },
  titulo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  descripcion: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  lista: {
    maxHeight: 280,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  filaSeleccionada: {
    borderColor: '#4a9eff',
    backgroundColor: '#1a2a3a',
  },
  filaContenido: {
    flex: 1,
    gap: 2,
  },
  nombre: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  email: {
    color: '#888',
    fontSize: 13,
  },
  check: {
    color: '#4a9eff',
    fontSize: 18,
    fontWeight: '700',
  },
  vacio: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  botonPrimario: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  botonDeshabilitado: {
    opacity: 0.5,
  },
  botonPrimarioTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  botonSecundario: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  botonSecundarioTexto: {
    color: '#ff6b6b',
    fontSize: 15,
    fontWeight: '600',
  },
  botonCancelar: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonCancelarTexto: {
    color: '#888',
    fontSize: 15,
  },
});
