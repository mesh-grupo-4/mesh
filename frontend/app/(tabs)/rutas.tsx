import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCopilot } from 'react-native-copilot';

import { TopBar, useTheme } from '@/components/MeshUI';
import { PasoAyuda } from '@/components/ayuda/PasoAyuda';
import { AYUDA_RUTAS } from '@/components/ayuda/contenidoAyuda';
import { SegmentTabs } from '@/components/SegmentTabs';
import { RutasExplorarPanel } from '@/components/tabs/RutasExplorarPanel';
import { RutasGuardadasPanel } from '@/components/tabs/RutasGuardadasPanel';

type TabRutas = 'guardadas' | 'explorar';

export default function RutasScreen() {
  const theme = useTheme();
  const { start } = useCopilot();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [seccion, setSeccion] = useState<TabRutas>(tab === 'explorar' ? 'explorar' : 'guardadas');

  useEffect(() => {
    if (tab === 'explorar') setSeccion('explorar');
    if (tab === 'guardadas') setSeccion('guardadas');
  }, [tab]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Rutas" bordered={false} onAyuda={() => start()} />
      <PasoAyuda {...AYUDA_RUTAS[0]!}>
        <View style={styles.segmentWrap}>
          <SegmentTabs
            tabs={[
              { key: 'guardadas', label: 'Guardadas' },
              { key: 'explorar', label: 'Explorar' },
            ]}
            active={seccion}
            onChange={(key) => setSeccion(key as TabRutas)}
            theme={theme}
          />
        </View>
      </PasoAyuda>
      <PasoAyuda {...AYUDA_RUTAS[1]!} estilo={styles.flex1}>
        {seccion === 'guardadas' ? <RutasGuardadasPanel /> : <RutasExplorarPanel />}
      </PasoAyuda>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  segmentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
});
