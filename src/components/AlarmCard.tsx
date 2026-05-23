import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Alarm } from '../types/ble';
import { formatTime12Hour, getRepeatLabel } from '../utils/format';
import { palette, radii, shadows, spacing } from '../utils/theme';

interface AlarmCardProps {
  alarm: Alarm;
  onToggle: (id: string) => void;
  onPress: (alarm: Alarm) => void;
}

export default function AlarmCard({
  alarm,
  onToggle,
  onPress,
}: AlarmCardProps) {
  return (
    <Pressable onPress={() => onPress(alarm)} style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.time}>{formatTime12Hour(alarm.time)}</Text>
        <Text style={styles.repeat}>{getRepeatLabel(alarm.repeatDays)}</Text>
        <View style={styles.intensityPill}>
          <Text style={styles.intensityText}>Vibration {alarm.intensity}%</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={[styles.stateLabel, alarm.enabled ? styles.enabled : styles.disabled]}>
          {alarm.enabled ? 'Enabled' : 'Paused'}
        </Text>
        <Switch
          value={alarm.enabled}
          onValueChange={() => onToggle(alarm.id)}
          thumbColor={alarm.enabled ? palette.bg : palette.white}
          trackColor={{ false: '#243042', true: palette.cyan }}
        />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.card,
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
  },
  time: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  repeat: {
    color: palette.textMuted,
    marginBottom: spacing.sm,
  },
  intensityPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 243, 255, 0.08)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  intensityText: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: '600',
  },
  right: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  enabled: {
    color: palette.green,
  },
  disabled: {
    color: palette.textSoft,
  },
});
