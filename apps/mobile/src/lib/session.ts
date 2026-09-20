import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'jala_ops_mobile_session_token';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

let memoryToken: string | null = null;

export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(SESSION_TOKEN_KEY);
      }
      return memoryToken;
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
      } else {
        memoryToken = token;
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
      } else {
        memoryToken = null;
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
