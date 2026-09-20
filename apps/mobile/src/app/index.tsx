import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';
import { getStoredToken, clearStoredToken } from '../lib/session';
import LoginScreen from '../screens/login';
import ServiceConnection from '../screens/service-connection';
import type { AuthMeResponse } from '@jala-ops/types';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export default function MobileAppRoot() {
  const insets = useSafeAreaInsets();
  const [authState, setAuthState] = useState<'checking' | 'unauthenticated' | 'authenticated'>(
    'checking',
  );
  const [session, setSession] = useState<AuthMeResponse | null>(null);
  const [showConnectionDiagnostic, setShowConnectionDiagnostic] = useState(false);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const token = await getStoredToken();
        if (!token) {
          if (active) setAuthState('unauthenticated');
          return;
        }
        const client = createApiClient(baseUrl, { token });
        const me = await client.me();
        if (active) {
          setSession(me);
          setAuthState('authenticated');
        }
      } catch {
        await clearStoredToken();
        if (active) setAuthState('unauthenticated');
      }
    }
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    try {
      const token = await getStoredToken();
      if (token) {
        const client = createApiClient(baseUrl, { token });
        await client.logout();
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearStoredToken();
      setSession(null);
      setAuthState('unauthenticated');
    }
  }

  if (authState === 'checking') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: BRAND.background,
        }}
      >
        <ActivityIndicator size="large" color={BRAND.navy} />
        <Text style={{ color: BRAND.navy, marginTop: 16, fontSize: 16, fontWeight: '600' }}>
          JALA-OPS Sri Sathya Sai
        </Text>
      </View>
    );
  }

  if (showConnectionDiagnostic) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          onPress={() => setShowConnectionDiagnostic(false)}
          style={{
            paddingTop: insets.top + 10,
            paddingHorizontal: 20,
            paddingBottom: 10,
            backgroundColor: BRAND.navy,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>← Back to Application</Text>
        </TouchableOpacity>
        <ServiceConnection />
      </View>
    );
  }

  if (authState === 'unauthenticated' || !session) {
    return (
      <View style={{ flex: 1 }}>
        <LoginScreen
          onLoginSuccess={(me) => {
            setSession(me);
            setAuthState('authenticated');
          }}
        />
        <TouchableOpacity
          onPress={() => setShowConnectionDiagnostic(true)}
          style={{
            alignItems: 'center',
            paddingVertical: 12,
            backgroundColor: BRAND.background,
          }}
        >
          <Text style={{ color: BRAND.waterBlue, fontSize: 13, textDecorationLine: 'underline' }}>
            Check service connection diagnostic
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Authenticated state
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
        backgroundColor: BRAND.background,
      }}
    >
      <View style={{ maxWidth: 500, width: '100%', alignSelf: 'center' }}>
        {/* District Banner */}
        <View
          style={{
            backgroundColor: BRAND.navy,
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
            SRI SATHYA SAI DISTRICT
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 4 }}>
            JALA-OPS
          </Text>
          <Text style={{ color: BRAND.lightBlue, fontSize: 14, marginTop: 4 }}>
            Authenticated Session Active
          </Text>
        </View>

        {/* User Card */}
        <View
          style={{
            backgroundColor: BRAND.surface,
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: BRAND.border,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: BRAND.muted,
              fontSize: 13,
              fontWeight: '600',
              textTransform: 'uppercase',
            }}
          >
            Operator Identity
          </Text>
          <Text style={{ color: BRAND.text, fontSize: 20, fontWeight: '700', marginTop: 4 }}>
            {session.user.displayName}
          </Text>
          <Text style={{ color: BRAND.muted, fontSize: 14 }}>@{session.user.username}</Text>

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <View
              style={{
                backgroundColor: BRAND.lightBlue,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: BRAND.navy, fontSize: 13, fontWeight: '700' }}>
                Role: {session.user.role}
              </Text>
            </View>
          </View>
        </View>

        {/* Assigned Stations Card */}
        <View
          style={{
            backgroundColor: BRAND.surface,
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: BRAND.border,
            marginBottom: 28,
          }}
        >
          <Text
            style={{
              color: BRAND.muted,
              fontSize: 13,
              fontWeight: '600',
              textTransform: 'uppercase',
            }}
          >
            Assigned Stations ({session.assignedStations.length})
          </Text>
          {session.assignedStations.length > 0 ? (
            session.assignedStations.map((stationId) => (
              <View
                key={stationId}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: BRAND.border,
                }}
              >
                <Text style={{ color: BRAND.text, fontSize: 15, fontWeight: '600' }}>
                  ✓ {stationId}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: BRAND.muted, fontStyle: 'italic', marginTop: 8 }}>
              No stations currently assigned. Contact your administrator.
            </Text>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleLogout}
          style={{
            height: 50,
            backgroundColor: BRAND.surface,
            borderWidth: 1.5,
            borderColor: BRAND.critical,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: BRAND.critical, fontSize: 16, fontWeight: '700' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
