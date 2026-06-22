import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Modal,
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
import { buildAlarmPayload, formatTime12Hour } from '../utils/format';
import { showToast } from '../utils/toast';
import { palette, radii, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AlarmSetup'>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  // Bottom-sheet state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draftTime, setDraftTime] = useState(time);

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

  const openTimePicker = () => {
    setDraftTime(time);
    setPickerVisible(true);
  };

  const confirmTimePicker = () => {
    setTime(draftTime);
    setPickerVisible(false);
  };

  const cancelTimePicker = () => {
    setPickerVisible(false);
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

  // Parse time label parts
  const timeLabel = formatTime12Hour(time);
  const [timePart, periodPart] = timeLabel.split(' ');

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18L9 12L15 6"
                stroke={palette.text}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerKicker}>Sleep Coach Settings</Text>
            <Text style={styles.headerTitle}>
              {existingAlarm ? 'Edit Smart Alarm' : 'Create Smart Alarm'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>

          {/* ── Section 1: Schedule & Time ── */}
          <SectionHeader title="Schedule & Time" />

          {/* Tappable time card */}
          <Pressable onPress={openTimePicker} style={styles.timeCard}>
            <Text style={styles.timeCardKicker}>Alarm Time  •  Tap to change</Text>
            <View style={styles.timeRow}>
              <Text style={styles.timeDigits}>{timePart}</Text>
              <View style={styles.timePeriodBadge}>
                <Text style={styles.timePeriodText}>{periodPart}</Text>
              </View>
            </View>
            <View style={styles.timeCardEdit}>
              <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                  stroke={palette.textSoft}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke={palette.textSoft}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.timeCardEditText}>Edit time</Text>
            </View>
          </Pressable>

          {/* Enabled toggle */}
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

          {/* Repeat days */}
          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Repeat days</Text>
            <View style={styles.daysRow}>
              {DAYS.map((day, index) => {
                const selected = repeatDays.includes(index);
                return (
                  <Pressable
                    key={`${day}-${index}`}
                    onPress={() => toggleDay(index)}
                    style={[styles.dayPill, selected && styles.dayPillSelected]}>
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                      {day.charAt(0)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Section 2: Haptic Settings ── */}
          <SectionHeader title="Haptic Settings" />

          <CustomSlider value={intensity} onChange={setIntensity} />

          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Vibration Pattern</Text>
            <View style={styles.patternRow}>
              {(['normal', 'gentle', 'heavy_sleeper', 'escalating'] as const).map((pat) => {
                const selected = pattern === pat;
                const label = pat
                  .split('_')
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
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

          {/* ── Section 3: Safety & Constraints ── */}
          <SectionHeader title="Safety & Constraints" />

          <View style={styles.daysCard}>
            <Text style={styles.cardLabel}>Snooze duration</Text>
            <View style={styles.durationRow}>
              {[
                { label: 'Off', value: 0 },
                { label: '5 min', value: 5 },
                { label: '10 min', value: 10 },
                { label: '15 min', value: 15 },
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
                { label: '1 min', value: 60 },
                { label: '2 min', value: 120 },
                { label: '5 min', value: 300 },
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

          {/* ── Section 4: Developer Console ── */}
          <SectionHeader title="Developer Payload" />

          <View style={styles.payloadCard}>
            <View style={styles.payloadHeader}>
              <View style={styles.payloadTerminalDot} />
              <Text style={styles.payloadTitle}>PAYLOAD CONSOLE</Text>
            </View>
            <Text style={styles.payloadText}>{payloadPreview}</Text>
          </View>

          {/* Save / Delete */}
          <View style={styles.actionBlock}>
            <PrimaryButton title="Save settings" onPress={handleSave} loading={saving} />
            {existingAlarm ? (
              <PrimaryButton
                title="Delete alarm"
                variant="secondary"
                style={styles.deleteButton}
                onPress={handleDelete}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ─── Bottom-sheet Modal ─── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={cancelTimePicker}>
        {/* Dim backdrop */}
        <Pressable style={styles.backdrop} onPress={cancelTimePicker} />

        {/* Sheet */}
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.sheetHandle} />

          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Pressable onPress={cancelTimePicker} style={styles.sheetCancelBtn}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Set Alarm Time</Text>
            <Pressable onPress={confirmTimePicker} style={styles.sheetDoneBtn}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </Pressable>
          </View>

          {/* Live preview */}
          <Text style={styles.sheetPreview}>{formatTime12Hour(draftTime)}</Text>

          {/* Scroll-wheel picker */}
          <View style={styles.sheetPickerWrapper}>
            <CustomTimePicker value={draftTime} onChange={setDraftTime} />
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

/* ── Small helper component ── */
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },

  /* Header */
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
  headerCopy: { flex: 1 },
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

  /* Content */
  content: {
    paddingTop: spacing.lg,
    paddingBottom: 48,
    gap: spacing.md,
  },

  /* Tappable Time Card */
  timeCard: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  timeCardKicker: {
    color: palette.textSoft,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  timeDigits: {
    color: palette.text,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 68,
  },
  timePeriodBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  timePeriodText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timeCardEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    justifyContent: 'center',
  },
  timeCardEditText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* Toggle */
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

  /* Days */
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

  /* Pattern */
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

  /* Duration */
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

  /* Payload console */
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

  /* Action buttons */
  deleteButton: {
    borderColor: 'rgba(255, 23, 68, 0.3)',
    backgroundColor: 'rgba(255, 23, 68, 0.05)',
  },
  actionBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  /* Section header */
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: palette.textSoft,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  /* ── Bottom-sheet Modal ── */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111113',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 40,
    paddingTop: 10,
    paddingHorizontal: spacing.xl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sheetCancelText: {
    color: palette.textSoft,
    fontSize: 15,
    fontWeight: '500',
  },
  sheetDoneBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sheetDoneText: {
    color: palette.whoopBlue,
    fontSize: 15,
    fontWeight: '700',
  },
  sheetPreview: {
    color: palette.text,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sheetPickerWrapper: {
    width: '100%',
  },
});
