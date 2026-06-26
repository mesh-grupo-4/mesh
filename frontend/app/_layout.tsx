import 'react-native-gesture-handler';
import '@/tasks/locationTask';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MeshDialogProvider } from '@/context/MeshDialogContext';
import { TripRealtimeProvider } from '@/context/TripRealtimeContext';
import Colors from '@/constants/Colors';
import { ViajeRealtimeBridge } from '@/components/ViajeRealtimeBridge';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <MeshDialogProvider>
        <RootLayoutNav />
      </MeshDialogProvider>
    </AuthProvider>
  );
}

function AppStack() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="configurar-ruta" options={{ headerShown: false }} />
      <Stack.Screen name="viaje" options={{ headerShown: false }} />
      <Stack.Screen name="grupo" options={{ headerShown: false }} />
      <Stack.Screen name="amigos" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

function RootLayoutNav() {
  const { user, loading, backendUserId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(backendUserId);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <TripRealtimeProvider>
        {user && <ViajeRealtimeBridge />}
        <AppStack />
      </TripRealtimeProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});