import { Stack } from 'expo-router';

export default function AmigosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f0f0f' },
        headerTintColor: '#fff',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#0f0f0f' },
      }}
    />
  );
}
