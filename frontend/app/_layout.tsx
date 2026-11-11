import 'react-native-gesture-handler';
import '@/tasks/locationTask';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  Stack,
  ThemeProvider,
  useGlobalSearchParams,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CopilotRoot } from '@/components/ayuda/CopilotRoot';
import { IntroMesh } from '@/components/intro/IntroMesh';
import { MeshDialogProvider } from '@/context/MeshDialogContext';
import { TripRealtimeProvider } from '@/context/TripRealtimeContext';
import Colors from '@/constants/Colors';
import { ViajeRealtimeBridge } from '@/components/ViajeRealtimeBridge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { consumePendingReturn, setPendingReturn } from '@/lib/pendingDeepLink';
import { debeMostrarIntro } from '@/lib/introMesh';
import { cargarPreferenciaTema } from '@/lib/temaApp';
import { cargarVibracionAvisos } from '@/lib/vibracionPrefs';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [temaListo, setTemaListo] = useState(false);
  const [mostrarIntro, setMostrarIntro] = useState(false);
  const [introTerminada, setIntroTerminada] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    // El splash espera al tema guardado para no mostrar un destello del otro modo.
    void cargarVibracionAvisos();
    void Promise.all([cargarPreferenciaTema(), debeMostrarIntro()]).then(([, intro]) => {
      setMostrarIntro(intro);
      setTemaListo(true);
    });
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    // Con intro, el splash se saca recién cuando la intro ya está dibujada.
    if (loaded && temaListo && !mostrarIntro) SplashScreen.hideAsync();
  }, [loaded, temaListo, mostrarIntro]);

  if (!loaded || !temaListo) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <MeshDialogProvider>
            <RootLayoutNav />
          </MeshDialogProvider>
          {mostrarIntro && !introTerminada && (
            <IntroMesh onLista={SplashScreen.hideAsync} onFin={() => setIntroTerminada(true)} />
          )}
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

type ParamsDeLink = { token?: string | string[]; viajeId?: string | string[] };

/** Link con el que se abrió la app, para retomarlo después del login. */
function retornoDeLink(segmento: string | undefined, params: ParamsDeLink): string | null {
  const primero = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim();
  if (segmento === 'ruta') {
    const token = primero(params.token);
    return token ? `/ruta?token=${encodeURIComponent(token)}` : null;
  }
  if (segmento === 'unirse') {
    const viajeId = primero(params.viajeId);
    return viajeId ? `/unirse?viajeId=${encodeURIComponent(viajeId)}` : null;
  }
  return null;
}

function AppStack() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="configurar-ruta" options={{ headerShown: false }} />
      <Stack.Screen name="viaje" options={{ headerShown: false }} />
      <Stack.Screen name="grupo" options={{ headerShown: false }} />
      <Stack.Screen name="amigos" options={{ headerShown: false }} />
      <Stack.Screen name="ruta" options={{ headerShown: false }} />
      <Stack.Screen name="mis-rutas" options={{ title: 'Mis rutas' }} />
      <Stack.Screen name="privacidad" options={{ headerShown: false }} />
      <Stack.Screen name="editar-perfil" options={{ headerShown: false }} />
      <Stack.Screen name="estadisticas" options={{ headerShown: false }} />
      <Stack.Screen name="apariencia" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="unirse" options={{ headerShown: false }} />
      <Stack.Screen
        name="nuevo-viaje"
        options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }}
      />
      <Stack.Screen
        name="repetir-entrenamiento"
        options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

function RootLayoutNav() {
  const { user, loading, backendUserId } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const globalParams = useGlobalSearchParams<ParamsDeLink>();

  usePushNotifications(backendUserId);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      const retorno = retornoDeLink(segments[0], globalParams);
      if (retorno) void setPendingReturn(retorno);
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      void (async () => {
        const pending = await consumePendingReturn();
        if (pending) {
          router.replace(pending as '/ruta');
        } else {
          router.replace('/(tabs)');
        }
      })();
    }
  }, [user, loading, segments, globalParams.token, globalParams.viajeId, router]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <CopilotRoot>
        <TripRealtimeProvider>
          {user && <ViajeRealtimeBridge />}
          <AppStack />
        </TripRealtimeProvider>
      </CopilotRoot>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  boot: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
