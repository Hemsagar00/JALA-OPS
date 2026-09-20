import React, { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BRAND } from '@jala-ops/constants';
import { useSession } from '../../lib/auth-context';
import LoginScreen from '../../screens/login';
import SyncStatusBadge from '../../components/sync-status-badge';
import EmptyState from '../../components/empty-state';
import type { Pump } from '@jala-ops/types';

export default function OperatorHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    session,
    authState,
    assignedStations,
    activeStation,
    setActiveStationId,
    pumps,
    pumpsLoading,
    pumpsError,
    syncState,
    pendingCount,
    login,
    refreshSession,
    refreshPumps,
  } = useSession();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshSession(), refreshPumps()]);
    setRefreshing(false);
  };

  if (authState === 'loading') {
    return (
      <View style={[styles.centeredContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BRAND.navy} />
        <Text style={styles.loadingTitle}>JALA-OPS Sri Sathya Sai</Text>
        <Text style={styles.loadingSubtitle}>Restoring secure operational session...</Text>
      </View>
    );
  }

  if (authState === 'unauthenticated' || !session) {
    return (
      <View style={{ flex: 1 }}>
        <LoginScreen
          onLoginSuccess={(me) => {
            login(me);
          }}
        />
        <TouchableOpacity onPress={() => router.push('/diagnostic')} style={styles.diagnosticLink}>
          <Text style={styles.diagnosticLinkText}>Check service connection diagnostic</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const greeting = getGreeting();
  const shiftInfo = getCurrentShift();
  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.contentWrapper}>
        {/* District & Operator Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.districtBadge}>SRI SATHYA SAI DISTRICT</Text>
              <Text style={styles.appTitle}>JALA-OPS</Text>
            </View>
            <SyncStatusBadge state={syncState} pendingCount={pendingCount} />
          </View>

          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingText}>{greeting},</Text>
              <Text style={styles.operatorName}>{session.user.displayName}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{session.user.role}</Text>
            </View>
          </View>
        </View>

        {/* Operational Shift & Station Banner */}
        <View style={styles.stationCard}>
          <View style={styles.stationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCaption}>ASSIGNED STATION</Text>
              {activeStation ? (
                <>
                  <Text style={styles.stationTitle}>{activeStation.name}</Text>
                  <Text style={styles.stationSubtitle}>
                    Code: {activeStation.code} • {activeStation.locality}
                  </Text>
                </>
              ) : (
                <Text style={styles.stationTitle}>No Station Assigned</Text>
              )}
            </View>
            {activeStation?.active ? (
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>ACTIVE</Text>
              </View>
            ) : null}
          </View>

          {/* Multiple Station Switcher */}
          {assignedStations.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.stationSwitcher}
            >
              {assignedStations.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => setActiveStationId(st.id)}
                  style={[
                    styles.stationChip,
                    activeStation?.id === st.id && styles.activeStationChip,
                  ]}
                >
                  <Text
                    style={[
                      styles.stationChipText,
                      activeStation?.id === st.id && styles.activeStationChipText,
                    ]}
                  >
                    {st.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.shiftDivider} />

          <View style={styles.shiftRow}>
            <View style={styles.shiftMetaItem}>
              <Text style={styles.shiftMetaLabel}>DATE</Text>
              <Text style={styles.shiftMetaValue}>{formattedDate}</Text>
            </View>
            <View style={styles.shiftMetaItem}>
              <Text style={styles.shiftMetaLabel}>SHIFT</Text>
              <Text style={styles.shiftMetaValue}>{shiftInfo.name}</Text>
            </View>
            <View style={styles.shiftMetaItem}>
              <Text style={styles.shiftMetaLabel}>HOURS</Text>
              <Text style={styles.shiftMetaValue}>{shiftInfo.hours}</Text>
            </View>
          </View>
        </View>

        {/* No station state */}
        {!activeStation && assignedStations.length === 0 ? (
          <EmptyState
            type="no-station"
            actionLabel="Refresh Assignments"
            onAction={refreshSession}
          />
        ) : null}

        {/* Today Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.sectionTitle}>Today's Operational Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>WATER PUMPED</Text>
              <Text style={styles.summaryValue}>0.0 kL</Text>
              <Text style={styles.summaryNote}>Log opens in Day 4</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>ACTIVE ALERTS</Text>
              <Text style={[styles.summaryValue, { color: BRAND.success }]}>0</Text>
              <Text style={styles.summaryNote}>All normal</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>LOCAL SYNC</Text>
              <Text style={styles.summaryValue}>0 Pending</Text>
              <Text style={styles.summaryNote}>Direct online</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>BREAKDOWNS</Text>
              <Text style={styles.summaryValue}>0 Open</Text>
              <Text style={styles.summaryNote}>None reported</Text>
            </View>
          </View>
        </View>

        {/* Live Pump Status Section */}
        {activeStation ? (
          <View style={styles.pumpsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Station Pumps ({pumps.length})</Text>
              <TouchableOpacity onPress={refreshPumps} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {pumpsLoading && pumps.length === 0 ? (
              <View style={styles.pumpsLoadingBox}>
                <ActivityIndicator size="small" color={BRAND.navy} />
                <Text style={styles.pumpsLoadingText}>Loading pump status...</Text>
              </View>
            ) : pumpsError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{pumpsError}</Text>
                <TouchableOpacity onPress={refreshPumps} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : pumps.length === 0 ? (
              <EmptyState type="no-pumps" actionLabel="Refresh Pumps" onAction={refreshPumps} />
            ) : (
              <View style={styles.pumpsList}>
                {pumps.map((pump) => (
                  <PumpStatusCard key={pump.id} pump={pump} />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Main Action Grid */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Field Operations</Text>
          <View style={styles.actionGrid}>
            <ActionCard
              title="START PUMP"
              icon="▶"
              accentColor={BRAND.success}
              onPress={() => router.push('/actions/start-pump')}
            />
            <ActionCard
              title="STOP PUMP"
              icon="⏹"
              accentColor={BRAND.critical}
              onPress={() => router.push('/actions/stop-pump')}
            />
            <ActionCard
              title="ENTER READING"
              icon="💧"
              accentColor={BRAND.waterBlue}
              onPress={() => router.push('/(tabs)/readings')}
            />
            <ActionCard
              title="REPORT BREAKDOWN"
              icon="⚠️"
              accentColor={BRAND.orange}
              onPress={() => router.push('/(tabs)/breakdowns')}
            />
            <ActionCard
              title="MAINTENANCE"
              icon="🔧"
              accentColor={BRAND.navy}
              onPress={() => router.push('/actions/maintenance')}
            />
            <ActionCard
              title="ATTENDANCE"
              icon="📋"
              accentColor={BRAND.secondaryText}
              onPress={() => router.push('/actions/attendance')}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function PumpStatusCard({ pump }: { pump: Pump }) {
  const statusConfig = getPumpStatusConfig(pump.status);

  return (
    <View style={styles.pumpCard}>
      <View style={styles.pumpHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pumpCode}>{pump.code}</Text>
          <Text style={styles.pumpName}>{pump.name}</Text>
        </View>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
          <Text style={[styles.statusText, { color: statusConfig.text }]}>{pump.status}</Text>
        </View>
      </View>

      <View style={styles.pumpMetaRow}>
        <View style={styles.pumpMetaItem}>
          <Text style={styles.pumpMetaLabel}>POWER</Text>
          <Text style={styles.pumpMetaValue}>{pump.ratedPowerKw} kW</Text>
        </View>
        <View style={styles.pumpMetaItem}>
          <Text style={styles.pumpMetaLabel}>CAPACITY</Text>
          <Text style={styles.pumpMetaValue}>{pump.capacityM3H} m³/h</Text>
        </View>
        <View style={styles.pumpMetaItem}>
          <Text style={styles.pumpMetaLabel}>STATUS</Text>
          <Text style={styles.pumpMetaValue}>{pump.status}</Text>
        </View>
      </View>
    </View>
  );
}

function ActionCard({
  title,
  icon,
  accentColor,
  onPress,
}: {
  title: string;
  icon: string;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.actionCard, { borderLeftColor: accentColor, borderLeftWidth: 4 }]}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning (Namaskaram)';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getCurrentShift(): { name: string; hours: string } {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) {
    return { name: 'Morning Shift', hours: '06:00 – 14:00' };
  }
  if (hour >= 14 && hour < 22) {
    return { name: 'Evening Shift', hours: '14:00 – 22:00' };
  }
  return { name: 'Night Shift', hours: '22:00 – 06:00' };
}

function getPumpStatusConfig(status: string) {
  switch (status) {
    case 'RUNNING':
      return {
        dot: BRAND.success,
        bg: '#ECFDF5',
        border: '#A7F3D0',
        text: '#065F46',
      };
    case 'STOPPED':
      return {
        dot: BRAND.muted,
        bg: '#F1F5F9',
        border: '#CBD5E1',
        text: '#475569',
      };
    case 'BREAKDOWN':
      return {
        dot: BRAND.critical,
        bg: '#FEF2F2',
        border: '#FECACA',
        text: '#991B1B',
      };
    case 'MAINTENANCE':
      return {
        dot: BRAND.orange,
        bg: '#FFFBEB',
        border: '#FDE68A',
        text: '#92400E',
      };
    default:
      return {
        dot: BRAND.muted,
        bg: '#F8FAFC',
        border: '#E2E8F0',
        text: BRAND.text,
      };
  }
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.background,
    padding: 24,
  },
  loadingTitle: {
    color: BRAND.navy,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  loadingSubtitle: {
    color: BRAND.muted,
    fontSize: 13,
    marginTop: 4,
  },
  diagnosticLink: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: BRAND.background,
  },
  diagnosticLinkText: {
    color: BRAND.waterBlue,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BRAND.background,
    paddingHorizontal: 16,
  },
  contentWrapper: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerCard: {
    backgroundColor: BRAND.navy,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  districtBadge: {
    color: BRAND.lightBlue,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12,
  },
  greetingText: {
    color: BRAND.lightBlue,
    fontSize: 12,
    fontWeight: '600',
  },
  operatorName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stationCard: {
    backgroundColor: BRAND.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionCaption: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  stationTitle: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  stationSubtitle: {
    color: BRAND.muted,
    fontSize: 12,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.success,
  },
  activeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
  },
  stationSwitcher: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
  },
  stationChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  activeStationChip: {
    backgroundColor: BRAND.navy,
  },
  stationChipText: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: '600',
  },
  activeStationChipText: {
    color: '#FFFFFF',
  },
  shiftDivider: {
    height: 1,
    backgroundColor: BRAND.border,
    marginVertical: 12,
  },
  shiftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shiftMetaItem: {
    flex: 1,
  },
  shiftMetaLabel: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  shiftMetaValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: BRAND.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.navy,
    marginVertical: 4,
  },
  summaryNote: {
    fontSize: 11,
    color: BRAND.muted,
  },
  pumpsSection: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  refreshButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshButtonText: {
    color: BRAND.waterBlue,
    fontSize: 13,
    fontWeight: '600',
  },
  pumpsLoadingBox: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    gap: 8,
  },
  pumpsLoadingText: {
    fontSize: 13,
    color: BRAND.muted,
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: BRAND.critical,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  pumpsList: {
    gap: 8,
  },
  pumpCard: {
    backgroundColor: BRAND.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  pumpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pumpCode: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.navy,
  },
  pumpName: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pumpMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 8,
    marginTop: 10,
  },
  pumpMetaItem: {
    flex: 1,
  },
  pumpMetaLabel: {
    fontSize: 9,
    color: BRAND.muted,
    fontWeight: '700',
  },
  pumpMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.text,
    marginTop: 1,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    minWidth: '47%',
    height: 68,
    backgroundColor: BRAND.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.navy,
    flex: 1,
  },
});
