import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';
import type { StationReadingDetail, CreateReadingPayload } from '@jala-ops/types';
import { useSession } from '../../lib/auth-context';
import { getStoredToken, API_URL } from '../../lib/session';
import { getPendingQueue, type QueueItem } from '../../lib/offline-db';
import { processQueue } from '../../lib/sync-engine';
import EmptyState from '../../components/empty-state';

interface DisplayReading {
  id: string;
  clientUuid: string;
  stationName: string;
  pumpLabel?: string | null;
  recordedAt: string;
  flowMeter: number;
  energyMeter: number;
  inletPressure: number;
  outletPressure: number;
  tankLevelPct: number;
  residualChlorine?: number | null;
  turbidity?: number | null;
  gpsStatus: string;
  hasPhoto: boolean;
  syncState: 'SYNCED' | 'PENDING' | 'FAILED_RETRYABLE' | 'FAILED_PERMANENT';
  error?: string | null;
}

export default function ReadingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeStation, pendingCount } = useSession();

  const [filter, setFilter] = useState<'ALL' | 'SYNCED' | 'PENDING'>('ALL');
  const [readings, setReadings] = useState<DisplayReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch pending offline items from local SQLite DB
      const pendingItems: QueueItem[] = await getPendingQueue();
      const localDisplays: DisplayReading[] = pendingItems.map((item) => {
        let payload: Partial<CreateReadingPayload> = {};
        try {
          payload = JSON.parse(item.payload_json);
        } catch {
          // ignore
        }
        return {
          id: `local-${item.id}`,
          clientUuid: item.client_uuid,
          stationName: activeStation?.name ?? 'Assigned Station',
          pumpLabel: null,
          recordedAt: payload.recordedAt ?? item.created_at,
          flowMeter: payload.flowMeter ?? 0,
          energyMeter: payload.energyMeter ?? 0,
          inletPressure: payload.inletPressure ?? 0,
          outletPressure: payload.outletPressure ?? 0,
          tankLevelPct: payload.tankLevelPct ?? 0,
          residualChlorine: payload.residualChlorine ?? null,
          turbidity: payload.turbidity ?? null,
          gpsStatus: payload.gpsStatus ?? 'NOT_AVAILABLE',
          hasPhoto: Boolean(item.local_photo_uri || payload.photoKey),
          syncState:
            item.status === 'FAILED_PERMANENT'
              ? 'FAILED_PERMANENT'
              : item.status === 'FAILED_RETRYABLE'
                ? 'FAILED_RETRYABLE'
                : 'PENDING',
          error: item.last_error,
        };
      });

      // 2. Fetch synced readings from Server API if online
      let serverDisplays: DisplayReading[] = [];
      try {
        const token = await getStoredToken();
        if (token) {
          const client = createApiClient(API_URL, { token });
          const res = await client.listReadings({
            stationId: activeStation?.id,
            limit: 30,
          });

          serverDisplays = (res.readings as StationReadingDetail[]).map((r) => ({
            id: r.id,
            clientUuid: r.clientUuid,
            stationName: r.stationName ?? activeStation?.name ?? 'Assigned Station',
            pumpLabel: r.pumpCode ?? r.pumpName ?? null,
            recordedAt: r.recordedAt,
            flowMeter: r.flowMeter,
            energyMeter: r.energyMeter,
            inletPressure: r.inletPressure,
            outletPressure: r.outletPressure,
            tankLevelPct: r.tankLevelPct,
            residualChlorine: r.residualChlorine,
            turbidity: r.turbidity,
            gpsStatus: r.gpsStatus,
            hasPhoto: Boolean(r.photoKey),
            syncState: 'SYNCED',
          }));
        }
      } catch (serverErr) {
        console.warn('Could not fetch server readings (possibly offline):', serverErr);
      }

      // Filter out any local queue items that already appear in server readings by clientUuid
      const serverUuids = new Set(serverDisplays.map((s) => s.clientUuid));
      const filteredLocals = localDisplays.filter((l) => !serverUuids.has(l.clientUuid));

      // Combine local pending on top, then server readings
      const combined = [...filteredLocals, ...serverDisplays];
      setReadings(combined);
    } catch (err) {
      console.error('Error loading readings data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStation]);

  useEffect(() => {
    loadData();
  }, [loadData, pendingCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleManualSync = async () => {
    setSyncingNow(true);
    try {
      const token = await getStoredToken();
      await processQueue(token);
      await loadData();
    } finally {
      setSyncingNow(false);
    }
  };

  const filteredReadings = readings.filter((r) => {
    if (filter === 'SYNCED') return r.syncState === 'SYNCED';
    if (filter === 'PENDING') return r.syncState !== 'SYNCED';
    return true;
  });

  const pendingLocalCount = readings.filter((r) => r.syncState !== 'SYNCED').length;

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Banner */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption}>FLOW & PRESSURE MONITORING</Text>
            <Text style={styles.title}>Daily Meter Readings</Text>
            <Text style={styles.subtitle}>
              Station:{' '}
              {activeStation ? `${activeStation.name} (${activeStation.code})` : 'All Assigned'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/actions/enter-reading')}
            style={styles.newReadingBtn}
          >
            <Text style={styles.newReadingBtnText}>+ Enter Reading</Text>
          </TouchableOpacity>
        </View>

        {/* Sync Banner if pending */}
        {pendingLocalCount > 0 && (
          <View style={styles.syncPendingCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncPendingTitle}>
                {pendingLocalCount} Reading{pendingLocalCount > 1 ? 's' : ''} Queued Offline
              </Text>
              <Text style={styles.syncPendingText}>
                Stored locally in SQLite. Will sync automatically once online.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={syncingNow}
              style={styles.syncNowBtn}
            >
              {syncingNow ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.syncNowBtnText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          onPress={() => setFilter('ALL')}
          style={[styles.tabButton, filter === 'ALL' && styles.activeTabButton]}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.activeTabText]}>
            All ({readings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('SYNCED')}
          style={[styles.tabButton, filter === 'SYNCED' && styles.activeTabButton]}
        >
          <Text style={[styles.tabText, filter === 'SYNCED' && styles.activeTabText]}>
            Synced ({readings.filter((r) => r.syncState === 'SYNCED').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('PENDING')}
          style={[styles.tabButton, filter === 'PENDING' && styles.activeTabButton]}
        >
          <Text style={[styles.tabText, filter === 'PENDING' && styles.activeTabText]}>
            Offline Queue ({pendingLocalCount})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={BRAND.navy} />
          <Text style={styles.loadingText}>Loading station readings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReadings}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND.navy}
              colors={[BRAND.navy]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              type="empty-readings"
              customMessage={
                filter === 'PENDING'
                  ? 'No pending readings in the offline queue.'
                  : 'No meter readings recorded for this station yet.'
              }
              actionLabel="Enter Reading Now"
              onAction={() => router.push('/actions/enter-reading')}
            />
          }
          renderItem={({ item }) => {
            const dateStr = new Date(item.recordedAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.readingCard}>
                <View style={styles.readingHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readingDate}>{dateStr}</Text>
                    <Text style={styles.readingStation}>
                      {item.stationName}
                      {item.pumpLabel ? ` • ${item.pumpLabel}` : ' • General'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      item.syncState === 'SYNCED'
                        ? styles.syncedBadge
                        : item.syncState === 'FAILED_PERMANENT'
                          ? styles.errorBadge
                          : styles.pendingBadge,
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            item.syncState === 'SYNCED'
                              ? BRAND.success
                              : item.syncState === 'FAILED_PERMANENT'
                                ? BRAND.critical
                                : BRAND.orange,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color:
                            item.syncState === 'SYNCED'
                              ? '#065F46'
                              : item.syncState === 'FAILED_PERMANENT'
                                ? '#991B1B'
                                : '#92400E',
                        },
                      ]}
                    >
                      {item.syncState === 'SYNCED'
                        ? 'SYNCED'
                        : item.syncState === 'FAILED_PERMANENT'
                          ? 'FAILED'
                          : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Primary Metrics Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>FLOW METER</Text>
                    <Text style={styles.metricValue}>
                      {item.flowMeter.toLocaleString()} <Text style={styles.metricUnit}>m³</Text>
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>ENERGY METER</Text>
                    <Text style={styles.metricValue}>
                      {item.energyMeter.toLocaleString()} <Text style={styles.metricUnit}>kWh</Text>
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>IN / OUT PRESSURE</Text>
                    <Text style={styles.metricValue}>
                      {item.inletPressure.toFixed(1)} / {item.outletPressure.toFixed(1)}{' '}
                      <Text style={styles.metricUnit}>kg/cm²</Text>
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>TANK LEVEL</Text>
                    <Text style={styles.metricValue}>
                      {item.tankLevelPct.toFixed(1)} <Text style={styles.metricUnit}>%</Text>
                    </Text>
                  </View>
                </View>

                {/* Meta details footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>
                      {item.gpsStatus === 'CAPTURED'
                        ? '📍 GPS Captured'
                        : item.gpsStatus === 'LOW_ACCURACY'
                          ? '📍 Low GPS Accuracy'
                          : '📍 No GPS'}
                    </Text>
                  </View>

                  {item.hasPhoto && (
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeText}>📷 Photo Evidence</Text>
                    </View>
                  )}

                  {item.residualChlorine !== null && item.residualChlorine !== undefined && (
                    <View style={styles.metaBadge}>
                      <Text style={styles.metaBadgeText}>Cl₂: {item.residualChlorine} mg/L</Text>
                    </View>
                  )}
                </View>

                {item.error ? <Text style={styles.errorCaption}>Error: {item.error}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
    paddingHorizontal: 16,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: BRAND.navy,
    fontWeight: '600',
    marginTop: 10,
  },
  headerSection: {
    marginBottom: 12,
  },
  header: {
    backgroundColor: BRAND.navy,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 12,
    marginTop: 4,
  },
  newReadingBtn: {
    backgroundColor: BRAND.waterBlue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newReadingBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  syncPendingCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  syncPendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  syncPendingText: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  syncNowBtn: {
    backgroundColor: BRAND.navy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.muted,
  },
  activeTabText: {
    color: BRAND.navy,
    fontWeight: '700',
  },
  readingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  readingDate: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.navy,
  },
  readingStation: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syncedBadge: {
    backgroundColor: '#ECFDF5',
  },
  pendingBadge: {
    backgroundColor: '#FFFBEB',
  },
  errorBadge: {
    backgroundColor: '#FEF2F2',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    marginBottom: 10,
  },
  metricItem: {
    width: '50%',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.muted,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.navy,
    marginTop: 1,
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: BRAND.waterBlue,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  metaBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: BRAND.navy,
  },
  errorCaption: {
    fontSize: 10,
    color: BRAND.critical,
    marginTop: 6,
    fontWeight: '600',
  },
});
