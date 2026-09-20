import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BRAND } from '@jala-ops/constants';

export type EmptyStateType =
  | 'no-station'
  | 'no-pumps'
  | 'expired-session'
  | 'server-unavailable'
  | 'offline'
  | 'unauthorized'
  | 'empty-readings'
  | 'empty-breakdowns'
  | 'empty-tasks';

interface EmptyStateProps {
  type: EmptyStateType;
  customMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  type,
  customMessage,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const config = getEmptyConfig(type);

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrapper, { backgroundColor: config.iconBg }]}>
        <Text style={styles.iconText}>{config.icon}</Text>
      </View>
      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.description}>{customMessage ?? config.description}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity activeOpacity={0.8} onPress={onAction} style={styles.actionButton}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function getEmptyConfig(type: EmptyStateType) {
  switch (type) {
    case 'no-station':
      return {
        icon: '🏛️',
        iconBg: '#FEF3C7',
        title: 'No Station Assigned',
        description:
          'You are not assigned to any operational pumping stations. Please contact your AE/DE or system administrator.',
      };
    case 'no-pumps':
      return {
        icon: '⚙️',
        iconBg: '#F1F5F9',
        title: 'No Pumps Registered',
        description: 'No active pump units have been configured for this station yet.',
      };
    case 'expired-session':
      return {
        icon: '🔒',
        iconBg: '#FEE2E2',
        title: 'Session Expired',
        description:
          'Your 8-hour operational session has expired. Please sign in again with your credentials.',
      };
    case 'server-unavailable':
      return {
        icon: '📡',
        iconBg: '#FEE2E2',
        title: 'Server Unavailable',
        description:
          'Unable to connect to the JALA-OPS operations server. Please verify network connectivity and retry.',
      };
    case 'offline':
      return {
        icon: '📴',
        iconBg: '#F1F5F9',
        title: 'Operating Offline',
        description:
          'No internet connection detected. Offline changes will be stored locally and synced when connection resumes.',
      };
    case 'unauthorized':
      return {
        icon: '🚫',
        iconBg: '#FEE2E2',
        title: 'Access Restricted',
        description: 'You do not have administrative permission to view or manage this resource.',
      };
    case 'empty-readings':
      return {
        icon: '💧',
        iconBg: '#E0F2FE',
        title: 'Readings Up to Date',
        description:
          'No pending flow or energy meter readings. Scheduled reading logs open during normal shift handovers.',
      };
    case 'empty-breakdowns':
      return {
        icon: '✅',
        iconBg: '#DCFCE7',
        title: 'Pumps Operating Normally',
        description:
          'There are no active or pending breakdown incidents reported for this station.',
      };
    case 'empty-tasks':
      return {
        icon: '📋',
        iconBg: '#F1F5F9',
        title: 'No Pending Shift Tasks',
        description: 'All standard operating procedure checklists for your shift are completed.',
      };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
    marginVertical: 12,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: BRAND.navy,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
