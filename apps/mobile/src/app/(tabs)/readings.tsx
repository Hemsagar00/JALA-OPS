import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BRAND } from '@jala-ops/constants';
import { useSession } from '../../lib/auth-context';
import EmptyState from '../../components/empty-state';

export default function ReadingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeStation } = useSession();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.caption}>FLOW & ENERGY METERS</Text>
        <Text style={styles.title}>Daily Readings Log</Text>
        <Text style={styles.subtitle}>
          Station: {activeStation ? `${activeStation.name} (${activeStation.code})` : 'No Station'}
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoTitle}>Scheduled Reading Windows</Text>
        <Text style={styles.infoText}>
          • Morning Shift: 08:00 AM{'\n'}• Evening Shift: 04:00 PM{'\n'}• Night Handover: 12:00 AM
        </Text>
      </View>

      <EmptyState
        type="empty-readings"
        customMessage="No pending meter readings. Scheduled reading entry opens at designated shift handovers. (Full offline entry & photo validation scheduled for Day 5)."
        actionLabel="Enter Ad-hoc Reading"
        onAction={() => router.push('/actions/enter-reading')}
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/actions/enter-reading')}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>+ Enter Flow / Energy Reading</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: BRAND.background,
    paddingHorizontal: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    backgroundColor: BRAND.navy,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  caption: {
    color: BRAND.lightBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  subtitle: {
    color: BRAND.lightBlue,
    fontSize: 13,
    marginTop: 4,
  },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  infoTitle: {
    color: BRAND.navy,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: BRAND.navy,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
