import { Stack } from 'expo-router';
import type { JSX } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
