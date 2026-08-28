import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { TopBar, useTheme } from '@/components/MeshUI';
import { SegmentTabs } from '@/components/SegmentTabs';
import { RutasExplorarPanel } from '@/components/tabs/RutasExplorarPanel';
import { RutasGuardadasPanel } from '@/components/tabs/RutasGuardadasPanel';

type TabRutas = 'guardadas' | 'explorar';

export default function RutasScreen() {
  const theme = useTheme();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [seccion, setSeccion] = useState<TabRutas>(tab === 'explorar' ? 'explorar' : 'guardadas');

  useEffect(() => {
    if (tab === 'explorar') setSeccion('explorar');
    if (tab === 'guardadas') setSeccion('guardadas');
  }, [tab]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar title="Rutas" bordered={false} />
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
      {seccion === 'guardadas' ? <RutasGuardadasPanel /> : <RutasExplorarPanel />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
});
