import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { palette } from '../utils/theme';

interface GradientBackgroundProps {
  children: React.ReactNode;
}

export default function GradientBackground({
  children,
}: GradientBackgroundProps) {
  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="mainBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#040712" />
            <Stop offset="40%" stopColor="#08101E" />
            <Stop offset="100%" stopColor="#02040D" />
          </LinearGradient>
          <LinearGradient id="cyanOrb" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#63F3FF" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#63F3FF" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="blueOrb" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#5E8CFF" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#5E8CFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Rect width="100%" height="100%" fill="url(#mainBg)" />
        <Circle cx="18%" cy="16%" r="140" fill="url(#cyanOrb)" />
        <Circle cx="86%" cy="22%" r="180" fill="url(#blueOrb)" />
        <Circle cx="64%" cy="88%" r="190" fill="url(#cyanOrb)" />

        {Array.from({ length: 11 }).map((_, index) => {
          const y = `${index * 10}%`;
          return <Line key={`h-${y}`} x1="0%" y1={y} x2="100%" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />;
        })}
        {Array.from({ length: 7 }).map((_, index) => {
          const x = `${index * 16}%`;
          return <Line key={`v-${x}`} x1={x} y1="0%" x2={x} y2="100%" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />;
        })}
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    flex: 1,
  },
});
