import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';
import { setStoredToken } from '../lib/session';
import type { AuthMeResponse } from '@jala-ops/types';

interface LoginScreenProps {
  onLoginSuccess: (me: AuthMeResponse, token: string) => void;
}

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessage('Please enter both your Username/Operator ID and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const client = createApiClient(baseUrl);
      const res = await client.login(trimmedUsername, password);
      if (rememberMe) {
        await setStoredToken(res.token);
      }
      client.setToken(res.token);
      const me = await client.me();
      onLoginSuccess(me, res.token);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 401) {
        setErrorMessage('Invalid username or password. Please check your credentials.');
      } else if (error.status === 403) {
        setErrorMessage(
          'Your account is currently disabled. Please contact your system administrator.',
        );
      } else {
        setErrorMessage(
          error.message || 'Unable to connect to JALA-OPS operational service. Check your network.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: BRAND.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 20, 36),
          paddingBottom: Math.max(insets.bottom + 24, 36),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            maxWidth: 440,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {/* Header & Branding */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                backgroundColor: BRAND.navy,
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 4,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                Government of Andhra Pradesh
              </Text>
            </View>
            <Text
              style={{
                color: BRAND.navy,
                fontSize: 28,
                fontWeight: '800',
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              JALA-OPS
            </Text>
            <Text
              style={{
                color: BRAND.orange,
                fontSize: 14,
                fontWeight: '700',
                letterSpacing: 0.5,
                marginTop: 2,
                textTransform: 'uppercase',
              }}
            >
              Sri Sathya Sai District
            </Text>
            <Text
              style={{
                color: BRAND.secondaryText,
                fontSize: 13,
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              Pumping & Water Operations Monitoring System
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={{
              backgroundColor: BRAND.surface,
              borderRadius: 16,
              padding: 24,
              borderWidth: 1,
              borderColor: BRAND.border,
              shadowColor: BRAND.navy,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <Text
              style={{
                color: BRAND.navy,
                fontSize: 20,
                fontWeight: '700',
                marginBottom: 20,
              }}
            >
              Sign In
            </Text>

            {/* Error banner */}
            {errorMessage && (
              <View
                accessibilityRole="alert"
                style={{
                  backgroundColor: '#FFF5F5',
                  borderLeftWidth: 4,
                  borderLeftColor: BRAND.critical,
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: BRAND.critical, fontSize: 14, lineHeight: 20 }}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Username input */}
            <View style={{ marginBottom: 16 }}>
              <Text
                nativeID="username-label"
                style={{
                  color: BRAND.navy,
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 6,
                }}
              >
                Username or Operator ID
              </Text>
              <TextInput
                accessibilityLabel="Username or Operator ID"
                accessibilityLabelledBy="username-label"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="e.g. demo.operator"
                placeholderTextColor={BRAND.muted}
                value={username}
                onChangeText={setUsername}
                style={{
                  height: 50,
                  borderWidth: 1,
                  borderColor: BRAND.border,
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  fontSize: 16,
                  color: BRAND.text,
                  backgroundColor: BRAND.surface,
                }}
              />
            </View>

            {/* Password input */}
            <View style={{ marginBottom: 20 }}>
              <Text
                nativeID="password-label"
                style={{
                  color: BRAND.navy,
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 6,
                }}
              >
                Password
              </Text>
              <TextInput
                accessibilityLabel="Password"
                accessibilityLabelledBy="password-label"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter your password"
                placeholderTextColor={BRAND.muted}
                value={password}
                onChangeText={setPassword}
                style={{
                  height: 50,
                  borderWidth: 1,
                  borderColor: BRAND.border,
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  fontSize: 16,
                  color: BRAND.text,
                  backgroundColor: BRAND.surface,
                }}
              />
            </View>

            {/* Remember Me toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setRememberMe(!rememberMe)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 24,
                minHeight: 40,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: rememberMe ? BRAND.navy : BRAND.border,
                  backgroundColor: rememberMe ? BRAND.navy : BRAND.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                {rememberMe && (
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>✓</Text>
                )}
              </View>
              <Text style={{ color: BRAND.text, fontSize: 15 }}>
                Remember session on this device
              </Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isLoading}
              onPress={handleLogin}
              style={{
                height: 52,
                backgroundColor: BRAND.navy,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 17,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                  }}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer note */}
          <Text
            style={{
              color: BRAND.muted,
              fontSize: 12,
              textAlign: 'center',
              marginTop: 24,
              lineHeight: 18,
            }}
          >
            Authorized field operations personnel only. All access is logged for audit compliance.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
