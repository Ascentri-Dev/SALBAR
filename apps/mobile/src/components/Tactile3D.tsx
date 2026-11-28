import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { RADII } from '../theme/tokens';

interface Tactile3DCardProps {
  children: React.ReactNode;
  offset?: number;
  radius?: number;
  borderColor?: string;
  shadowColor?: string;
  backgroundColor?: string;
  revealDelayMs?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Static 3D extruded container with 2px border, crisp hard-offset backing,
 * and subtle reveal-up entrance animation.
 */
export function Tactile3DCard({
  children,
  offset = 4,
  radius = RADII.card,
  borderColor,
  shadowColor,
  backgroundColor,
  revealDelayMs = 0,
  style,
  contentStyle,
}: Tactile3DCardProps) {
  const { colors } = useAppTheme();
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 280,
      delay: revealDelayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal, revealDelayMs]);

  const translateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity: reveal, transform: [{ translateY }] },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.shadowBacking,
          {
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
            borderRadius: radius,
            backgroundColor: shadowColor ?? colors.tactileShadow,
          },
        ]}
      />
      <View
        style={[
          styles.face,
          {
            borderRadius: radius,
            borderColor: borderColor ?? colors.tactileBorder,
            backgroundColor: backgroundColor ?? colors.bgSurface,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

interface Tactile3DButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  offset?: number;
  radius?: number;
  borderColor?: string;
  shadowColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Mechanical 3D push-button: depresses smoothly into its hard-offset backing on press.
 */
export function Tactile3DButton({
  children,
  onPress,
  disabled = false,
  offset = 4,
  radius = RADII.pill,
  borderColor,
  shadowColor,
  backgroundColor,
  style,
  contentStyle,
}: Tactile3DButtonProps) {
  const { colors } = useAppTheme();
  const press = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(press, {
      toValue: 1,
      duration: 75,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(press, {
      toValue: 0,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const shift = press.interpolate({
    inputRange: [0, 1],
    outputRange: [0, offset],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.wrapper, style, { opacity: disabled ? 0.65 : 1 }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.shadowBacking,
          {
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
            borderRadius: radius,
            backgroundColor: shadowColor ?? colors.tactileShadow,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.face,
          {
            borderRadius: radius,
            borderColor: borderColor ?? colors.tactileBorder,
            backgroundColor: backgroundColor ?? colors.accentPrimary,
            transform: [{ translateX: shift }, { translateY: shift }],
          },
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowBacking: {
    position: 'absolute',
  },
  face: {
    borderWidth: 2,
    overflow: 'hidden',
  },
});
