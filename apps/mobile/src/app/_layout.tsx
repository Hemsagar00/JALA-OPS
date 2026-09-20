import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BRAND } from '@jala-ops/constants';
export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: BRAND.navy },
          headerTintColor: BRAND.surface,
          contentStyle: { backgroundColor: BRAND.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: BRAND.name }} />
      </Stack>
    </>
  );
}
