import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BRAND } from '@jala-ops/constants';
import { SessionProvider } from '../lib/auth-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: BRAND.navy },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: BRAND.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="actions/start-pump"
            options={{
              title: 'Start Pump Procedure',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="actions/stop-pump"
            options={{
              title: 'Stop Pump Procedure',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="actions/enter-reading"
            options={{
              title: 'Record Meter Reading',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="actions/[action]"
            options={{
              title: 'Operational Workflow',
              presentation: 'modal',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="diagnostic"
            options={{
              title: 'Service Connection Diagnostic',
              headerBackTitle: 'Home',
            }}
          />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
