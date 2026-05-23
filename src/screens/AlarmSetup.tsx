import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import CustomSlider from '../components/CustomSlider';
import CustomTimePicker from '../components/CustomTimePicker';
import GradientBackground from '../components/GradientBackground';
import PrimaryButton from '../components/PrimaryButton';
import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';
import { Alarm } from '../types/ble';
import { RootStackParamList } from '../types/navigation';
import { buildAlarmPayload } from '../utils/format';
import { showToast } from '../utils/toast';
import { palette, radii, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AlarmSetup'>;

const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AlarmSetup({ navigation, route }: Props) {
  const existingAlarm = useBLEStore(state =>
    state.alarms.find(item => item.id === route.params?.alarmId),
  );
  const upsertAlarm = useBLEStore(state => state.upsertAlarm);
  const deleteAlarm = useBLEStore(state => state.deleteAlarm);
  const connectedDevice = useBLEStore(state => state.connectedDevice);

  const [time, setTime] = useState(existingAlarm?.time ?? '06:30');
  const [enabled, setEnabled] = useState(existingAlarm?.enabled ?? true);
  const [intensity, setIntensity] = useState(existingAlarm?.intensity ?? 80);
  const [repeatDays, setRepeatDays] = useState<number[]>(
    existingAlarm?.repeatDays ?? [1, 2, 3, 4, 5],
  );
  const [saving, setSaving] = useState(false);

  const draftAlarm: Alarm = useMemo(
    () => ({
      id: existingAlarm?.id ?? `alarm-${Date.now()}`,
      time,
      enabled,
      intensity,
      repeatDays,
    }),
    [enabled, existingAlarm?.id, intensity, repeatDays, time],
  );

  const payloadPreview = JSON.stringify(buildAlarmPayload(draftAlarm), null, 2);

  const toggleDay = (index: number) => {
    setRepeatDays(current =>
      current.includes(index)
        ? current.filter(day => day !== index)
        : [...current, index].sort((left, right) => left - right),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    upsertAlarm(draftAlarm);

    if (connectedDevice) {
      const success = await bleService.sendAlarmConfig(draftAlarm);
      showToast(success ? 'Alarm synced to wearable' : 'Saved locally. BLE sync failed.');
    } else {
      showToast('Alarm saved locally');
    }

    setSaving(false);
    navigation.goBack();
  };

  const handleDelete = async () => {
    if (!existingAlarm) {
      return;
    }

    deleteAlarm(existingAlarm.id);
    if (connectedDevice) {
      await bleService.sendAlarmConfig({ ...existingAlarm, enabled: false });
    }
    showToast('Alarm removed');
    navigation.goBack();
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke={palette.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerKicker}>Alarm payload designer</Text>
            <Text style={styles.headerTitle}>
              {existingAlarm ? 'Edit smart alarm' : 'Create smart alarm'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CustomTimePicker value={time} onChange={setTime} />

          <View style={styles.toggleCard}>
            <View>
              <Text style={styles.cardLabel}>Alarm enabled</Text>
              <Text style={styles.cardText}>
                Let the wearable vibrate at the selected time.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              thumbColor={enabled ? palette.bg : palette.white}
              trackColor={{ false: '#243042', true: palette.cyan }}
            />
          </View>

          <CustomSlider value={intensity} onChange={setIntensity} />

          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Repeat days</Text>
            <View style={styles.daysRow}>
              {days.map((day, index) => {
                const selected = repeatDays.includes(index);
                return (
                  <Pressable
                    key={`${day}-${index}`}
                    onPress={() => toggleDay(index)}
                    style={[styles.dayPill, selected && styles.dayPillSelected]}>
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.payloadCard}>
            <Text style={styles.cardLabel}>JSON payload preview</Text>
            <Text style={styles.payloadText}>{payloadPreview}</Text>
          </View>

          <PrimaryButton title="Save alarm" onPress={handleSave} loading={saving} />
          {existingAlarm ? (
            <PrimaryButton
              title="Delete alarm"
              variant="secondary"
              style={styles.deleteButton}
              onPress={handleDelete}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 6,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: 48,
    gap: spacing.lg,
  },
  toggleCard: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  cardText: {
    color: palette.textMuted,
    maxWidth: 220,
    lineHeight: 20,
  },
  daysCard: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  dayPill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dayPillSelected: {
    backgroundColor: palette.cyan,
  },
  dayText: {
    color: palette.textMuted,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: palette.bg,
  },
  payloadCard: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
  },
  payloadText: {
    color: palette.cyan,
    fontFamily: 'monospace',
    lineHeight: 22,
  },
  deleteButton: {
    marginTop: spacing.sm,
  },
});
