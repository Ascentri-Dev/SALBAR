import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

const GRID_SIZE = 32;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLS = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
const ROWS = Math.ceil(SCREEN_H / GRID_SIZE) + 1;

/**
 * 1-to-1 React Native port of apps/web-dashboard's TacticalBackground:
 * drifting warm/cool ambient glows + 32px tactical blueprint grid with orange intersection pins.
 */
export function TacticalBackground() {
  const { colors, isDark } = useAppTheme();
  const warmDrift = useRef(new Animated.Value(0)).current;
  const coolDrift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const warmLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(warmDrift, {
          toValue: 1,
          duration: 11000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(warmDrift, {
          toValue: 0,
          duration: 11000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const coolLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(coolDrift, {
          toValue: 1,
          duration: 13000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(coolDrift, {
          toValue: 0,
          duration: 13000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    warmLoop.start();
    coolLoop.start();

    return () => {
      warmLoop.stop();
      coolLoop.stop();
    };
  }, [warmDrift, coolDrift]);

  const warmTranslateX = warmDrift.interpolate({ inputRange: [0, 1], outputRange: [0, 36] });
  const warmTranslateY = warmDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const warmScale = warmDrift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const coolTranslateX = coolDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const coolTranslateY = coolDrift.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });
  const coolScale = coolDrift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  const lineColor = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.12)';
  const pinColor = isDark ? 'rgba(255, 107, 0, 0.42)' : 'rgba(234, 88, 12, 0.34)';
  const warmColor = isDark ? 'rgba(255, 107, 0, 0.08)' : 'rgba(234, 88, 12, 0.06)';
  const coolColor = isDark ? 'rgba(2, 132, 199, 0.09)' : 'rgba(2, 132, 199, 0.06)';

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { backgroundColor: colors.bgBase }]}
    >
      {/* 1. Ambient Drift Glow - Warm Accent (Top-Left) */}
      <Animated.View
        style={[
          styles.warmGlowOuter,
          {
            backgroundColor: warmColor,
            transform: [
              { translateX: warmTranslateX },
              { translateY: warmTranslateY },
              { scale: warmScale },
            ],
          },
        ]}
      >
        <View style={[styles.warmGlowMid, { backgroundColor: warmColor }]} />
        <View style={[styles.warmGlowInner, { backgroundColor: warmColor }]} />
      </Animated.View>

      {/* 2. Ambient Drift Glow - Cool Telemetry (Bottom-Right) */}
      <Animated.View
        style={[
          styles.coolGlowOuter,
          {
            backgroundColor: coolColor,
            transform: [
              { translateX: coolTranslateX },
              { translateY: coolTranslateY },
              { scale: coolScale },
            ],
          },
        ]}
      >
        <View style={[styles.coolGlowMid, { backgroundColor: coolColor }]} />
        <View style={[styles.coolGlowInner, { backgroundColor: coolColor }]} />
      </Animated.View>

      {/* 3. 32px Tactical Blueprint Grid */}
      <View style={styles.gridLayer}>
        {Array.from({ length: COLS }).map((_, c) => (
          <View
            key={`v-${c}`}
            style={[styles.vLine, { left: c * GRID_SIZE, backgroundColor: lineColor }]}
          />
        ))}
        {Array.from({ length: ROWS }).map((_, r) => (
          <View
            key={`h-${r}`}
            style={[styles.hLine, { top: r * GRID_SIZE, backgroundColor: lineColor }]}
          />
        ))}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((__, c) => (
            <View
              key={`p-${r}-${c}`}
              style={[
                styles.pinDot,
                {
                  top: r * GRID_SIZE - 1,
                  left: c * GRID_SIZE - 1,
                  backgroundColor: pinColor,
                },
              ]}
            />
          )),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  warmGlowOuter: {
    position: 'absolute',
    top: -110,
    left: -110,
    width: 380,
    height: 380,
    borderRadius: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmGlowMid: {
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  warmGlowInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  coolGlowOuter: {
    position: 'absolute',
    bottom: -120,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coolGlowMid: {
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  coolGlowInner: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  gridLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  pinDot: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
  },
});
