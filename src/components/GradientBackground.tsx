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
            <Stop offset="0%" stopColor="#000000" />
            <Stop offset="50%" stopColor="#03050F" />
            <Stop offset="100%" stopColor="#000000" />
          </LinearGradient>
          <LinearGradient id="cyanOrb" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0055FF" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#0055FF" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="blueOrb" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#5E8CFF" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#5E8CFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Rect width="100%" height="100%" fill="url(#mainBg)" />
        <Circle cx="18%" cy="16%" r="140" fill="url(#cyanOrb)" />
        <Circle cx="86%" cy="22%" r="180" fill="url(#blueOrb)" />
        <Circle cx="64%" cy="88%" r="190" fill="url(#cyanOrb)" />

        {Array.from({ length: 11 }).map((_, index) => {
          const y = `${index * 10}%`;
          return <Line key={`h-${y}`} x1="0%" y1={y} x2="100%" y2={y} stroke="rgba(0,119,255,0.018)" strokeWidth="1" />;
        })}
        {Array.from({ length: 7 }).map((_, index) => {
          const x = `${index * 16}%`;
          return <Line key={`v-${x}`} x1={x} y1="0%" x2={x} y2="100%" stroke="rgba(0,119,255,0.012)" strokeWidth="1" />;
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
