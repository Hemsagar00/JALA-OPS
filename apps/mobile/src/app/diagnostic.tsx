import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@jala-ops/constants';
import ServiceConnection from '../screens/service-connection';

export default function DiagnosticScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBar, { paddingTop: insets.top + 8 }]}
      >
        <Text style={styles.backBarText}>← Back to Application</Text>
      </TouchableOpacity>
      <ServiceConnection />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  backBar: {
    backgroundColor: BRAND.navy,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
