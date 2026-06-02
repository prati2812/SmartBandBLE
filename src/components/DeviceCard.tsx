import React from 'react';
import { Device } from 'react-native-ble-plx';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getSignalTone } from '../utils/format';
import { palette, radii, shadows, spacing } from '../utils/theme';
import { SERVICE_UUID } from '../services/bleService';

interface DeviceCardProps {
  device: Device;
  onConnect: (device: Device) => void;
  isConnecting?: boolean;
  isConnected?: boolean;
}

export default function DeviceCard({
  device,
  onConnect,
  isConnecting = false,
  isConnected = false,
}: DeviceCardProps) {
  const signal = getSignalTone(device.rssi);
  const rssi = device.rssi ?? -99;
  const hasMatchingService = device.serviceUUIDs?.some(
    (uuid) => uuid.toLowerCase() === SERVICE_UUID.toLowerCase(),
  );

  return (
    <Pressable
      onPress={() => onConnect(device)}
      disabled={isConnecting || isConnected}
      style={({ pressed }) => [
        styles.card,
        pressed && !isConnecting && !isConnected && styles.cardPressed,
      ]}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Svg width="18" height="24" viewBox="0 0 20 28" fill="none">
            <Path
              d="M4 6L14 14L10 18V2L14 6L4 18"
              stroke={palette.cyan}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={styles.deviceName}>
            {device.name || device.localName || (hasMatchingService ? 'LapidVibe Band' : 'Unnamed wearable')}
          </Text>
          <Text numberOfLines={1} style={styles.deviceId}>
            {device.id}
          </Text>
        </View>

        <View style={[styles.badge, isConnected ? styles.connectedBadge : styles.signalBadge]}>
          <Text style={[styles.badgeText, { color: isConnected ? palette.bg : signal.color }]}>
            {isConnected ? 'Linked' : signal.label}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.metaLabel}>Signal strength</Text>
          <Text style={[styles.signalValue, { color: signal.color }]}>{rssi} dBm</Text>
        </View>

        <View style={styles.actionPill}>
          <Text style={styles.actionText}>
            {isConnected ? 'Connected' : isConnecting ? 'Connecting…' : 'Tap to connect'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 119, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  titleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  deviceName: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  deviceId: {
    color: palette.textMuted,
    fontSize: 12,
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  signalBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  connectedBadge: {
    backgroundColor: palette.cyan,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: palette.textSoft,
    fontSize: 11,
    marginBottom: 4,
  },
  signalValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 119, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  actionText: {
    color: palette.cyan,
    fontWeight: '700',
    fontSize: 12,
  },
});
