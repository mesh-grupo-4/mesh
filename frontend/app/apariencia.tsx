import { StyleSheet, Text, View } from 'react-native'

import { TopBar, useTheme } from '@/components/MeshUI'
import { SelectorTema } from '@/components/SelectorTema'

export default function AparienciaScreen() {
  const theme = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Apariencia" bordered={false} />
      <View style={styles.contenido}>
        <Text style={[styles.eyebrow, { color: theme.textDim }]}>TEMA DE LA APP</Text>
        <SelectorTema />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contenido: {
    padding: 20,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
})
