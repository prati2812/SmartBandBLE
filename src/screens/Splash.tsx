import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';

import BLELoader from '../components/BLELoader';
import GradientBackground from '../components/GradientBackground';
import { RootStackParamList } from '../types/navigation';
import { palette, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function Splash({ navigation }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) });
    scale.value = withRepeat(withTiming(1.02, { duration: 1800 }), -1, true);

    const timer = setTimeout(() => {
      navigation.replace('Home');
    }, 4200);

    return () => clearTimeout(timer);
  }, [navigation, opacity, scale, translateY]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GradientBackground>
      <View style={styles.container}>
        <Animated.View style={[styles.hero, heroStyle]}>
          <Svg width="128" height="128" viewBox="0 0 128 128" fill="none">
            <Circle cx="64" cy="64" r="48" stroke="rgba(99,243,255,0.18)" strokeWidth="10" />
            <Path
              d="M64 18C88.853 18 109 38.147 109 63C109 87.853 88.853 108 64 108"
              stroke={palette.cyan}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <Circle cx="64" cy="64" r="18" fill="#0B1220" stroke={palette.cyan} strokeWidth="3" />
          </Svg>
          <Text style={styles.brand}>Smart Band</Text>
          <Text style={styles.subtitle}>Premium wearable control for life</Text>
        </Animated.View>

        <View style={styles.loaderBlock}>
          <BLELoader size={150} isScanning />
          <Text style={styles.loaderText}>Establishing companion environment</Text>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 72,
  },
  hero: {
    marginTop: 60,
    alignItems: 'center',
  },
  brand: {
    marginTop: spacing.xl,
    color: palette.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: palette.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  loaderBlock: {
    alignItems: 'center',
  },
  loaderText: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
    marginTop: spacing.lg,
  },
});
