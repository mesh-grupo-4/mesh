import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useTheme } from '@/components/MeshUI';
import { CenterViajesTabButton } from '@/components/CenterViajesTabButton';
import { MeshTabBar } from '@/components/MeshTabBar';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const theme = useTheme();
  return (
    <Tabs
      tabBar={(props) => <MeshTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // `height`/`paddingBottom` NO van acá: `MeshTabBar` los calcula sumando
        // el inset real del dispositivo (barra de navegación de Android, home
        // indicator de iOS) — un valor fijo dejaba el contenido tapado por los
        // botones del sistema en equipos con barra de navegación más alta.
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 8,
          overflow: 'visible',
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabIconDefault,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="grupos"
        options={{
          title: 'Grupos',
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Viajes',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: (props) => <CenterViajesTabButton {...props} />,
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
