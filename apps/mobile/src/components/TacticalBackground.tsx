import { Dimensions, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

const GRID_SIZE = 32;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLS = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
const ROWS = Math.ceil(SCREEN_H / GRID_SIZE) + 1;

/**
 * Static 32px tactical blueprint grid with muted orange intersection pins,
 * matching the web dashboard background texture.
 */
export function TacticalBackground() {
  const { colors, isDark } = useAppTheme();

  const lineColor = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.12)';
  const pinColor = isDark ? 'rgba(255, 107, 0, 0.42)' : 'rgba(234, 88, 12, 0.34)';

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { backgroundColor: colors.bgBase }]}
    >
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
