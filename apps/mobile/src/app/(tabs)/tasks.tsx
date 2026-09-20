import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BRAND } from '@jala-ops/constants';
import { useSession } from '../../lib/auth-context';
import EmptyState from '../../components/empty-state';

export default function TasksScreen() {
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
        <Text style={styles.caption}>OPERATING PROCEDURES</Text>
        <Text style={styles.title}>Daily Shift Tasks</Text>
        <Text style={styles.subtitle}>
          Station: {activeStation ? `${activeStation.name} (${activeStation.code})` : 'No Station'}
        </Text>
      </View>

      <View style={styles.sopCard}>
        <Text style={styles.sopTitle}>Mandatory Standard Operating Checklist</Text>
        <Text style={styles.sopItem}>✓ Suction sump water level check</Text>
        <Text style={styles.sopItem}>✓ Delivery manifold valve inspection</Text>
        <Text style={styles.sopItem}>✓ Gland packing leakage rate verification</Text>
        <Text style={styles.sopItem}>✓ Motor earthing and bearing temperature check</Text>
      </View>

      <EmptyState
        type="empty-tasks"
        customMessage="Shift tasks for the current duty cycle are recorded. (Step-by-step SOP checklists with photo verification scheduled for Day 4)."
        actionLabel="Review Start/Stop SOPs"
        onAction={() => router.push('/actions/start-pump')}
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/actions/maintenance')}
        style={styles.actionButton}
      >
        <Text style={styles.actionButtonText}>View Station Maintenance Schedule</Text>
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
  sopCard: {
    backgroundColor: BRAND.surface,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sopTitle: {
    color: BRAND.navy,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  sopItem: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: BRAND.navy,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
