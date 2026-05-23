import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatTime12Hour } from '../utils/format';
import { palette, radii, spacing } from '../utils/theme';

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const bumpTime = (value: string, deltaMinutes: number) => {
  const [hoursRaw = '6', minutesRaw = '30'] = value.split(':');
  const date = new Date();
  date.setHours(Number(hoursRaw), Number(minutesRaw), 0, 0);
  date.setMinutes(date.getMinutes() + deltaMinutes);
  const nextHours = `${date.getHours()}`.padStart(2, '0');
  const nextMinutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
};

export default function CustomTimePicker({
  value,
  onChange,
}: CustomTimePickerProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Alarm time</Text>
      <Text style={styles.time}>{formatTime12Hour(value)}</Text>

      <View style={styles.controls}>
        <Pressable style={styles.controlButton} onPress={() => onChange(bumpTime(value, -15))}>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke={palette.cyan} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.controlText}>-15 min</Text>
        </Pressable>

        <View style={styles.chip}>
          <Text style={styles.chipText}>{value}</Text>
        </View>

        <Pressable style={styles.controlButton} onPress={() => onChange(bumpTime(value, 15))}>
          <Text style={styles.controlText}>+15 min</Text>
          <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <Path d="M9 18L15 12L9 6" stroke={palette.cyan} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  label: {
    color: palette.textSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  time: {
    color: palette.text,
    fontSize: 40,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  controls: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  controlText: {
    color: palette.cyan,
    fontWeight: '600',
  },
  chip: {
    backgroundColor: 'rgba(99, 243, 255, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  chipText: {
    color: palette.text,
    fontWeight: '700',
  },
});
