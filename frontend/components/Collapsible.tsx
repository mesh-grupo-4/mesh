import { ReactNode, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/components/MeshUI';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleProps {
  title: string;
  icon?: keyof typeof Feather.glyphMap;
  /** Texto a la derecha del título (ej. cantidad seleccionada). */
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({ title, icon, badge, defaultOpen = false, children }: CollapsibleProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const mostrarBadge = badge !== undefined && badge !== '' && badge !== 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && { backgroundColor: theme.surface2 }]}
      >
        {icon && <Feather name={icon} size={18} color={theme.accent} style={styles.headerIcon} />}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {mostrarBadge && (
          <View style={[styles.badge, { backgroundColor: theme.accentWeak }]}>
            <Text style={[styles.badgeText, { color: theme.accent }]}>{badge}</Text>
          </View>
        )}
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textMute}
        />
      </Pressable>
      {open && (
        <View style={[styles.body, { borderTopColor: theme.border }]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  headerIcon: {
    marginRight: 0,
  },
  title: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
});
