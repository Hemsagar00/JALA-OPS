import React, { useState } from 'react';
import {
  ActivityIndicator,
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, assignedStations, logout, refreshSession, refreshStations } = useSession();
  const [busy, setBusy] = useState(false);

  const handleRefresh = async () => {
    setBusy(true);
    await Promise.all([refreshSession(), refreshStations()]);
    setBusy(false);
  };

  const handleLogout = async () => {
    setBusy(true);
    await logout();
    setBusy(false);
    router.replace('/');
  };

  if (!session) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.notAuthText}>No active session.</Text>
      </View>
    );
  }

  const initials = session.user.displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.content}>
        {/* Profile Header */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{session.user.displayName}</Text>
          <Text style={styles.username}>@{session.user.username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{session.user.role}</Text>
          </View>
        </View>

        {/* User Identity Details */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>OPERATOR CREDENTIALS</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{session.user.id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role Scope</Text>
            <Text style={styles.infoValue}>{session.user.role}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>District Jurisdiction</Text>
            <Text style={styles.infoValue}>Sri Sathya Sai, AP</Text>
          </View>
        </View>

        {/* Assigned Stations */}
        <View style={styles.infoCard}>
          <View style={styles.stationsCardHeader}>
            <Text style={styles.cardHeader}>ASSIGNED STATIONS ({assignedStations.length})</Text>
            <TouchableOpacity onPress={handleRefresh} disabled={busy}>
              <Text style={styles.syncLink}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {assignedStations.length > 0 ? (
            assignedStations.map((st) => (
              <View key={st.id} style={styles.stationItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stationName}>{st.name}</Text>
                  <Text style={styles.stationMeta}>
                    {st.code} • {st.locality}
                  </Text>
                </View>
                <View style={styles.assignedBadge}>
                  <Text style={styles.assignedBadgeText}>ASSIGNED</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyStationsText}>
              No operational stations assigned. Contact AE/DE for station deployment.
            </Text>
          )}
        </View>

        {/* Session & App State */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>SYSTEM ENVIRONMENT</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Application</Text>
            <Text style={styles.infoValue}>JALA-OPS Mobile v0.1.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Milestone</Text>
            <Text style={styles.infoValue}>Day 3 Mobile Shell</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Token Storage</Text>
            <Text style={styles.infoValue}>Hardware SecureStore</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Session TTL</Text>
            <Text style={styles.infoValue}>8 Hours (Cloudflare D1)</Text>
          </View>
        </View>

        {/* Diagnostic Link */}
        <TouchableOpacity
          onPress={() => router.push('/diagnostic')}
          style={styles.diagnosticButton}
        >
          <Text style={styles.diagnosticText}>Check Service Connection Diagnostic</Text>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actionsBox}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRefresh}
            disabled={busy}
            style={styles.refreshButton}
          >
            {busy ? (
              <ActivityIndicator color={BRAND.navy} size="small" />
            ) : (
              <Text style={styles.refreshButtonText}>Refresh Session Data</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={busy}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutButtonText}>Sign Out of JALA-OPS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: BRAND.background,
    paddingHorizontal: 16,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notAuthText: {
    color: BRAND.muted,
    fontSize: 16,
  },
  avatarCard: {
    backgroundColor: BRAND.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  displayName: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: '800',
  },
  username: {
    color: BRAND.muted,
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 10,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: BRAND.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: BRAND.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
  },
  stationsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeader: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  syncLink: {
    color: BRAND.waterBlue,
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    color: BRAND.muted,
    fontSize: 13,
  },
  infoValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: '600',
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stationName: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stationMeta: {
    color: BRAND.muted,
    fontSize: 12,
    marginTop: 2,
  },
  assignedBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  assignedBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyStationsText: {
    color: BRAND.muted,
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  diagnosticButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 14,
  },
  diagnosticText: {
    color: BRAND.waterBlue,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  actionsBox: {
    gap: 10,
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: BRAND.surface,
    borderWidth: 1.5,
    borderColor: BRAND.navy,
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: BRAND.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: BRAND.surface,
    borderWidth: 1.5,
    borderColor: BRAND.critical,
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: BRAND.critical,
    fontSize: 15,
    fontWeight: '700',
  },
});
