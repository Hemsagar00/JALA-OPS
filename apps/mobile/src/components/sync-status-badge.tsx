import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BRAND } from '@jala-ops/constants';
import type { SyncState } from '../lib/auth-context';

interface SyncStatusBadgeProps {
  state: SyncState;
  pendingCount?: number;
  subtle?: boolean;
}

export default function SyncStatusBadge({
  state,
  pendingCount = 0,
  subtle = false,
}: SyncStatusBadgeProps) {
  const config = getBadgeConfig(state, pendingCount);

  if (subtle) {
    return (
      <View style={styles.subtleContainer}>
        <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
        <Text style={[styles.subtleText, { color: config.textColor }]}>{config.label}</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.pill, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}
    >
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      <Text style={[styles.pillText, { color: config.textColor }]}>{config.label}</Text>
    </View>
  );
}

function getBadgeConfig(state: SyncState, count: number) {
  switch (state) {
    case 'ONLINE':
      return {
        label: 'ONLINE',
        dotColor: BRAND.success,
        bgColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        textColor: '#065F46',
      };
    case 'OFFLINE':
      return {
        label: 'OFFLINE',
        dotColor: BRAND.muted,
        bgColor: '#F1F5F9',
        borderColor: '#CBD5E1',
        textColor: '#475569',
      };
    case 'SYNCING':
      return {
        label: 'SYNCING...',
        dotColor: BRAND.waterBlue,
        bgColor: '#EFF6FF',
        borderColor: '#BFDBFE',
        textColor: '#1E40AF',
      };
    case 'PENDING':
      return {
        label: count > 0 ? `PENDING (${count})` : 'PENDING SYNC',
        dotColor: BRAND.orange,
        bgColor: '#FFFBEB',
        borderColor: '#FDE68A',
        textColor: '#92400E',
      };
    case 'SYNCED':
      return {
        label: 'ALL SYNCED',
        dotColor: BRAND.success,
        bgColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        textColor: '#065F46',
      };
    case 'ERROR':
      return {
        label: 'SYNC ERROR',
        dotColor: BRAND.critical,
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
        textColor: '#991B1B',
      };
  }
}

const styles = StyleSheet.create({
  subtleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subtleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
