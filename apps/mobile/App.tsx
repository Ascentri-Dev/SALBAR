import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LORA_CONFIG } from '@salbar/protocol';
import { getReportCounts } from './src/db/reportsRepository';
import { useLocationStatus } from './src/hooks/useLocationStatus';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from './src/theme/tokens';

function Phase2DiagnosticsScreen() {
  const { colors, isDark, mode, toggleTheme } = useAppTheme();
  const { reading } = useLocationStatus();
  const network = useNetworkStatus();
  const [dbReady, setDbReady] = useState(false);
  const [totalReports, setTotalReports] = useState(0);

  useEffect(() => {
    void getReportCounts().then((counts) => {
      setTotalReports(counts.total);
      setDbReady(true);
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgBase }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>SALBAR Resident</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Phase 2 Core Data, Theme & Sensors Ready
        </Text>

        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Theme Mode</Text>
          <Text style={[styles.monoValue, { color: colors.accentPrimary }]}>
            {mode.toUpperCase()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>SQLite Store</Text>
          <Text style={[styles.monoValue, { color: EMERGENCY_COLORS.success }]}>
            {dbReady ? `READY (${totalReports} reports)` : 'INIT...'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>GPS Status</Text>
          <Text style={[styles.monoValue, { color: EMERGENCY_COLORS.telemetry }]}>
            {reading.fixState} ({reading.lat.toFixed(4)}, {reading.lng.toFixed(4)})
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Network Path</Text>
          <Text
            style={[
              styles.monoValue,
              {
                color: network.canUseCloudRelay
                  ? EMERGENCY_COLORS.success
                  : EMERGENCY_COLORS.moderate,
              },
            ]}
          >
            {network.canUseCloudRelay ? 'CLOUD READY' : 'OFFLINE / BLE'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>LoRa Spec</Text>
          <Text style={[styles.monoValue, { color: colors.textPrimary }]}>
            {LORA_CONFIG.FREQUENCY_MHZ} MHz SF{LORA_CONFIG.SPREADING_FACTOR}
          </Text>
        </View>

        <Pressable
          onPress={toggleTheme}
          style={[styles.button, { backgroundColor: colors.accentPrimary }]}
        >
          <Text style={styles.buttonText}>Toggle Light / Dark Theme</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Phase2DiagnosticsScreen />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  monoValue: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  button: {
    marginTop: 12,
    borderRadius: RADII.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
