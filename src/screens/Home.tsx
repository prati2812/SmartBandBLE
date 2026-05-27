import React, { useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import AlarmCard from '../components/AlarmCard';
import ConnectionStatusCard from '../components/ConnectionStatusCard';
import GradientBackground from '../components/GradientBackground';
import { useGreeting } from '../hooks/useGreeting';
import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';
import { RootStackParamList } from '../types/navigation';
import { getBatteryTone } from '../utils/format';
import { showToast } from '../utils/toast';
import { palette, radii, shadows, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function Home({ navigation }: Props) {
  const greeting = useGreeting();
  const connectionStatus = useBLEStore(state => state.connectionStatus);
  const connectedDevice = useBLEStore(state => state.connectedDevice);
  const batteryLevel = useBLEStore(state => state.batteryLevel);
  const lastSyncedAt = useBLEStore(state => state.lastSyncedAt);
  const alarms = useBLEStore(state => state.alarms);
  const toggleAlarm = useBLEStore(state => state.toggleAlarm);

  const fabScale = useRef(new Animated.Value(1)).current;

  const isConnected =
    connectionStatus === 'connected' || connectionStatus === 'syncing';

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect wearable?',
      'The alarm dashboard will remain available, but payload sync will pause until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await bleService.disconnect();
            showToast('Wearable disconnected');
          },
        },
      ],
    );
  };

  const handleAlarmToggle = async (alarmId: string) => {
    toggleAlarm(alarmId);
    const updatedAlarm = useBLEStore
      .getState()
      .alarms.find(item => item.id === alarmId);
    if (updatedAlarm && useBLEStore.getState().connectedDevice) {
      await bleService.sendAlarmConfig(updatedAlarm);
    }
  };

  const handleSync = async () => {
    if (!connectedDevice) {
      showToast('Connect a wearable before syncing alarms');
      return;
    }
    const success = await bleService.syncEnabledAlarms(
      useBLEStore.getState().alarms,
    );
    showToast(success ? 'All alarms synced to band ✓' : 'Sync failed. Try again.');
  };

  const handleFabPress = () => {
    Animated.sequence([
      Animated.timing(fabScale, {
        toValue: 0.88,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(fabScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => navigation.navigate('AlarmSetup'));
  };

  // Battery ring helpers
  const batteryColor = getBatteryTone(batteryLevel);
  const safeLevel = batteryLevel ?? 0;
  const radius = 14;
  const circ = radius * Math.PI * 2;
  const dashOffset = circ - (safeLevel / 100) * circ;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Wearable control</Text>
            <Text style={styles.title}>{greeting.title}</Text>
          </View>
          {/* Sync icon — only visible when connected */}
          {isConnected && (
            <Pressable
              id="sync-button"
              onPress={handleSync}
              style={({ pressed }) => [
                styles.syncIconBtn,
                pressed && styles.pressed,
              ]}>
              {/* Sync arrows icon */}
              <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M1 4v6h6M23 20v-6h-6"
                  stroke={palette.cyan}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
                  stroke={palette.cyan}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.syncLabel}>Sync</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>

          {/* ── Connection hero card ── */}
          <ConnectionStatusCard
            status={connectionStatus}
            device={connectedDevice}
            lastSyncedAt={lastSyncedAt}
            onScanPress={() => navigation.navigate('Scan')}
            onDisconnect={handleDisconnect}
          />

          {/* ── Stats strip — shows only when connected ── */}
          {isConnected && (
            <View style={styles.statsStrip}>
              {/* Battery mini-ring */}
              <View style={styles.statItem}>
                <View style={styles.miniRingWrap}>
                  <Svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <Circle
                      cx="18"
                      cy="18"
                      r={radius}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="5"
                    />
                    <Circle
                      cx="18"
                      cy="18"
                      r={radius}
                      stroke={batteryColor}
                      strokeWidth="5"
                      strokeDasharray={`${circ} ${circ}`}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </Svg>
                  <Text style={[styles.miniRingLabel, { color: batteryColor }]}>
                    {batteryLevel == null ? '–' : batteryLevel}
                  </Text>
                </View>
                <View>
                  <Text style={styles.statKey}>Battery</Text>
                  <Text style={styles.statVal}>
                    {batteryLevel == null ? 'Unknown' : `${batteryLevel}%`}
                  </Text>
                </View>
              </View>

              <View style={styles.statDivider} />

              {/* Device name */}
              <View style={styles.statItem}>
                <View style={styles.deviceIcon}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                      stroke={palette.blue}
                      strokeWidth="1.8"
                    />
                    <Path
                      d="M8 12h8M12 8v8"
                      stroke={palette.blue}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
                <View style={styles.statTextBlock}>
                  <Text style={styles.statKey}>Device</Text>
                  <Text style={styles.statVal} numberOfLines={1}>
                    {connectedDevice?.name ||
                      connectedDevice?.localName ||
                      'Band'}
                  </Text>
                </View>
              </View>

              <View style={styles.statDivider} />

              {/* Last sync */}
              <View style={styles.statItem}>
                <View style={[styles.deviceIcon, { backgroundColor: 'rgba(74, 222, 128, 0.1)' }]}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 8v4l3 3"
                      stroke={palette.green}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <Circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke={palette.green}
                      strokeWidth="1.8"
                    />
                  </Svg>
                </View>
                <View style={styles.statTextBlock}>
                  <Text style={styles.statKey}>Last sync</Text>
                  <Text style={styles.statVal}>
                    {lastSyncedAt ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Alarms section ── */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>Haptic alarms</Text>
              <Text style={styles.sectionTitle}>
                {alarms.length === 0
                  ? 'No alarms yet'
                  : `${alarms.length} alarm${alarms.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
            <View style={styles.alarmCount}>
              <Text style={styles.alarmCountText}>
                {alarms.filter(a => a.enabled).length} active
              </Text>
            </View>
          </View>

          {alarms.length === 0 ? (
            <View style={styles.emptyState}>
              <Svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                  stroke={palette.textSoft}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.emptyTitle}>No haptic alarms</Text>
              <Text style={styles.emptyBody}>
                Tap the{' '}
                <Text style={{ color: palette.cyan }}>+</Text>
                {' '}button to create your first alarm and sync it to your wearable.
              </Text>
            </View>
          ) : (
            alarms.map(alarm => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onToggle={handleAlarmToggle}
                onPress={selectedAlarm =>
                  navigation.navigate('AlarmSetup', {
                    alarmId: selectedAlarm.id,
                  })
                }
              />
            ))
          )}

          {/* Bottom padding for FAB */}
          <View style={{ height: 96 }} />
        </ScrollView>

        {/* ── Floating Action Button ── */}
        <Animated.View
          style={[styles.fabWrap, { transform: [{ scale: fabScale }] }]}>
          <Pressable
            id="new-alarm-fab"
            onPress={handleFabPress}
            style={styles.fab}>
            <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 5v14M5 12h14"
                stroke={palette.bg}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  kicker: {
    color: palette.cyan,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },
  syncIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,243,255,0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(99,243,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  syncLabel: {
    color: palette.cyan,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Stats strip
  statsStrip: {
    marginTop: spacing.md,
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: spacing.sm,
  },
  miniRingWrap: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniRingLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(94,140,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextBlock: {
    flex: 1,
  },
  statKey: {
    color: palette.textSoft,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  statVal: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },

  // Section header
  sectionHeader: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '700',
  },
  alarmCount: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  alarmCountText: {
    color: palette.green,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    color: palette.textMuted,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  emptyBody: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },

  // FAB
  fabWrap: {
    position: 'absolute',
    bottom: 32,
    right: 28,
    ...shadows.glow,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.cyan,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
});
