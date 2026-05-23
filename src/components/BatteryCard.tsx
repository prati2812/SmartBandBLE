import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { getBatteryTone } from '../utils/format';
import { palette, radii, shadows, spacing } from '../utils/theme';

interface BatteryCardProps {
  level: number | null;
  lastSyncedAt: string | null;
}

export default function BatteryCard({
  level,
  lastSyncedAt,
}: BatteryCardProps) {
  const strokeColor = getBatteryTone(level);
  const safeLevel = level ?? 0;
  const radius = 32;
  const circumference = radius * Math.PI * 2;
  const dashOffset = circumference - (safeLevel / 100) * circumference;

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.label}>Battery</Text>
        <Text style={styles.value}>{level == null ? '--%' : `${level}%`}</Text>
        <Text style={styles.caption}>
          {lastSyncedAt ? `Updated ${lastSyncedAt}` : 'Awaiting sync'}
        </Text>
      </View>

      <View style={styles.chartWrap}>
        <Svg width="86" height="86" viewBox="0 0 86 86" fill="none">
          <Circle cx="43" cy="43" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <Circle
            cx="43"
            cy="43"
            r={radius}
            stroke={strokeColor}
            strokeWidth="8"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 43 43)"
          />
        </Svg>
        <Text style={[styles.chartValue, { color: strokeColor }]}>{safeLevel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 148,
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    justifyContent: 'space-between',
    ...shadows.card,
  },
  label: {
    color: palette.textSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  value: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '700',
  },
  caption: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  chartWrap: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.lg,
    width: 86,
    height: 86,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartValue: {
    position: 'absolute',
    fontWeight: '700',
    fontSize: 18,
  },
});
