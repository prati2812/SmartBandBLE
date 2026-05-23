import React from 'react';
import { Device } from 'react-native-ble-plx';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ConnectionStatus } from '../types/ble';
import { formatSyncTime } from '../utils/format';
import { palette, radii, shadows, spacing } from '../utils/theme';

interface ConnectionStatusCardProps {
  status: ConnectionStatus;
  device: Device | null;
  lastSyncedAt: string | null;
  onScanPress: () => void;
  onDisconnect: () => void;
}

const statusMap: Record<ConnectionStatus, { label: string; color: string }> = {
  idle: { label: 'Ready to pair', color: palette.textMuted },
  scanning: { label: 'Scanning nearby', color: palette.cyan },
  connecting: { label: 'Creating secure link', color: palette.amber },
  connected: { label: 'Band connected', color: palette.green },
  syncing: { label: 'Syncing payload', color: palette.cyan },
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
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>Smart band link</Text>
          <Text style={styles.title}>{currentStatus.label}</Text>
        </View>

        <View style={styles.orbitWrap}>
          <Svg width="70" height="70" viewBox="0 0 70 70" fill="none">
            <Circle cx="35" cy="35" r="28" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <Circle
              cx="35"
              cy="35"
              r="28"
              stroke={currentStatus.color}
              strokeWidth="6"
              strokeDasharray="118 58"
              strokeLinecap="round"
              transform="rotate(-90 35 35)"
            />
          </Svg>
          <View style={[styles.dot, { backgroundColor: currentStatus.color }]} />
        </View>
      </View>

      <Text style={styles.body}>
        {device
          ? `${device.name || device.localName || 'Smart Band'} is active and ready for BLE alarm writes.`
          : 'Scan for nearby wearables to establish a secure Bluetooth connection and unlock haptic alarm sync.'}
      </Text>

      <View style={styles.metaStrip}>
        <View>
          <Text style={styles.metaLabel}>Last activity</Text>
          <Text style={styles.metaValue}>{formatSyncTime(lastSyncedAt)}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={[styles.liveDot, { backgroundColor: currentStatus.color }]} />
          <Text style={styles.liveText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <Pressable
        onPress={isConnected ? onDisconnect : onScanPress}
        style={({ pressed }) => [
          styles.actionButton,
          isConnected ? styles.disconnectButton : styles.scanButton,
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.actionText, isConnected ? styles.disconnectText : styles.scanText]}>
          {isConnected ? 'Disconnect wearable' : 'Scan devices'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.xl,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: palette.textSoft,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '700',
    maxWidth: 220,
  },
  orbitWrap: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: palette.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  body: {
    marginTop: spacing.lg,
    color: palette.textMuted,
    lineHeight: 22,
    fontSize: 14,
  },
  metaStrip: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: palette.textSoft,
    fontSize: 11,
    marginBottom: 4,
  },
  metaValue: {
    color: palette.text,
    fontWeight: '600',
    maxWidth: 180,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  liveText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  actionButton: {
    marginTop: spacing.lg,
    minHeight: 52,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: palette.cyan,
  },
  disconnectButton: {
    backgroundColor: 'rgba(251, 113, 133, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.32)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  scanText: {
    color: palette.bg,
  },
  disconnectText: {
    color: palette.red,
  },
  pressed: {
    opacity: 0.92,
  },
});
