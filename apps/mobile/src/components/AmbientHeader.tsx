import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { GpsReading } from '../types/report';

interface AmbientHeaderProps {
  gps: GpsReading;
  canUseCloudRelay: boolean;
  forceOffline: boolean;
}

function getGpsBadge(gps: GpsReading): { label: string; color: string } {
  switch (gps.fixState) {
    case 'LOCKED':
      return {
        label: `GPS +/-${Math.round(gps.accuracyMeters)}m`,
        color: EMERGENCY_COLORS.telemetry,
      };
    case 'LAST_KNOWN':
      return {
        label: `GPS ${gps.posAgeS}s OLD`,
        color: EMERGENCY_COLORS.moderate,
      };
    case 'SEARCHING':
      return { label: 'GPS SEARCH', color: EMERGENCY_COLORS.moderate };
    case 'DENIED':
      return { label: 'GPS DENIED', color: EMERGENCY_COLORS.critical };
    case 'NO_FIX':
      return { label: 'NO GPS', color: EMERGENCY_COLORS.critical };
  }
}

export function AmbientHeader({ gps, canUseCloudRelay, forceOffline }: AmbientHeaderProps) {
  const { colors, mode, toggleTheme } = useAppTheme();
  const gpsBadge = getGpsBadge(gps);

  const pathLabel = forceOffline
    ? 'TEST: BLE'
    : canUseCloudRelay
      ? 'CLOUD READY'
      : 'OFFLINE: BLE';
  const pathColor = canUseCloudRelay ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.telemetry;

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle },
      ]}
    >
      <View style={styles.brandRow}>
        <View style={[styles.brandDot, { backgroundColor: colors.accentPrimary }]} />
        <Text style={[styles.brandText, { color: colors.textPrimary }]}>SALBAR</Text>
      </View>

      <View style={styles.pillsRow}>
        <View
          style={[
            styles.pill,
            { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: gpsBadge.color }]} />
          <Text style={[styles.pillText, { color: gpsBadge.color }]}>{gpsBadge.label}</Text>
        </View>

        <View
          style={[
            styles.pill,
            { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: pathColor }]} />
          <Text style={[styles.pillText, { color: pathColor }]}>{pathLabel}</Text>
        </View>

        <Pressable
          onPress={toggleTheme}
          accessibilityLabel="Toggle color theme"
          style={[
            styles.themeBtn,
            { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.themeBtnText, { color: colors.textPrimary }]}>
            {mode === 'dark' ? 'DARK' : 'LIGHT'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brandText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  themeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  themeBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
