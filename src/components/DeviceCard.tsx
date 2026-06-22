import React from 'react';
import { Device } from 'react-native-ble-plx';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { getSignalTone } from '../utils/format';
import { palette, radii, shadows, spacing } from '../utils/theme';
import { SERVICE_UUID } from '../services/bleService';

interface DeviceCardProps {
  device: Device;
  onConnect: (device: Device) => void;
  isConnecting?: boolean;
  isConnected?: boolean;
}

// Signal bar icon — 3 bars filled to level 0/1/2/3
function SignalBars({ level, color }: { level: number; color: string }) {
  const bars = [0.4, 0.65, 1.0];
  return (
    <Svg width="16" height="14" viewBox="0 0 16 14" fill="none">
      {bars.map((h, i) => (
        <Path
          key={i}
          d={`M${i * 5 + 1} ${14 - 14 * h} L${i * 5 + 1} 14`}
          stroke={i < level ? color : 'rgba(255,255,255,0.15)'}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

function getSignalLevel(rssi: number): number {
  if (rssi >= -60) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -90) return 1;
  return 0;
}

export default function DeviceCard({
  device,
  onConnect,
  isConnecting = false,
  isConnected = false,
}: DeviceCardProps) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const signal = getSignalTone(device.rssi);
  const rssi = device.rssi ?? -99;
  const signalLevel = getSignalLevel(rssi);
  const hasMatchingService = device.serviceUUIDs?.some(
    uuid => uuid.toLowerCase() === SERVICE_UUID.toLowerCase(),
  );

  const deviceName =
    device.name || device.localName || (hasMatchingService ? 'LapidVibe Band' : 'Unknown Device');

  const isLapidVibe = hasMatchingService || deviceName.toLowerCase().includes('lapid');

  return (
    <Pressable
      onPress={() => onConnect(device)}
      disabled={isConnecting || isConnected}
      style={({ pressed }) => [
        styles.card,
        isConnected && styles.cardConnected,
        pressed && !isConnecting && !isConnected && styles.cardPressed,
      ]}>

      {/* Connected glow bar at top */}
      {isConnected && <View style={styles.connectedBar} />}

      {/* ── Top row: icon + name + status badge ── */}
      <View style={styles.topRow}>
        {/* BLE icon circle */}
        <View style={[styles.iconWrap, isConnected && styles.iconWrapConnected]}>
          <Svg width="16" height="22" viewBox="0 0 16 24" fill="none">
            <Path
              d="M3 6L11 14L8 17V3L11 6L3 18"
              stroke={isConnected ? palette.whoopGreen : palette.whoopBlue}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        {/* Name + ID */}
        <View style={styles.nameBlock}>
          <Text
            numberOfLines={1}
            style={[styles.deviceName, isSmall && styles.deviceNameSmall]}>
            {deviceName}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.deviceId, isSmall && styles.deviceIdSmall]}>
            {device.id}
          </Text>
        </View>

        {/* Status badge */}
        <View style={[
          styles.statusBadge,
          isConnected ? styles.statusConnected : styles.statusIdle,
        ]}>
          {isConnected && (
            <View style={styles.statusDot} />
          )}
          <Text style={[
            styles.statusText,
            isConnected ? styles.statusTextConnected : styles.statusTextIdle,
          ]}>
            {isConnected ? 'Active' : isLapidVibe ? 'Band' : 'BLE'}
          </Text>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Bottom row: signal + RSSI + action ── */}
      <View style={styles.bottomRow}>
        {/* Signal */}
        <View style={styles.signalBlock}>
          <SignalBars level={signalLevel} color={signal.color} />
          <View style={styles.signalText}>
            <Text style={[styles.metaLabel, isSmall && styles.metaLabelSmall]}>
              Signal
            </Text>
            <Text style={[styles.rssiValue, { color: signal.color }, isSmall && styles.rssiSmall]}>
              {rssi} dBm
            </Text>
          </View>
        </View>

        {/* Action pill */}
        <Pressable
          onPress={() => !isConnecting && !isConnected && onConnect(device)}
          style={[
            styles.actionPill,
            isConnected && styles.actionPillConnected,
            isConnecting && styles.actionPillConnecting,
          ]}>
          {isConnecting && (
            <View style={styles.actionDot} />
          )}
          <Text style={[
            styles.actionText,
            isConnected && styles.actionTextConnected,
            isConnecting && styles.actionTextConnecting,
            isSmall && styles.actionTextSmall,
          ]}>
            {isConnected ? 'Connected' : isConnecting ? 'Linking…' : 'Connect'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardConnected: {
    borderColor: 'rgba(67, 215, 131, 0.35)',
    backgroundColor: 'rgba(67, 215, 131, 0.04)',
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.988 }],
  },
  connectedBar: {
    height: 2,
    backgroundColor: palette.whoopGreen,
    borderRadius: 1,
  },

  /* Top row */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(41, 121, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(41, 121, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapConnected: {
    backgroundColor: 'rgba(67, 215, 131, 0.08)',
    borderColor: 'rgba(67, 215, 131, 0.25)',
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  deviceNameSmall: {
    fontSize: 13,
  },
  deviceId: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  deviceIdSmall: {
    fontSize: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusConnected: {
    backgroundColor: 'rgba(67, 215, 131, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(67, 215, 131, 0.30)',
  },
  statusIdle: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.whoopGreen,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusTextConnected: {
    color: palette.whoopGreen,
  },
  statusTextIdle: {
    color: palette.textSoft,
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: spacing.md,
  },

  /* Bottom row */
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  signalBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalText: {
    gap: 1,
  },
  metaLabel: {
    color: palette.textSoft,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaLabelSmall: {
    fontSize: 9,
  },
  rssiValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rssiSmall: {
    fontSize: 12,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(41, 121, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(41, 121, 255, 0.25)',
  },
  actionPillConnected: {
    backgroundColor: 'rgba(67, 215, 131, 0.08)',
    borderColor: 'rgba(67, 215, 131, 0.25)',
  },
  actionPillConnecting: {
    backgroundColor: 'rgba(255, 193, 7, 0.08)',
    borderColor: 'rgba(255, 193, 7, 0.25)',
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.amber,
  },
  actionText: {
    color: palette.whoopBlue,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  actionTextConnected: {
    color: palette.whoopGreen,
  },
  actionTextConnecting: {
    color: palette.amber,
  },
  actionTextSmall: {
    fontSize: 11,
  },
});
