import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'jala_ops_mobile_session_token';

export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(SESSION_TOKEN_KEY);
      }
      return null;
    }
    const isAvailable = await SecureStore.isAvailableAsync();
    if (!isAvailable) return null;
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      }
      return;
    }
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    }
  } catch {
    // Ignore storage failure
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      }
      return;
    }
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage failure
  }
}
