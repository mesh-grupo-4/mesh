import { Redirect } from 'expo-router';

export default function AmigosRedirect() {
  return <Redirect href="/(tabs)/grupos?tab=amigos" />;
}
