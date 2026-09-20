import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@jala-ops/constants';
import { useSession } from '../../lib/auth-context';

export default function ActionPlaceholderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { action } = useLocalSearchParams<{ action: string }>();
  const { activeStation, session } = useSession();

  const formattedAction = (action ?? 'action')
    .split('-')
    .map((w) => w.toUpperCase())
    .join(' ');

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SCHEDULED MILESTONE</Text>
        </View>

        <Text style={styles.actionTitle}>{formattedAction}</Text>
        <Text style={styles.stationSubtitle}>
          Station: {activeStation ? `${activeStation.name} (${activeStation.code})` : 'General'}
        </Text>
        <Text style={styles.operatorSubtitle}>
          Operator: {session?.user.displayName ?? 'Field Officer'}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.bodyText}>
          This operational workflow is scheduled in the 10-day MVP sequence:
        </Text>

        <View style={styles.roadmapBox}>
          <Text style={styles.roadmapItem}>
            • <Text style={{ fontWeight: '700' }}>Day 4 — Pump Operations:</Text> Start/Stop SOP
            checklist, interlock checks, runtime & energy tracking.
          </Text>
          <Text style={styles.roadmapItem}>
            • <Text style={{ fontWeight: '700' }}>Day 5 — Readings:</Text> Flow & energy meter
            entry, photo verification, offline sync queue.
          </Text>
          <Text style={styles.roadmapItem}>
            • <Text style={{ fontWeight: '700' }}>Day 6 — Breakdowns:</Text> Defect ticketing,
            technician assignment, repair timeline.
          </Text>
        </View>

        <Text style={styles.principleNote}>
          Per JALA-OPS engineering rules, unfinished flows do not create fake success states or mock
          data.
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Return to Application</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: BRAND.background,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    maxWidth: 500,
    width: '100%',
    backgroundColor: BRAND.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.navy,
    textAlign: 'center',
  },
  stationSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.text,
    marginTop: 6,
    textAlign: 'center',
  },
  operatorSubtitle: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: BRAND.border,
    width: '100%',
    marginVertical: 18,
  },
  bodyText: {
    fontSize: 14,
    color: BRAND.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  roadmapBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    width: '100%',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  roadmapItem: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  principleNote: {
    fontSize: 12,
    color: BRAND.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: BRAND.navy,
    width: '100%',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
