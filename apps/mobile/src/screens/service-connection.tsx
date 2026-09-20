import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host, Button } from '@expo/ui';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';

const baseUrl = process.env.EXPO_PUBLIC_API_URL;
export default function ServiceConnection() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(baseUrl ? 'loading' : 'error');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!baseUrl) return;
    let active = true;
    createApiClient(baseUrl)
      .health()
      .then(() => {
        if (active) setState('ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, paddingBottom: Math.max(24, insets.bottom), gap: 24 }}
    >
      <Text style={{ color: BRAND.secondaryText, fontSize: 16 }}>{BRAND.district}</Text>
      <View style={{ height: 4, width: 48, backgroundColor: BRAND.orange }} />
      <Text
        accessibilityRole="header"
        style={{ color: BRAND.text, fontSize: 30, lineHeight: 38, fontWeight: '700' }}
      >
        Pumping & water operations
      </Text>
      <Text style={{ color: BRAND.secondaryText, fontSize: 18, lineHeight: 28 }}>
        One shared service for your station and district teams.
      </Text>
      <View
        style={{
          backgroundColor: BRAND.surface,
          borderColor: '#CBD5E1',
          borderWidth: 1,
          borderRadius: 12,
          padding: 20,
          gap: 16,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: BRAND.text, fontSize: 22, fontWeight: '700' }}
        >
          Service connection
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: BRAND.navy, fontSize: 18, lineHeight: 28, fontWeight: '600' }}
        >
          {state === 'ready'
            ? '✓ Connected to JALA-OPS'
            : state === 'loading'
              ? '◷ Checking connection…'
              : '! Unable to connect'}
        </Text>
        <Text style={{ color: BRAND.secondaryText, fontSize: 17, lineHeight: 26 }}>
          {state === 'error'
            ? 'Check your connection. If this continues, contact your system administrator.'
            : 'Your station and district dashboard use the same operational service.'}
        </Text>
        {state !== 'loading' && baseUrl && (
          <Host matchContents>
            <Button
              label="Check connection"
              style={{ height: 48, backgroundColor: BRAND.navy }}
              onPress={() => {
                setState('loading');
                setAttempt((value) => value + 1);
              }}
            />
          </Host>
        )}
      </View>
    </ScrollView>
  );
}
