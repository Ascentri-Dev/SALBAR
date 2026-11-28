import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar, MobileTab } from './src/components/BottomTabBar';
import { SplashScreen } from './src/components/SplashScreen';
import { TacticalBackground } from './src/components/TacticalBackground';
import { getReportCounts, listReports } from './src/db/reportsRepository';
import { useLocationStatus } from './src/hooks/useLocationStatus';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { useSyncEngine } from './src/hooks/useSyncEngine';
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

const TAB_ORDER: Record<MobileTab, number> = {
  report: 0,
  outbox: 1,
  guide: 2,
};

function SalbarMobileShell() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });
  const { colors, isDark } = useAppTheme();
  const { reading: gps, refreshPermission } = useLocationStatus();
  const network = useNetworkStatus();

  const [activeTab, setActiveTab] = useState<MobileTab>('report');
  const [reports, setReports] = useState<LocalReport[]>([]);
  const [counts, setCounts] = useState<ReportCounts>(EMPTY_COUNTS);
  const [dbReady, setDbReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  const prevTabRef = useRef<MobileTab>('report');
  const tabFade = useRef(new Animated.Value(1)).current;
  const tabSlide = useRef(new Animated.Value(0)).current;

  const refreshOutbox = useCallback(async () => {
    const [allReports, summary] = await Promise.all([listReports(), getReportCounts()]);
    setReports(allReports);
    setCounts(summary);
    setDbReady(true);
  }, []);

  useEffect(() => {
    void refreshOutbox();
  }, [refreshOutbox]);

  const sync = useSyncEngine({
    canUseCloudRelay: network.canUseCloudRelay,
    onSyncCompleted: refreshOutbox,
  });

  const handleSelectTab = useCallback(
    (nextTab: MobileTab) => {
      if (nextTab === activeTab) return;
      const direction = TAB_ORDER[nextTab] > TAB_ORDER[activeTab] ? 1 : -1;
      prevTabRef.current = nextTab;
      setActiveTab(nextTab);

      tabFade.setValue(0);
      tabSlide.setValue(direction * 24);

      Animated.parallel([
        Animated.timing(tabFade, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tabSlide, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [activeTab, tabFade, tabSlide],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bgBase }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={splashVisible || isDark ? 'light' : 'dark'} />

      <View style={styles.appBody}>
        <TacticalBackground />

        <Animated.View
          style={[
            styles.screenContainer,
            {
              opacity: tabFade,
              transform: [{ translateX: tabSlide }],
            },
          ]}
        >
          {activeTab === 'report' ? (
            <ReportScreen
              gps={gps}
              onReportSaved={() => {
                void refreshOutbox().then(() => {
                  if (network.canUseCloudRelay) {
                    void sync.syncPendingViaCloud();
                  }
                });
              }}
            />
          ) : null}

          {activeTab === 'outbox' ? (
            <OutboxScreen
              reports={reports}
              counts={counts}
              isScanningBle={sync.isScanningBle}
              isSyncing={sync.isSyncing}
              bleError={sync.bleError}
              terminals={sync.terminals}
              onStartScan={sync.startBleScan}
              onStopScan={sync.stopBleScan}
              onRelayToTerminal={sync.relayPendingToTerminal}
              onRetryReport={sync.retrySingleReport}
              onRefresh={() => {
                void refreshOutbox();
              }}
              onGoToReport={() => handleSelectTab('report')}
            />
          ) : null}

          {activeTab === 'guide' ? (
            <GuideScreen
              gps={gps}
              forceOffline={network.forceOffline}
              bleAvailable={sync.bleAvailable}
              relayUrl={sync.relayUrl}
              onChangeRelayUrl={sync.setRelayUrl}
              onToggleForceOffline={network.setForceOffline}
              onRefreshLocation={() => {
                void refreshPermission();
              }}
            />
          ) : null}
        </Animated.View>

        <BottomTabBar
          activeTab={activeTab}
          pendingCount={counts.pending}
          onSelectTab={handleSelectTab}
        />
      </View>

      {splashVisible ? (
        <SplashScreen
          ready={dbReady && fontsLoaded}
          onFinish={() => setSplashVisible(false)}
        />
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
