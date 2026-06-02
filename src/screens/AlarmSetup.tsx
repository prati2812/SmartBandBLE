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
  const [durationSec, setDurationSec] = useState(existingAlarm?.duration_sec ?? 60);
  const [snooze, setSnooze] = useState(existingAlarm?.snooze ?? 5);
  const [pattern, setPattern] = useState<'normal' | 'gentle' | 'heavy_sleeper' | 'escalating'>(
    existingAlarm?.pattern ?? 'normal',
  );
  const [saving, setSaving] = useState(false);

  const draftAlarm: Alarm = useMemo(
    () => ({
      id: existingAlarm?.id ?? `alarm-${Date.now()}`,
      time,
      enabled,
      intensity,
      repeatDays,
      duration_sec: durationSec,
      snooze,
      pattern,
    }),
    [enabled, existingAlarm?.id, intensity, repeatDays, time, durationSec, snooze, pattern],
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
            <Text style={styles.headerKicker}>Sleep Coach Settings</Text>
            <Text style={styles.headerTitle}>
              {existingAlarm ? 'Edit Smart Alarm' : 'Create Smart Alarm'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CustomTimePicker value={time} onChange={setTime} />

          <View style={styles.toggleCard}>
            <View>
              <Text style={styles.cardLabel}>Alarm enabled</Text>
              <Text style={styles.cardText}>
                Allow wearable haptics to trigger at the selected time.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              thumbColor={enabled ? palette.text : palette.textSoft}
              trackColor={{ false: 'rgba(255,255,255,0.06)', true: palette.whoopGreen }}
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

          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Vibration Pattern</Text>
            <View style={styles.patternRow}>
              {(['normal', 'gentle', 'heavy_sleeper', 'escalating'] as const).map((pat) => {
                const selected = pattern === pat;
                const label = pat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                return (
                  <Pressable
                    key={pat}
                    onPress={() => setPattern(pat)}
                    style={[styles.patternOption, selected && styles.patternOptionSelected]}>
                    <Text style={[styles.patternText, selected && styles.patternTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Snooze duration</Text>
            <View style={styles.durationRow}>
              {[
                { label: 'Off', value: 0 },
                { label: '5m', value: 5 },
                { label: '10m', value: 10 },
                { label: '15m', value: 15 },
              ].map((opt) => {
                const selected = snooze === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSnooze(opt.value)}
                    style={[styles.durationOption, selected && styles.durationOptionSelected]}>
                    <Text style={[styles.durationText, selected && styles.durationTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Alarm duration</Text>
            <View style={styles.durationRow}>
              {[
                { label: '30s', value: 30 },
                { label: '1m', value: 60 },
                { label: '2m', value: 120 },
                { label: '5m', value: 300 },
              ].map((opt) => {
                const selected = durationSec === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setDurationSec(opt.value)}
                    style={[styles.durationOption, selected && styles.durationOptionSelected]}>
                    <Text style={[styles.durationText, selected && styles.durationTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.payloadCard}>
            <View style={styles.payloadHeader}>
              <View style={styles.payloadTerminalDot} />
              <Text style={styles.payloadTitle}>PAYLOAD CONSOLE</Text>
            </View>
            <Text style={styles.payloadText}>{payloadPreview}</Text>
          </View>

          <PrimaryButton title="Save settings" onPress={handleSave} loading={saving} />
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
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 10,
    fontWeight: '700',
  },
  headerTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: 48,
    gap: spacing.md,
  },
  toggleCard: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  cardText: {
    color: palette.textMuted,
    maxWidth: 220,
    lineHeight: 18,
    fontSize: 13,
  },
  daysCard: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  patternRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  patternOption: {
    flex: 1,
    minWidth: '45%',
    height: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  patternOptionSelected: {
    backgroundColor: 'rgba(41, 121, 255, 0.08)',
    borderColor: palette.whoopBlue,
  },
  patternText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  patternTextSelected: {
    color: palette.whoopBlue,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  durationOption: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  durationOptionSelected: {
    backgroundColor: 'rgba(41, 121, 255, 0.08)',
    borderColor: palette.whoopBlue,
  },
  durationText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  durationTextSelected: {
    color: palette.whoopBlue,
  },
  dayPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dayPillSelected: {
    backgroundColor: palette.whoopBlue,
    borderColor: palette.whoopBlue,
  },
  dayText: {
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  dayTextSelected: {
    color: '#000000',
  },
  payloadCard: {
    backgroundColor: '#08080C',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
  },
  payloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  payloadTerminalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.whoopGreen,
  },
  payloadTitle: {
    color: palette.textSoft,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  payloadText: {
    color: palette.whoopGreen,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  deleteButton: {
    marginTop: spacing.sm,
    borderColor: 'rgba(255, 23, 68, 0.3)',
    backgroundColor: 'rgba(255, 23, 68, 0.05)',
  },
});

