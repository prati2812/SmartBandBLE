import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
  const greeting = useGreeting();
  const connectionStatus = useBLEStore(state => state.connectionStatus);
  const connectedDevice = useBLEStore(state => state.connectedDevice);
  const batteryLevel = useBLEStore(state => state.batteryLevel);
  const lastSyncedAt = useBLEStore(state => state.lastSyncedAt);
  const alarms = useBLEStore(state => state.alarms);
  const toggleAlarm = useBLEStore(state => state.toggleAlarm);
  const [sendingTestPayload, setSendingTestPayload] = React.useState(false);

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

  const handleSendTestPayload = async () => {
    if (!connectedDevice) {
      showToast('Connect a wearable before sending a test payload');
      return;
    }

    setSendingTestPayload(true);
    const success = await bleService.sendTestPayload();
    setSendingTestPayload(false);
    showToast(success ? 'Test payload sent to band' : 'Test payload failed to send');
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

          <View style={styles.metricsRow}>
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
            <View style={styles.ctaSpacer} />
            <PrimaryButton
              title="Send test payload"
              variant="secondary"
              loading={sendingTestPayload}
              disabled={!connectedDevice}
              onPress={handleSendTestPayload}
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
    padding: spacing.xl,
    paddingBottom: 48,
  },
  header: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  kicker: {
    color: palette.cyan,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    maxWidth: 310,
  },
  metricsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
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
    alignItems: 'center',
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
    marginTop: 6,
  },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
});
