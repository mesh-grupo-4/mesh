import { useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'

type Props = {
  fotos: string[]
  /** De qué son las fotos, para los lectores de pantalla (ej. el nombre del recorrido). */
  descripcion: string
}

/**
 * Fotos en 4:3 que se pasan deslizando, con contador y puntos. Con una sola foto se ve
 * como una imagen fija; sin fotos no dibuja nada.
 */
export function CarruselFotos({ fotos, descripcion }: Props) {
  const theme = useTheme()
  const [ancho, setAncho] = useState(0)
  const [indice, setIndice] = useState(0)

  if (fotos.length === 0) return null
  const varias = fotos.length > 1

  return (
    <View
      style={[styles.marco, { backgroundColor: theme.surface2 }]}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
    >
      {ancho > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={varias}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const actual = Math.round(e.nativeEvent.contentOffset.x / ancho)
            setIndice((prev) => (prev === actual ? prev : actual))
          }}
        >
          {fotos.map((uri, i) => (
            <Image
              key={`${i}-${uri}`}
              source={{ uri }}
              style={[styles.foto, { width: ancho }]}
              resizeMode="cover"
              accessibilityLabel={`Foto ${i + 1} de ${fotos.length} de ${descripcion}`}
            />
          ))}
        </ScrollView>
      ) : null}

      {varias ? (
        <>
          {/* Sobre la foto el fondo no depende del tema: oscuro translúcido y texto blanco. */}
          <View style={styles.contador} pointerEvents="none">
            <Text style={styles.contadorTexto}>
              {indice + 1} / {fotos.length}
            </Text>
          </View>
          <View style={styles.puntos} pointerEvents="none">
            {fotos.map((uri, i) => (
              <View
                key={`${i}-${uri}`}
                style={[styles.punto, i === indice && styles.puntoActual]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  marco: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden' },
  foto: { height: '100%' },
  contador: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  contadorTexto: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },
  puntos: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  puntoActual: { width: 16, backgroundColor: '#ffffff' },
})
