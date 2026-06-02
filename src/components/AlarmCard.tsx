import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Alarm } from '../types/ble';
import { formatTime12Hour, getRepeatLabel } from '../utils/format';
import { palette, radii, spacing } from '../utils/theme';

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
          <Text style={styles.intensityText}>VIBE {alarm.intensity}%</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={[styles.stateLabel, alarm.enabled ? styles.enabled : styles.disabled]}>
          {alarm.enabled ? 'Active' : 'Off'}
        </Text>
        <Switch
          value={alarm.enabled}
          onValueChange={() => onToggle(alarm.id)}
          thumbColor={alarm.enabled ? palette.text : palette.textSoft}
          trackColor={{ false: 'rgba(255,255,255,0.06)', true: palette.whoopGreen }}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
  },
  time: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  repeat: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  intensityPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  intensityText: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  right: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stateLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  enabled: {
    color: palette.whoopGreen,
  },
  disabled: {
    color: palette.textSoft,
  },
});

