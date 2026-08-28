import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';

type Theme = (typeof Colors)[keyof typeof Colors];

export type SegmentTabItem = {
  key: string;
  label: string;
};

type Props = {
  tabs: SegmentTabItem[];
  active: string;
  onChange: (key: string) => void;
  theme: Theme;
  style?: object;
};

export function SegmentTabs({ tabs, active, onChange, theme, style }: Props) {
  return (
    <View style={[styles.tabs, { borderColor: theme.border }, style]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              { backgroundColor: theme.surface },
              selected && { backgroundColor: theme.accentWeak },
            ]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.tabTexto, { color: selected ? theme.accent : theme.textDim }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabTexto: {
    fontSize: 14,
    fontWeight: '600',
  },
});
