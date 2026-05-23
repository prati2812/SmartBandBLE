import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '../utils/theme';

interface BLELoaderProps {
  size?: number;
  isScanning?: boolean;
}

const ringStyle = (size: number) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
});

function PulseRing({
  progress,
  size,
}: {
  progress: SharedValue<number>;
  size: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.42 + progress.value * 1.9 }],
    opacity: 0.55 - progress.value * 0.55,
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        ringStyle(size),
        animatedStyle,
      ]}
    />
  );
}

export default function BLELoader({
  size = 180,
  isScanning = true,
}: BLELoaderProps) {
  const pulseA = useSharedValue(0);
  const pulseB = useSharedValue(0.33);
  const pulseC = useSharedValue(0.66);

  useEffect(() => {
    if (isScanning) {
      pulseA.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
      pulseB.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
      pulseC.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
      return;
    }

    pulseA.value = 0;
    pulseB.value = 0;
    pulseC.value = 0;
  }, [isScanning, pulseA, pulseB, pulseC]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {isScanning ? (
        <>
          <PulseRing progress={pulseA} size={size} />
          <PulseRing progress={pulseB} size={size} />
          <PulseRing progress={pulseC} size={size} />
        </>
      ) : null}
      <View style={[styles.core, ringStyle(size * 0.38)]}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2V22M12 2L17 7L7 17M7 7L17 17L12 22"
            stroke={palette.cyan}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="10" cy="14" r="1.4" fill={palette.cyan} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 243, 255, 0.45)',
    backgroundColor: 'rgba(99, 243, 255, 0.04)',
  },
  core: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 15, 29, 0.98)',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    shadowColor: palette.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
});
