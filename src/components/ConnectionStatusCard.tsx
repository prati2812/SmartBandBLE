import React from 'react';
import { Device } from 'react-native-ble-plx';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConnectionStatus } from '../types/ble';
import { formatSyncTime } from '../utils/format';
import { palette, radii, spacing } from '../utils/theme';

interface ConnectionStatusCardProps {
  status: ConnectionStatus;
  device: Device | null;
  lastSyncedAt: string | null;
  onScanPress: () => void;
  onDisconnect: () => void;
}

const statusMap: Record<ConnectionStatus, { label: string; color: string }> = {
  idle: { label: 'Disconnected', color: palette.textMuted },
  scanning: { label: 'Scanning...', color: palette.cyan },
  connecting: { label: 'Connecting...', color: palette.amber },
  connected: { label: 'Connected', color: palette.whoopGreen },
  syncing: { label: 'Syncing...', color: palette.whoopBlue },
};

export default function ConnectionStatusCard({
  status,
  device,
  lastSyncedAt,
  onScanPress,
  onDisconnect,
}: ConnectionStatusCardProps) {
  const currentStatus = statusMap[status];
  const isConnected = status === 'connected' || status === 'syncing';

  return (
    <View style={styles.container}>
      <View style={styles.infoCol}>
        <View style={styles.statusRow}>
          <View style={[styles.indicator, { backgroundColor: currentStatus.color }]} />
          <Text style={styles.statusLabel}>{currentStatus.label}</Text>
        </View>
        <Text style={styles.deviceLabel}>
          {device ? (device.name || device.localName || 'Smart Band') : 'No wearable linked'}
        </Text>
      </View>

      {lastSyncedAt && (
        <View style={styles.syncCol}>
          <Text style={styles.syncLabel}>Last Sync</Text>
          <Text style={styles.syncValue} numberOfLines={1}>{formatSyncTime(lastSyncedAt)}</Text>
        </View>
      )}

      <Pressable
        onPress={isConnected ? onDisconnect : onScanPress}
        style={({ pressed }) => [
          styles.actionBtn,
          isConnected ? styles.disconnectBtn : styles.connectBtn,
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.actionText, isConnected ? styles.disconnectText : styles.connectText]}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  infoCol: {
    flex: 1.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  deviceLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  syncCol: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: palette.border,
    borderRightWidth: 1,
    borderRightColor: palette.border,
    paddingHorizontal: spacing.xs,
    marginHorizontal: spacing.xs,
  },
  syncLabel: {
    color: palette.textSoft,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  syncValue: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '500',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  connectBtn: {
    backgroundColor: palette.cyan,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(255, 23, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 23, 68, 0.3)',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectText: {
    color: palette.bg,
  },
  disconnectText: {
    color: palette.whoopRed,
  },
  pressed: {
    opacity: 0.75,
  },
});

