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
    backgroundColor: palette.bgCardStrong,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    color: palette.textSoft,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  value: {
    color: palette.whoopBlue,
    fontSize: 22,
    fontWeight: '800',
  },
  track: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: palette.whoopBlue,
  },
  presetRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preset: {
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  presetActive: {
    backgroundColor: palette.whoopBlue,
    borderColor: palette.whoopBlue,
  },
  presetText: {
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  presetTextActive: {
    color: '#000000',
  },
});

