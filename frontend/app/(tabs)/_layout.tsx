import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useTheme } from '@/components/MeshUI';
import { CenterInicioTabButton } from '@/components/CenterInicioTabButton';
import { capaBlurTab } from '@/components/BlurTargetTab';
import { MeshTabBar } from '@/components/MeshTabBar';
import { useAuth } from '@/context/AuthContext';
import { usePendientesBadge } from '@/lib/pendientesStore';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: React.ComponentProps<typeof FontAwesome>['color'];
}) {
  return <FontAwesome size={20} style={{ marginBottom: -3 }} {...props} />;
}

// Inicio es la primera de la barra y la pestaña con la que arranca la app.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const theme = useTheme();
  const { backendUserId } = useAuth();
  const pendientes = usePendientesBadge(backendUserId);
  return (
    <Tabs
      // Atrás de Android: desde cualquier pestaña vuelve a Inicio y recién ahí sale de la app.
      initialRouteName="index"
      backBehavior="initialRoute"
      tabBar={(props) => <MeshTabBar {...props} />}
      // De una sección a otra se pasa solo tocando la barra: el gesto de deslizar se
      // pisaba con el scroll de las listas.
      screenLayout={({ route, children }) => capaBlurTab({ route, children })}
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: '#ffffff',
      }}
    >
      {/* Orden: Inicio · Viajes · Entrenar · Grupos · Rutas · Perfil. */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => <CenterInicioTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Viajes',
          tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
        }}
      />
      <Tabs.Screen
        name="entrenar"
        options={{
          // RN-066: entrenamientos como serie (circuitos y sesiones).
          title: 'Entrenar',
          tabBarIcon: ({ color }) => <TabBarIcon name="heartbeat" color={color} />,
        }}
      />
      <Tabs.Screen
        name="grupos"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          // Invitaciones a grupos + solicitudes de amistad pendientes.
          tabBarBadge: pendientes > 0 ? (pendientes > 99 ? '99+' : pendientes) : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger, color: '#fff', fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="rutas"
        options={{
          title: 'Rutas',
          tabBarIcon: ({ color }) => <TabBarIcon name="map-signs" color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
