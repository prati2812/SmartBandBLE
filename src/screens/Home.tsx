import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AlarmCard from '../components/AlarmCard';
import BatteryCard from '../components/BatteryCard';
import ConnectionStatusCard from '../components/ConnectionStatusCard';
import GradientBackground from '../components/GradientBackground';
import PrimaryButton from '../components/PrimaryButton';
import { useGreeting } from '../hooks/useGreeting';
import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';
import { RootStackParamList } from '../types/navigation';
import { showToast } from '../utils/toast';
import { palette, radii, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function Home({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const greeting = useGreeting();
  const connectionStatus = useBLEStore(state => state.connectionStatus);
  const connectedDevice = useBLEStore(state => state.connectedDevice);
  const batteryLevel = useBLEStore(state => state.batteryLevel);
  const lastSyncedAt = useBLEStore(state => state.lastSyncedAt);
  const alarms = useBLEStore(state => state.alarms);
  const toggleAlarm = useBLEStore(state => state.toggleAlarm);
  const isCompactLayout = width < 390;

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
    const updatedAlarm = useBLEStore.getState().alarms.find(item => item.id === alarmId);
    if (updatedAlarm && useBLEStore.getState().connectedDevice) {
      await bleService.sendAlarmConfig(updatedAlarm);
    }
  };

  const handleSync = async () => {
    if (!connectedDevice) {
      showToast('Connect a wearable before syncing alarms');
      return;
    }

    const success = await bleService.syncEnabledAlarms(useBLEStore.getState().alarms);
    showToast(success ? 'Alarm payload synced to band' : 'Sync failed. Try again.');
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Wearable control</Text>
            <Text style={styles.title}>{greeting.title}</Text>
            <Text style={styles.subtitle}>{greeting.subtitle}</Text>
          </View>

          <ConnectionStatusCard
            status={connectionStatus}
            device={connectedDevice}
            lastSyncedAt={lastSyncedAt}
            onScanPress={() => navigation.navigate('Scan')}
            onDisconnect={handleDisconnect}
          />

          <View style={[styles.metricsRow, isCompactLayout && styles.metricsColumn]}>
            <BatteryCard level={batteryLevel} lastSyncedAt={lastSyncedAt} />
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Connected device</Text>
              <Text style={styles.metricValue} numberOfLines={2}>
                {connectedDevice?.name || connectedDevice?.localName || 'No band linked'}
              </Text>
              <Text style={styles.metricMeta}>
                {connectedDevice ? connectedDevice.id : 'Scan to discover nearby BLE wearables'}
              </Text>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <PrimaryButton title="Scan devices" onPress={() => navigation.navigate('Scan')} />
            <View style={styles.ctaSpacer} />
            <PrimaryButton
              title="Sync alarms"
              variant="secondary"
              disabled={!connectedDevice}
              onPress={handleSync}
            />
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>Haptic alarms</Text>
              <Text style={styles.sectionTitle}>Alarm setup</Text>
            </View>
            <PrimaryButton
              title="New alarm"
              variant="secondary"
              style={styles.smallButton}
              onPress={() => navigation.navigate('AlarmSetup')}
            />
          </View>

          {alarms.map(alarm => (
            <AlarmCard
              key={alarm.id}
              alarm={alarm}
              onToggle={handleAlarmToggle}
              onPress={(selectedAlarm) =>
                navigation.navigate('AlarmSetup', { alarmId: selectedAlarm.id })
              }
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 48,
  },
  header: {
    marginBottom: spacing.xl,
  },
  kicker: {
    color: palette.cyan,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginTop: 4,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  metricsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricsColumn: {
    flexDirection: 'column',
  },
  metricCard: {
    flex: 1,
    minHeight: 148,
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  metricLabel: {
    color: palette.textSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: spacing.sm,
    lineHeight: 28,
  },
  metricMeta: {
    color: palette.textMuted,
    marginTop: spacing.sm,
    fontSize: 12,
    lineHeight: 18,
  },
  ctaRow: {
    marginTop: spacing.lg,
  },
  ctaSpacer: {
    height: spacing.md,
  },
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
    fontSize: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginTop: 4,
  },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-end',
  },
});
