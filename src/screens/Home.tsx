import React, { useEffect, useRef, useState } from 'react';
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
import { showToast } from '../utils/toast';
import { palette, radii, shadows, spacing } from '../utils/theme';
import { formatTime12Hour } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type TabType = 'recovery' | 'sleep' | 'strain';

export default function Home({ navigation }: Props) {
  const greeting = useGreeting();
  const connectionStatus = useBLEStore(state => state.connectionStatus);
  const connectedDevice = useBLEStore(state => state.connectedDevice);
  const batteryLevel = useBLEStore(state => state.batteryLevel);
  const lastSyncedAt = useBLEStore(state => state.lastSyncedAt);
  const alarms = useBLEStore(state => state.alarms);
  const toggleAlarm = useBLEStore(state => state.toggleAlarm);

  const [selectedTab, setSelectedTab] = useState<TabType>('recovery');
  const [animatedVal, setAnimatedVal] = useState(0);

  const fabScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const isConnected =
    connectionStatus === 'connected' || connectionStatus === 'syncing';

  // Compute targets for Whoop Metrics
  const targetPct =
    selectedTab === 'recovery' ? 78 : selectedTab === 'sleep' ? 88 : 59; // 59% represents 12.4 out of 21 Day Strain

  // Handle active value animation
  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setAnimatedVal(value);
    });
    
    Animated.timing(progressAnim, {
      toValue: targetPct,
      duration: 600,
      useNativeDriver: false,
    }).start();

    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, [selectedTab, targetPct, progressAnim]);

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

  const cycleTab = () => {
    if (selectedTab === 'recovery') {
      setSelectedTab('sleep');
    } else if (selectedTab === 'sleep') {
      setSelectedTab('strain');
    } else {
      setSelectedTab('recovery');
    }
  };

  // Find next alarm
  const nextAlarm = alarms
    .filter(a => a.enabled)
    .sort((a, b) => a.time.localeCompare(b.time))[0];
  const nextAlarmTime = nextAlarm ? formatTime12Hour(nextAlarm.time) : 'None';

  // Metric details
  const metricDetails = {
    recovery: {
      color: palette.whoopGreen,
      glowStyle: shadows.glowWhoopGreen,
      value: '78%',
      subtitle: 'RECOVERY',
      stateText: 'HIGH',
      textColor: palette.whoopGreen,
    },
    sleep: {
      color: palette.whoopBlue,
      glowStyle: shadows.glowWhoopBlue,
      value: '88%',
      subtitle: 'SLEEP PERFORMANCE',
      stateText: 'OPTIMAL',
      textColor: palette.whoopBlue,
    },
    strain: {
      color: palette.whoopYellow,
      glowStyle: shadows.glowWhoopYellow,
      value: '12.4',
      subtitle: 'DAY STRAIN',
      stateText: 'MODERATE',
      textColor: palette.whoopYellow,
    },
  }[selectedTab];

  // Circle SVG Constants
  const radius = 80;
  const strokeWidth = 10;
  const circ = 2 * Math.PI * radius; // ~502.65
  const strokeDashoffset = circ - (animatedVal / 100) * circ;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Smart Coach</Text>
            <Text style={styles.title}>{greeting.title.split(',')[0] || 'Hello'}</Text>
          </View>
          {isConnected && (
            <Pressable
              id="sync-button"
              onPress={handleSync}
              style={({ pressed }) => [
                styles.syncIconBtn,
                pressed && styles.pressed,
              ]}>
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M1 4v6h6M23 20v-6h-6"
                  stroke={palette.whoopBlue}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
                  stroke={palette.whoopBlue}
                  strokeWidth="2.2"
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

          {/* ── Whoop Interactive Selector ── */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setSelectedTab('recovery')}
              style={[
                styles.tabBtn,
                selectedTab === 'recovery' && styles.tabBtnActiveRecovery,
              ]}>
              <Text
                style={[
                  styles.tabText,
                  selectedTab === 'recovery'
                    ? styles.tabTextActiveRecovery
                    : styles.tabTextInactive,
                ]}>
                Recovery
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedTab('sleep')}
              style={[
                styles.tabBtn,
                selectedTab === 'sleep' && styles.tabBtnActiveSleep,
              ]}>
              <Text
                style={[
                  styles.tabText,
                  selectedTab === 'sleep'
                    ? styles.tabTextActiveSleep
                    : styles.tabTextInactive,
                ]}>
                Sleep
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedTab('strain')}
              style={[
                styles.tabBtn,
                selectedTab === 'strain' && styles.tabBtnActiveStrain,
              ]}>
              <Text
                style={[
                  styles.tabText,
                  selectedTab === 'strain'
                    ? styles.tabTextActiveStrain
                    : styles.tabTextInactive,
                ]}>
                Strain
              </Text>
            </Pressable>
          </View>

          {/* ── Circular Progress Ring ── */}
          <View style={styles.dialContainer}>
            <Pressable onPress={cycleTab} style={[styles.dialGlowWrapper, metricDetails.glowStyle]}>
              <Svg width="200" height="200" viewBox="0 0 200 200">
                {/* Track Circle */}
                <Circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                {/* Progress Circle */}
                <Circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke={metricDetails.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circ} ${circ}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 100 100)"
                />
              </Svg>
              {/* Inner Information Panel */}
              <View style={styles.dialInner}>
                <Text style={styles.dialSub}>{metricDetails.subtitle}</Text>
                <Text style={styles.dialVal}>{metricDetails.value}</Text>
                <Text style={[styles.dialState, { color: metricDetails.textColor }]}>
                  {metricDetails.stateText}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* ── Telemetry Grid ── */}
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              {/* Card 1: HRV & RHR */}
              <View style={styles.telemetryCard}>
                <Text style={styles.cardHeader}>HRV & RHR</Text>
                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardValText}>
                      72<Text style={styles.cardUnit}> ms</Text>
                    </Text>
                    <Text style={styles.cardLabel}>HRV</Text>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardCol}>
                    <Text style={styles.cardValText}>
                      54<Text style={styles.cardUnit}> bpm</Text>
                    </Text>
                    <Text style={styles.cardLabel}>Resting HR</Text>
                  </View>
                </View>
              </View>

              {/* Card 2: Sleep Tracker */}
              <View style={styles.telemetryCard}>
                <Text style={styles.cardHeader}>SLEEP ANALYSIS</Text>
                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardValText}>
                      7.5<Text style={styles.cardUnit}> h</Text>
                    </Text>
                    <Text style={styles.cardLabel}>Achieved</Text>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardCol}>
                    <Text style={styles.cardValText}>
                      8.2<Text style={styles.cardUnit}> h</Text>
                    </Text>
                    <Text style={styles.cardLabel}>Target</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.gridRow}>
              {/* Card 3: Band Connection & Battery */}
              <View style={styles.telemetryCard}>
                <Text style={styles.cardHeader}>DEVICE STATUS</Text>
                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardValText}>
                      {batteryLevel !== null ? `${batteryLevel}%` : '—'}
                    </Text>
                    <Text style={styles.cardLabel}>Battery</Text>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.cardCol}>
                    <View style={styles.liveStatusRow}>
                      <View
                        style={[
                          styles.liveIndicatorDot,
                          {
                            backgroundColor: isConnected
                              ? palette.whoopGreen
                              : palette.textSoft,
                          },
                        ]}
                      />
                      <Text style={styles.cardValTextLive}>
                        {isConnected ? 'LIVE' : 'LINK'}
                      </Text>
                    </View>
                    <Text style={styles.cardLabel}>Connection</Text>
                  </View>
                </View>
              </View>

              {/* Card 4: Next Wake-up Alarm */}
              <View style={styles.telemetryCard}>
                <Text style={styles.cardHeader}>NEXT WAKE-UP</Text>
                <View style={styles.cardSingleCol}>
                  <Text style={styles.cardValTextAlarm} numberOfLines={1}>
                    {nextAlarmTime}
                  </Text>
                  <Text style={styles.cardLabel}>Scheduled Alarm</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Connection Management Panel ── */}
          <ConnectionStatusCard
            status={connectionStatus}
            device={connectedDevice}
            lastSyncedAt={lastSyncedAt}
            onScanPress={() => navigation.navigate('Scan')}
            onDisconnect={handleDisconnect}
          />

          {/* ── Sleep Coach & Alarms Header ── */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>Sleep Coach</Text>
              <Text style={styles.sectionTitle}>Haptic Alarms</Text>
            </View>
            <View style={styles.alarmCount}>
              <Text style={styles.alarmCountText}>
                {alarms.filter(a => a.enabled).length} active
              </Text>
            </View>
          </View>

          {/* ── Alarm List ── */}
          {alarms.length === 0 ? (
            <View style={styles.emptyState}>
              <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
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
                <Text style={{ color: palette.whoopBlue }}>+</Text>
                {' '}button below to configure a wake-up time.
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

          {/* Bottom spacing for FAB */}
          <View style={styles.bottomSpacing} />
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
                stroke="#000000"
                strokeWidth="2.5"
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  kicker: {
    color: palette.textSoft,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  syncIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(41,121,255,0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(41,121,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncLabel: {
    color: palette.whoopBlue,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radii.pill,
    padding: 3,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActiveRecovery: {
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  tabBtnActiveSleep: {
    backgroundColor: 'rgba(41, 121, 255, 0.08)',
    borderColor: 'rgba(41, 121, 255, 0.3)',
  },
  tabBtnActiveStrain: {
    backgroundColor: 'rgba(255, 171, 0, 0.08)',
    borderColor: 'rgba(255, 171, 0, 0.3)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActiveRecovery: {
    color: palette.whoopGreen,
  },
  tabTextActiveSleep: {
    color: palette.whoopBlue,
  },
  tabTextActiveStrain: {
    color: palette.whoopYellow,
  },
  tabTextInactive: {
    color: palette.textMuted,
  },

  // Dial Container
  dialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  dialGlowWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  dialInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#050505',
  },
  dialSub: {
    color: palette.textSoft,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dialVal: {
    color: palette.text,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  dialState: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 6,
    textTransform: 'uppercase',
  },

  // Telemetry Grid
  grid: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  telemetryCard: {
    flex: 1,
    backgroundColor: palette.bgCardStrong,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  cardHeader: {
    color: palette.textSoft,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCol: {
    flex: 1,
  },
  cardSingleCol: {
    justifyContent: 'center',
  },
  cardDivider: {
    width: 1,
    height: 26,
    backgroundColor: palette.border,
    marginHorizontal: spacing.xs,
  },
  cardValText: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardValTextAlarm: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardValTextLive: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardUnit: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  cardLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // Section Header
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  alarmCount: {
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alarmCountText: {
    color: palette.whoopGreen,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    backgroundColor: palette.bgCardStrong,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
  },
  emptyTitle: {
    color: palette.textMuted,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyBody: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },

  // FAB
  fabWrap: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    ...shadows.glow,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.whoopBlue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.whoopBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  bottomSpacing: {
    height: 100,
  },
});

