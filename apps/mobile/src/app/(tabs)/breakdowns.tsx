import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BRAND } from '@jala-ops/constants';
import { useSession } from '../../lib/auth-context';
import EmptyState from '../../components/empty-state';

export default function BreakdownsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeStation, pumps } = useSession();

  const breakdownPumps = pumps.filter((p) => p.status === 'BREAKDOWN');

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.caption}>INCIDENT MANAGEMENT</Text>
        <Text style={styles.title}>Station Breakdowns</Text>
        <Text style={styles.subtitle}>
          Station: {activeStation ? `${activeStation.name} (${activeStation.code})` : 'No Station'}
        </Text>
      </View>

      {breakdownPumps.length > 0 ? (
        <View style={styles.activeBreakdownsBox}>
          <Text style={styles.activeBreakdownsTitle}>
            Active Breakdown Units ({breakdownPumps.length})
          </Text>
          {breakdownPumps.map((pump) => (
            <View key={pump.id} style={styles.breakdownItem}>
              <Text style={styles.breakdownItemCode}>
                {pump.code} — {pump.name}
              </Text>
              <Text style={styles.breakdownItemStatus}>Status: {pump.status}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          type="empty-breakdowns"
          customMessage="All pumps are operational. No open breakdown incidents reported. (Full ticket workflow, repair evidence, and downtime tracking scheduled for Day 6)."
          actionLabel="Report New Incident"
          onAction={() => router.push('/actions/report-breakdown')}
        />
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/actions/report-breakdown')}
        style={styles.alertButton}
      >
        <Text style={styles.alertButtonText}>⚠️ Report Breakdown / Defect</Text>
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
  activeBreakdownsBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  activeBreakdownsTitle: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  breakdownItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  breakdownItemCode: {
    color: '#7F1D1D',
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownItemStatus: {
    color: '#B91C1C',
    fontSize: 12,
  },
  alertButton: {
    backgroundColor: BRAND.critical,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
