import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';

// Hook auxiliar para acceder al tema activo
export function useTheme() {
  const scheme = useColorScheme() ?? 'dark';
  return Colors[scheme];
}

// ----------------------------------------------------
// LOGOS Y MARCAS MESH
// ----------------------------------------------------

export function MeshMark({ size = 30, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const activeColor = color ?? theme.accent;
  return (
    <View style={[styles.markContainer, { width: size, height: size }]}>
      <View style={[styles.markDot, { backgroundColor: activeColor, width: size * 0.4, height: size * 0.4 }]} />
      <View style={[styles.markRing, { borderColor: activeColor, borderWidth: size * 0.08, width: size, height: size }]} />
    </View>
  );
}

export function MeshLogo({ size = 30, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const activeColor = color ?? theme.text;
  return (
    <View style={styles.logoRow}>
      <MeshMark size={size} color={theme.accent} />
      <Text style={[styles.logoText, { fontSize: size * 0.9, color: activeColor }]}>Mesh</Text>
    </View>
  );
}

// ----------------------------------------------------
// BOTÓN PREMIUM (Btn)
// ----------------------------------------------------

interface BtnProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export function Btn({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  icon,
  iconRight,
  style,
}: BtnProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.96, { damping: 12, stiffness: 200 });
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    scale.value = withSpring(1);
  };

  // Resolver estilos de contenedor según variante
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: theme.accent,
        };
      case 'secondary':
        return {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderStrong,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.accentLine,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: theme.danger,
        };
      case 'danger-outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.danger,
        };
      default:
        return {};
    }
  };

  // Resolver estilos de texto según variante
  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return { color: theme.onAccent };
      case 'secondary':
        return { color: theme.text };
      case 'outline':
        return { color: theme.accent };
      case 'ghost':
        return { color: theme.textDim };
      case 'danger':
        return { color: '#ffffff' };
      case 'danger-outline':
        return { color: theme.danger };
      default:
        return {};
    }
  };

  // Resolver tamaños
  const getSizeStyles = (): { paddingVertical: number; paddingHorizontal: number; fontSize: number } => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13.5 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 22, fontSize: 16.5 };
      case 'md':
      default:
        return { paddingVertical: 13, paddingHorizontal: 18, fontSize: 15 };
    }
  };

  const variantStyle = getVariantStyles();
  const textStyle = getTextStyle();
  const sizeStyle = getSizeStyles();

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={({ pressed }) => [
        block ? styles.blockWidth : styles.inlineWidth,
        pressed && (variant === 'secondary' || variant === 'ghost') && { backgroundColor: theme.surface2 },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.btnBase,
          variantStyle,
          {
            paddingVertical: sizeStyle.paddingVertical,
            paddingHorizontal: sizeStyle.paddingHorizontal,
            borderRadius: theme.surface === '#ffffff' ? 10 : 12, // Radio adaptado a tweaks
            opacity: disabled ? 0.5 : 1,
          },
          animatedStyle,
        ]}
      >
        {icon && !loading && (
          <Feather name={icon} size={sizeStyle.fontSize + 2} color={textStyle.color as string} style={styles.iconLeft} />
        )}
        <Text style={[styles.btnText, textStyle, { fontSize: sizeStyle.fontSize }]}>
          {loading ? 'Cargando...' : children}
        </Text>
        {iconRight && !loading && (
          <Feather name={iconRight} size={sizeStyle.fontSize + 2} color={textStyle.color as string} style={styles.iconRight} />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ----------------------------------------------------
// ENTRADA DE DATOS (Field)
// ----------------------------------------------------

interface FieldProps extends TextInputProps {
  label: string;
  leading?: keyof typeof Feather.glyphMap;
  error?: string;
  style?: StyleProp<ViewStyle>;
}

export function Field({ label, leading, error, style, ...props }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[styles.fieldContainer, style]}>
      <Text style={[styles.fieldLabel, { color: theme.textDim }]}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.accent : theme.border,
          },
        ]}
      >
        {leading && (
          <Feather
            name={leading}
            size={18}
            color={focused ? theme.accent : theme.textMute}
            style={styles.fieldLeadingIcon}
          />
        )}
        <TextInput
          style={[styles.fieldInput, { color: theme.text }]}
          placeholderTextColor={theme.textMute}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error && <Text style={[styles.fieldError, { color: theme.danger }]}>{error}</Text>}
    </View>
  );
}

// ----------------------------------------------------
// ETIQUETAS DE ESTADO (Badge)
// ----------------------------------------------------

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'live' | 'accent' | 'good' | 'mute' | 'warning';
  pulse?: boolean;
}

export function Badge({ children, tone = 'mute', pulse = false }: BadgeProps) {
  const theme = useTheme();

  // Colores e indicador según el tono
  const getColors = () => {
    switch (tone) {
      case 'live':
        return { bg: theme.dangerWeak, text: theme.danger, dot: theme.danger };
      case 'accent':
        return { bg: theme.accentWeak, text: theme.accent, dot: theme.accent };
      case 'good':
        return { bg: 'rgba(79, 180, 119, 0.15)', text: theme.good, dot: theme.good };
      case 'warning':
        return { bg: 'rgba(232, 168, 56, 0.15)', text: '#e8a838', dot: '#e8a838' };
      case 'mute':
      default:
        return { bg: theme.surface2, text: theme.textDim, dot: theme.textMute };
    }
  };

  const colors = getColors();

  // Animación del pulso
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 800 }),
          withTiming(0.7, { duration: 800 })
        ),
        -1
      );
    } else {
      scale.value = 1;
      opacity.value = 0.7;
    }
  }, [pulse]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.badgeContainer, { backgroundColor: colors.bg }]}>
      {pulse && (
        <View style={styles.pulseWrapper}>
          <Animated.View
            style={[styles.pulseRing, { backgroundColor: colors.dot }, pulseRingStyle]}
          />
          <View style={[styles.pulseDot, { backgroundColor: colors.dot }]} />
        </View>
      )}
      {!pulse && tone === 'live' && (
        <View style={[styles.pulseDot, { backgroundColor: colors.dot, marginRight: 6 }]} />
      )}
      <Text style={[styles.badgeText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

// ----------------------------------------------------
// SELECCIÓN RÁPIDA (Chip & ChipRow)
// ----------------------------------------------------

interface ChipProps {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
}

export function Chip({ children, active = false, onPress, icon }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chipContainer,
        {
          backgroundColor: active ? theme.accentWeak : theme.surface,
          borderColor: active ? theme.accentLine : theme.border,
        },
      ]}
    >
      {icon && (
        <Feather
          name={icon}
          size={14}
          color={active ? theme.accent : theme.textDim}
          style={styles.chipIcon}
        />
      )}
      <Text
        style={[
          styles.chipText,
          {
            color: active ? theme.accent : theme.textDim,
            fontWeight: active ? '700' : '600',
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

// ----------------------------------------------------
// DETALLES DE USUARIO (Avatar & AvatarStack)
// ----------------------------------------------------

interface AvatarProps {
  person: {
    nombre?: string;
    apellido?: string;
    foto?: string;
    color?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ person, size = 'md', ring = false, style }: AvatarProps) {
  const theme = useTheme();

  const getInitials = () => {
    const n = person.nombre ? person.nombre[0] : '';
    const a = person.apellido ? person.apellido[0] : '';
    return (n + a).toUpperCase();
  };

  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { size: 34, fontSize: 13 };
      case 'lg':
        return { size: 64, fontSize: 24 };
      case 'md':
      default:
        return { size: 44, fontSize: 16 };
    }
  };

  const dims = getDimensions();

  // Curar un color de fondo si no tiene uno definido
  const getBgColor = () => {
    if (person.color) return person.color;
    const colors = ['#d76655', '#4a9eff', '#2f9e63', '#7a5ae0', '#c98a3e'];
    const charSum = (person.nombre || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charSum % colors.length];
  };

  return (
    <View
      style={[
        styles.avatarContainer,
        {
          width: dims.size,
          height: dims.size,
          borderRadius: dims.size / 2,
          backgroundColor: getBgColor(),
          borderColor: ring ? theme.accent : theme.surface,
          borderWidth: ring ? 2.5 : 0,
        },
        style,
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: dims.fontSize }]}>{getInitials()}</Text>
    </View>
  );
}

interface AvatarStackProps {
  ids: string[]; // IDs o nombres ficticios para generar avatares
  max?: number;
}

export function AvatarStack({ ids, max = 3 }: AvatarStackProps) {
  const theme = useTheme();
  const visibleIds = ids.slice(0, max);
  const remaining = ids.length - max;

  return (
    <View style={styles.avatarStack}>
      {visibleIds.map((id, index) => {
        // Personaje ficticio a partir del ID para iniciales básicas
        const dummyPerson = {
          nombre: id[0] || 'U',
          apellido: id[1] || '',
          color: undefined,
        };
        return (
          <Avatar
            key={id + '-' + index}
            person={dummyPerson}
            size="sm"
            style={{
              marginLeft: index === 0 ? 0 : -10,
              zIndex: visibleIds.length - index,
              borderWidth: 2,
              borderColor: theme.surface,
            }}
          />
        );
      })}
      {remaining > 0 && (
        <View
          style={[
            styles.avatarRemaining,
            {
              backgroundColor: theme.surface3,
              borderColor: theme.surface,
            },
          ]}
        >
          <Text style={[styles.avatarRemainingText, { color: theme.textDim }]}>+{remaining}</Text>
        </View>
      )}
    </View>
  );
}

// ----------------------------------------------------
// ICONO DE ACTIVIDAD (ActivityTile)
// ----------------------------------------------------

export function ActivityTile({
  activity,
  size = 46,
  color,
}: {
  activity: 'moto' | 'bici' | 'running' | 'trekking' | string;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const col = color ?? theme.accent;

  // Custom transparent styling similar to CSS color-mix(16% opacity)
  const bgCol = col === theme.accent ? theme.accentWeak : `${col}24`;

  const getIcon = () => {
    switch (activity) {
      case 'moto':
        return <MaterialCommunityIcons name="motorbike" size={size * 0.52} color={col} />;
      case 'bici':
        return <MaterialCommunityIcons name="bike" size={size * 0.52} color={col} />;
      case 'running':
        return <FontAwesome5 name="running" size={size * 0.48} color={col} style={{ marginLeft: 2 }} />;
      case 'trekking':
        return <MaterialCommunityIcons name="hiking" size={size * 0.55} color={col} />;
      default:
        return <Feather name="map" size={size * 0.5} color={col} />;
    }
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: bgCol,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {getIcon()}
    </View>
  );
}

// ----------------------------------------------------
// ENCABEZADO DE PANTALLA (TopBar)
// ----------------------------------------------------

interface TopBarProps {
  title: string;
  sub?: string | React.ReactNode;
  onBack?: () => void;
  bordered?: boolean;
  right?: React.ReactNode;
}

export function TopBar({ title, sub, onBack, bordered = true, right }: TopBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
          borderBottomWidth: bordered ? 1 : 0,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <View style={styles.topBarLeft}>
        {onBack !== undefined || router.canGoBack() ? (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: pressed ? theme.surface2 : theme.surface, borderColor: theme.border },
            ]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
        ) : null}
        <View style={styles.titleWrapper}>
          <Text style={[styles.topBarTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {sub && typeof sub === 'string' ? (
            <Text style={[styles.topBarSub, { color: theme.textDim }]} numberOfLines={1}>
              {sub}
            </Text>
          ) : (
            sub
          )}
        </View>
      </View>
      {right && <View style={styles.topBarRight}>{right}</View>}
    </View>
  );
}

// ----------------------------------------------------
// ESTILOS COMPARTIDOS
// ----------------------------------------------------

const styles = StyleSheet.create({
  // Logo & Mark
  markContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  markDot: {
    borderRadius: 999,
  },
  markRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontFamily: 'SpaceMono', // Fuente mono para estética de tesis
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  // Button
  blockWidth: {
    width: '100%',
  },
  inlineWidth: {
    alignSelf: 'flex-start',
  },
  btnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  // Field
  fieldContainer: {
    width: '100%',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  fieldLeadingIcon: {
    marginRight: 10,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15.5,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  // Badge
  badgeContainer: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  pulseWrapper: {
    width: 8,
    height: 8,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseRing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Chip
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 13.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Avatar
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRemaining: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginLeft: -10,
  },
  avatarRemainingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // TopBar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 56,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleWrapper: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  topBarSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
