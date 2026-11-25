import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { GpsReading } from '../types/report';

interface GuideScreenProps {
  gps: GpsReading;
  forceOffline: boolean;
  onToggleForceOffline: (value: boolean) => void;
  onRefreshLocation: () => void;
}

export function GuideScreen({
  gps,
  forceOffline,
  onToggleForceOffline,
  onRefreshLocation,
}: GuideScreenProps) {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const [relayUrl, setRelayUrl] = useState(
    process.env.EXPO_PUBLIC_CLOUD_RELAY_URL ?? 'http://localhost:8000',
  );

  const locationGranted = gps.fixState !== 'DENIED';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        Hardware & Permission Readiness
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.checkRow}>
          <View>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>Fine Location (GPS)</Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              Status: {gps.fixState}
            </Text>
          </View>
          <Pressable
            onPress={locationGranted ? onRefreshLocation : () => void Linking.openSettings()}
            style={[
              styles.actionChip,
              {
                backgroundColor: locationGranted
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
              },
            ]}
          >
            <Text
              style={[
                styles.actionChipText,
                {
                  color: locationGranted
                    ? EMERGENCY_COLORS.success
                    : EMERGENCY_COLORS.critical,
                },
              ]}
            >
              {locationGranted ? 'GRANTED' : 'OPEN SETTINGS'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.checkRow}>
          <View>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
              Bluetooth Low Energy (BLE)
            </Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              Used during outages to relay reports to T-Beam units
            </Text>
          </View>
          <View style={[styles.actionChip, { backgroundColor: colors.bgSurfaceElevated }]}>
            <Text style={[styles.actionChipText, { color: EMERGENCY_COLORS.telemetry }]}>
              PHASE 4
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        Offline Emergency Reporting Guide
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
          1. Tap an emergency category and submit. Your report is saved safely on your phone
          immediately, even with zero signal.{'\n'}
          2. If internet is available, it uploads directly to the Cloud Relay.{'\n'}
          3. During a telecom blackout, keep Bluetooth ON. When a barangay responder carrying a
          SALBAR T-Beam passes within range, your phone transfers the queued report over BLE.
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        Preferences & Field Trial Settings
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.checkRow}>
          <View style={styles.flexOne}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              Switch between Midnight Navy and high-glare Light theme
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.borderSubtle, true: colors.accentPrimary }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.checkRow}>
          <View style={styles.flexOne}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
              Force Offline Mode (BLE Test)
            </Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              Bypass Cloud Relay even when Wi-Fi/Data is connected
            </Text>
          </View>
          <Switch
            value={forceOffline}
            onValueChange={onToggleForceOffline}
            trackColor={{ false: colors.borderSubtle, true: colors.accentPrimary }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>Cloud Relay Base URL</Text>
        <TextInput
          value={relayUrl}
          onChangeText={setRelayUrl}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              backgroundColor: colors.bgBase,
              borderColor: colors.borderSubtle,
              color: colors.textPrimary,
            },
          ]}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 96 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  card: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  flexOne: { flex: 1 },
  itemTitle: { fontSize: 13, fontWeight: '700' },
  itemSub: { fontSize: 11, marginTop: 2 },
  actionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  actionChipText: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1 },
  guideBody: { fontSize: 13, lineHeight: 20 },
  input: {
    borderRadius: RADII.control,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
