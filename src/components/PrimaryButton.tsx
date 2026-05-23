import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { palette, radii, shadows, spacing } from '../utils/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={variant === 'primary' ? palette.bg : palette.cyan} />
        ) : (
          <>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text
              style={[
                styles.text,
                variant === 'primary' ? styles.primaryText : styles.secondaryText,
                isDisabled && styles.disabledText,
              ]}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: palette.cyan,
    borderColor: palette.cyan,
    ...shadows.glow,
  },
  secondary: {
    backgroundColor: 'rgba(99, 243, 255, 0.08)',
    borderColor: palette.borderStrong,
  },
  disabled: {
    backgroundColor: 'rgba(17, 28, 49, 0.7)',
    borderColor: palette.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  primaryText: {
    color: palette.bg,
  },
  secondaryText: {
    color: palette.cyan,
  },
  disabledText: {
    color: palette.textSoft,
  },
});
