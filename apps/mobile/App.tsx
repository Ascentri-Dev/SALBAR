import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar, MobileTab } from './src/components/BottomTabBar';
import { SplashScreen } from './src/components/SplashScreen';
import { getReportCounts, listReports } from './src/db/reportsRepository';
import { useLocationStatus } from './src/hooks/useLocationStatus';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { GuideScreen } from './src/screens/GuideScreen';
import { OutboxScreen } from './src/screens/OutboxScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import type { LocalReport, ReportCounts } from './src/types/report';

const EMPTY_COUNTS: ReportCounts = {
  pending: 0,
  relayedBle: 0,
  sentCloud: 0,
  total: 0,
};

function SalbarMobileShell() {
  const { colors, isDark } = useAppTheme();
  const { reading: gps, refreshPermission } = useLocationStatus();
  const network = useNetworkStatus();

  const [activeTab, setActiveTab] = useState<MobileTab>('report');
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [counts, setCounts] = useState<ReportCounts>(EMPTY_COUNTS);
  const [dbReady, setDbReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  const refreshOutbox = useCallback(async () => {
    const [allReports, summary] = await Promise.all([listReports(), getReportCounts()]);
    setReports(allReports);
    setCounts(summary);
    setDbReady(true);
  }, []);

  useEffect(() => {
    void refreshOutbox();
  }, [refreshOutbox]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bgBase }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={splashVisible || isDark ? 'light' : 'dark'} />

      <View style={[styles.appBody, { backgroundColor: colors.bgBase }]}>
        <View style={styles.screenContainer}>
          {activeTab === 'report' ? (
            <ReportScreen
              gps={gps}
              onReportSaved={() => {
                void refreshOutbox();
              }}
            />
          ) : null}

          {activeTab === 'outbox' ? (
            <OutboxScreen
              reports={reports}
              counts={counts}
              onRefresh={() => {
                void refreshOutbox();
              }}
            />
          ) : null}

          {activeTab === 'guide' ? (
            <GuideScreen
              gps={gps}
              forceOffline={network.forceOffline}
              onToggleForceOffline={network.setForceOffline}
              onRefreshLocation={() => {
                void refreshPermission();
              }}
            />
          ) : null}
        </View>

        <BottomTabBar
          activeTab={activeTab}
          pendingCount={counts.pending}
          onSelectTab={setActiveTab}
        />
      </View>

      {splashVisible ? (
        <SplashScreen ready={dbReady} onFinish={() => setSplashVisible(false)} />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SalbarMobileShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  appBody: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});
