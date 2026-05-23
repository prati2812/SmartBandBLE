import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '../utils/theme';

interface CustomSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const presets = [20, 40, 60, 80, 100];

export default function CustomSlider({
  value,
  onChange,
}: CustomSliderProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Vibration intensity</Text>
        <Text style={styles.value}>{value}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.progress, { width: `${value}%` }]} />
      </View>

      <View style={styles.presetRow}>
        {presets.map(item => {
          const selected = item === value;
          return (
            <Pressable
              key={item}
              onPress={() => onChange(item)}
              style={[styles.preset, selected && styles.presetActive]}>
              <Text style={[styles.presetText, selected && styles.presetTextActive]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    color: palette.textSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: {
    color: palette.cyan,
    fontSize: 24,
    fontWeight: '700',
  },
  track: {
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: palette.cyan,
  },
  presetRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preset: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetActive: {
    backgroundColor: palette.cyan,
  },
  presetText: {
    color: palette.textMuted,
    fontWeight: '700',
  },
  presetTextActive: {
    color: palette.bg,
  },
});
