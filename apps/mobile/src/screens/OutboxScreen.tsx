import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { DiscoveredTerminal } from '../ble/bleRelayService';
import {
  getCategoryLabel,
  getCategoryOption,
  getUrgencyColor,
} from '../constants/triage';
import { deleteReport } from '../db/reportsRepository';
import { Tactile3DButton, Tactile3DCard } from '../components/Tactile3D';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, FONTS, RADII } from '../theme/tokens';
import type { LocalReport, ReportCounts, SyncStatus } from '../types/report';

interface OutboxScreenProps {
  reports: LocalReport[];
  counts: ReportCounts;
  isScanningBle: boolean;
  isSyncing: boolean;
  bleError: string | null;
  terminals: DiscoveredTerminal[];
  onStartScan: () => void;
  onStopScan: () => void;
  onRelayToTerminal: (deviceId: string) => Promise<void>;
  onRetryReport: (report: LocalReport) => Promise<{ ok: boolean; message: string }>;
  onRefresh: () => void;
  onGoToReport: () => void;
}

type OutboxFilter = 'ALL' | 'PENDING' | 'BLE' | 'CLOUD';

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatFullDateTime(ms: number): string {
  const d = new Date(ms);
  const dateStr = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${dateStr} • ${formatTimestamp(ms)}`;
}

function getSyncMeta(status: SyncStatus): { label: string; color: string } {
  switch (status) {
    case 'PENDING_LOCAL':
      return { label: 'Pending Local', color: EMERGENCY_COLORS.moderate };
    case 'SYNCING':
      return { label: 'Syncing', color: EMERGENCY_COLORS.telemetry };
    case 'RELAYED_BLE':
      return { label: 'Relayed BLE', color: EMERGENCY_COLORS.telemetry };
    case 'SENT_CLOUD':
      return { label: 'Sent Cloud', color: EMERGENCY_COLORS.success };
  }
}

/**
 * Interactive 3-Card Spotlight KPI Filter.
 */
function KpiFilterCard({
  label,
  value,
  accentColor,
  activeFilter,
  filterKey,
  onPress,
}: {
  label: string;
  value: number;
  accentColor: string;
  activeFilter: OutboxFilter;
  filterKey: Exclude<OutboxFilter, 'ALL'>;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const dimAnim = useRef(new Animated.Value(1)).current;

  const isSelected = activeFilter === filterKey;
  const isOtherSelected = activeFilter !== 'ALL' && !isSelected;

  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: isOtherSelected ? 0.45 : 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [isOtherSelected, dimAnim]);

  return (
    <Pressable onPress={onPress} style={styles.kpiWrap}>
      <View style={styles.kpiOuter}>
        <Animated.View
          pointerEvents="none"
          style={[styles.kpiShadow, { backgroundColor: colors.tactileShadow, opacity: dimAnim }]}
        />
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: colors.bgSurface,
              borderColor: isSelected ? accentColor : colors.tactileBorder,
              borderWidth: 2,
            },
          ]}
        >
          <Animated.View style={{ opacity: dimAnim, alignItems: 'center' }}>
            <Text style={[styles.kpiValue, { color: accentColor }]}>{value}</Text>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{label}</Text>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Saved Report Card with fluid 3D tactile press animation.
 */
function SavedReportCard({
  report,
  onPress,
}: {
  report: LocalReport;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const press = useRef(new Animated.Value(0)).current;

  const catOpt = getCategoryOption(report.category);
  const urgencyColor = getUrgencyColor(report.urgency);
  const syncMeta = getSyncMeta(report.syncStatus);

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
    outputRange: [0, 3],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.reportCardOuter}
    >
      <View
        pointerEvents="none"
        style={[styles.cardShadowBacking, { backgroundColor: colors.tactileShadow }]}
      />
      <Animated.View
        style={[
          styles.reportCard,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.tactileBorder,
            borderLeftColor: catOpt.accentColor,
            transform: [{ translateX: shift }, { translateY: shift }],
          },
        ]}
      >
        <View style={styles.reportTop}>
          <Text style={[styles.reportCategory, { color: colors.textPrimary }]}>
            {getCategoryLabel(report.category)}
          </Text>
          <Text style={[styles.severityText, { color: urgencyColor }]}>
            {report.urgency}
          </Text>
        </View>

        <Text style={[styles.reportMetaLine, { color: colors.textSecondary }]}>
          #{report.incidentIdNum}  •  {report.victimCount}{' '}
          {report.victimCount === 1 ? 'person' : 'people'}  •  {' '}
          {formatTimestamp(report.createdAtUtc)}
        </Text>

        {report.rawText ? (
          <Text
            style={[styles.reportBody, { color: colors.textPrimary }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {report.rawText}
          </Text>
        ) : null}

        <View style={styles.reportFooter}>
          <Text style={[styles.coords, { color: colors.textMuted }]}>
            {report.lat !== 0 || report.lng !== 0
              ? `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`
              : 'NO GPS FIX'}
          </Text>
          {report.syncStatus !== 'PENDING_LOCAL' ? (
            <Text style={[styles.syncPlainText, { color: syncMeta.color }]}>
              {syncMeta.label}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Animated BLE Radar Ring inside the Responder Proximity Card.
 */
function RadarBeacon({ scanning, color }: { scanning: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scanning) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.2],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0],
  });

  return (
    <View style={styles.radarBox}>
      {scanning ? (
        <Animated.View
          style={[
            styles.radarRing,
            {
              borderColor: color,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      ) : null}
      <View style={[styles.radarCore, { backgroundColor: hexToRgba(color, 0.18) }]}>
        <Ionicons name="bluetooth" size={16} color={color} />
      </View>
    </View>
  );
}

export function OutboxScreen({
  reports,
  counts,
  isScanningBle,
  isSyncing,
  bleError,
  terminals,
  onStartScan,
  onStopScan,
  onRelayToTerminal,
  onRetryReport,
  onRefresh,
  onGoToReport,
}: OutboxScreenProps) {
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState<OutboxFilter>('ALL');
  const [selectedReport, setSelectedReport] = useState<LocalReport | null>(null);
  const [retrying, setRetrying] = useState(false);

  const filteredReports = useMemo(() => {
    switch (filter) {
      case 'PENDING':
        return reports.filter((r) => r.syncStatus === 'PENDING_LOCAL' || r.syncStatus === 'SYNCING');
      case 'BLE':
        return reports.filter((r) => r.syncStatus === 'RELAYED_BLE');
      case 'CLOUD':
        return reports.filter((r) => r.syncStatus === 'SENT_CLOUD');
      default:
        return reports;
    }
  }, [reports, filter]);

  const toggleFilter = (target: Exclude<OutboxFilter, 'ALL'>) => {
    void Haptics.selectionAsync();
    setFilter((prev) => (prev === target ? 'ALL' : target));
  };

  const handleScanToggle = () => {
    void Haptics.selectionAsync();
    if (isScanningBle) {
      onStopScan();
    } else {
      onStartScan();
    }
  };

  const handleRetrySelected = async () => {
    if (!selectedReport || retrying) return;
    setRetrying(true);
    try {
      const result = await onRetryReport(selectedReport);
      if (result.ok) {
        setSelectedReport(null);
      }
      Alert.alert(result.ok ? 'Sync Complete' : 'Sync Pending', result.message);
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedReport) return;
    const target = selectedReport;
    Alert.alert(
      'Delete Local Report?',
      `Remove report #${target.incidentIdNum} from your phone outbox?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteReport(target.id);
            setSelectedReport(null);
            onRefresh();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Outbox & Sync</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Tap a status card to filter queued reports
          </Text>
        </View>

        {/* Interactive 3-KPI Spotlight Filter Strip */}
        <View style={styles.kpiRow}>
          <KpiFilterCard
            label="Pending"
            value={counts.pending}
            accentColor={EMERGENCY_COLORS.moderate}
            activeFilter={filter}
            filterKey="PENDING"
            onPress={() => toggleFilter('PENDING')}
          />
          <KpiFilterCard
            label="BLE Relayed"
            value={counts.relayedBle}
            accentColor={EMERGENCY_COLORS.telemetry}
            activeFilter={filter}
            filterKey="BLE"
            onPress={() => toggleFilter('BLE')}
          />
          <KpiFilterCard
            label="Cloud Sent"
            value={counts.sentCloud}
            accentColor={EMERGENCY_COLORS.success}
            activeFilter={filter}
            filterKey="CLOUD"
            onPress={() => toggleFilter('CLOUD')}
          />
        </View>

        {/* Animated BLE Responder Radar Card */}
        <Tactile3DCard offset={4} revealDelayMs={60} contentStyle={styles.bleCardInner}>
          <View style={styles.bleRow}>
            <RadarBeacon scanning={isScanningBle} color={EMERGENCY_COLORS.telemetry} />
            <View style={styles.bleTextCol}>
              <Text style={[styles.bleTitle, { color: colors.textPrimary }]}>
                {isScanningBle ? 'Scanning for Responder Terminals...' : 'Responder BLE Radar'}
              </Text>
              <Text style={[styles.bleSub, { color: colors.textSecondary }]}>
                {bleError
                  ? bleError
                  : isScanningBle
                    ? 'Listening for nearby SALBAR-* T-Beam units'
                    : 'Relays pending reports offline when a T-Beam is near'}
              </Text>
            </View>
            <Tactile3DButton
              onPress={handleScanToggle}
              offset={3}
              backgroundColor={isScanningBle ? colors.bgSurfaceElevated : colors.accentPrimary}
              borderColor={colors.tactileBorder}
              contentStyle={styles.scanBtnInner}
            >
              <Text
                style={[
                  styles.scanBtnText,
                  { color: isScanningBle ? colors.textPrimary : '#FFFFFF' },
                ]}
              >
                {isScanningBle ? 'Stop' : 'Scan'}
              </Text>
            </Tactile3DButton>
          </View>

          {terminals.length > 0 ? (
            <View style={[styles.terminalList, { borderTopColor: colors.borderSubtle }]}>
              {terminals.map((term) => (
                <Pressable
                  key={term.id}
                  disabled={isSyncing}
                  onPress={() => void onRelayToTerminal(term.id)}
                  style={[
                    styles.terminalRow,
                    { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                  ]}
                >
                  <View>
                    <Text style={[styles.terminalName, { color: colors.textPrimary }]}>
                      {term.name}
                    </Text>
                    <Text style={[styles.terminalRssi, { color: EMERGENCY_COLORS.telemetry }]}>
                      RSSI {term.rssi} dBm
                    </Text>
                  </View>
                  <Text style={[styles.terminalAction, { color: colors.accentPrimary }]}>
                    {isSyncing ? 'Relaying...' : 'Send Queued'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Tactile3DCard>

        {/* Feed Section Header */}
        <View style={styles.feedHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {filter === 'ALL'
              ? `Saved Reports (${filteredReports.length})`
              : `${filter} (${filteredReports.length})`}
          </Text>
          {filter !== 'ALL' ? (
            <Pressable onPress={() => setFilter('ALL')}>
              <Text style={[styles.clearFilterText, { color: colors.accentPrimary }]}>
                Show All
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Empty State or Web-Dashboard Style Left-Accent Report Cards */}
        {filteredReports.length === 0 ? (
          <Tactile3DCard offset={4} revealDelayMs={90} contentStyle={styles.emptyCard}>
            <Ionicons
              name={reports.length === 0 ? 'shield-checkmark-outline' : 'filter-outline'}
              size={28}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {reports.length === 0 ? 'Outbox Is Clear' : 'No Matching Reports'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {reports.length === 0
                ? 'Emergency reports you submit are saved locally here first so nothing is lost during blackouts.'
                : 'No reports match the selected filter.'}
            </Text>
            <Tactile3DButton
              onPress={reports.length === 0 ? onGoToReport : () => setFilter('ALL')}
              offset={3}
              borderColor={colors.tactileBorder}
              style={styles.emptyActionBtnWrap}
              contentStyle={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionText}>
                {reports.length === 0 ? 'CREATE EMERGENCY REPORT' : 'SHOW ALL REPORTS'}
              </Text>
            </Tactile3DButton>
          </Tactile3DCard>
        ) : (
          filteredReports.map((report) => (
            <SavedReportCard
              key={report.id}
              report={report}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelectedReport(report);
              }}
            />
          ))
        )}
      </ScrollView>

      {/* Report Detail Modal */}
      <Modal
        visible={selectedReport !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReport(null)}
      >
        {selectedReport ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalOuter}>
              <View
                pointerEvents="none"
                style={[styles.cardShadowBacking, { backgroundColor: colors.tactileShadow }]}
              />
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: colors.bgSurface, borderColor: colors.tactileBorder },
                ]}
              >
                <View style={styles.modalHeroRow}>
                  <View style={styles.modalHeroLeft}>
                    <Text style={[styles.modalEyebrow, { color: colors.textSecondary }]}>
                      REPORT #{selectedReport.incidentIdNum} •{' '}
                      {selectedReport.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                      {getCategoryLabel(selectedReport.category)}
                    </Text>
                  </View>

                  <Tactile3DButton
                    onPress={() => setSelectedReport(null)}
                    offset={2}
                    radius={17}
                    backgroundColor={colors.bgSurfaceElevated}
                    borderColor={colors.tactileBorder}
                    contentStyle={styles.modalCloseIconBtn}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={colors.textPrimary}
                      accessibilityLabel="Close report details"
                    />
                  </Tactile3DButton>
                </View>

                <View style={styles.modalMetricsRow}>
                  <View
                    style={[
                      styles.modalMetricBox,
                      { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                    ]}
                  >
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>SEVERITY</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: getUrgencyColor(selectedReport.urgency) },
                      ]}
                    >
                      {selectedReport.urgency}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.modalMetricBox,
                      { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                    ]}
                  >
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>STATUS</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: getSyncMeta(selectedReport.syncStatus).color },
                      ]}
                    >
                      {getSyncMeta(selectedReport.syncStatus).label}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.modalMetaCard,
                    { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                  ]}
                >
                  <View style={styles.metaSplitRow}>
                    <View style={styles.metaCol}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                        CAPTURED TIME
                      </Text>
                      <Text style={[styles.metricMono, { color: colors.textPrimary }]}>
                        {formatFullDateTime(selectedReport.createdAtUtc)}
                      </Text>
                    </View>
                    <View style={styles.metaColRight}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                        AFFECTED
                      </Text>
                      <Text style={[styles.metricMono, { color: colors.textPrimary }]}>
                        {selectedReport.victimCount}{' '}
                        {selectedReport.victimCount === 1 ? 'person' : 'people'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.metaDivider, { backgroundColor: colors.borderSubtle }]} />

                  <View style={styles.gpsRow}>
                    <View style={styles.metaCol}>
                      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                        GPS COORDINATES
                      </Text>
                      <Text style={[styles.metricMono, { color: EMERGENCY_COLORS.telemetry }]}>
                        {selectedReport.lat !== 0 || selectedReport.lng !== 0
                          ? `${selectedReport.lat.toFixed(5)}, ${selectedReport.lng.toFixed(5)} (+/-${Math.round(selectedReport.accuracyMeters)}m)`
                          : 'No GPS fix recorded'}
                      </Text>
                    </View>
                    {selectedReport.lat !== 0 || selectedReport.lng !== 0 ? (
                      <Tactile3DButton
                        onPress={() => {
                          const url = `geo:${selectedReport.lat},${selectedReport.lng}?q=${selectedReport.lat},${selectedReport.lng}`;
                          void Linking.openURL(url);
                        }}
                        offset={2}
                        backgroundColor={colors.bgSurfaceElevated}
                        borderColor={colors.tactileBorder}
                        contentStyle={styles.mapLinkBtn}
                      >
                        <Ionicons name="map-outline" size={14} color={colors.textPrimary} />
                        <Text style={[styles.mapLinkText, { color: colors.textPrimary }]}>
                          Maps
                        </Text>
                      </Tactile3DButton>
                    ) : null}
                  </View>
                </View>

                <View
                  style={[
                    styles.modalNotesBox,
                    { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    SITUATION NOTES
                  </Text>
                  <ScrollView style={styles.modalNotesScroll} nestedScrollEnabled>
                    <Text style={[styles.modalNotesText, { color: colors.textPrimary }]}>
                      {selectedReport.rawText
                        ? selectedReport.rawText
                        : 'No additional notes provided.'}
                    </Text>
                  </ScrollView>
                </View>

                <View style={styles.modalActions}>
                  <Tactile3DButton
                    onPress={handleDeleteSelected}
                    offset={3}
                    backgroundColor={colors.bgSurfaceElevated}
                    borderColor={colors.tactileBorder}
                    style={styles.modalDeleteBtnWrap}
                    contentStyle={styles.modalDeleteBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={EMERGENCY_COLORS.critical} />
                    <Text style={[styles.modalDeleteText, { color: EMERGENCY_COLORS.critical }]}>
                      Delete
                    </Text>
                  </Tactile3DButton>

                  <Tactile3DButton
                    onPress={() => void handleRetrySelected()}
                    disabled={retrying}
                    offset={3}
                    backgroundColor={colors.accentPrimary}
                    borderColor={colors.tactileBorder}
                    style={styles.modalRetryBtnWrap}
                    contentStyle={styles.modalRetryBtn}
                  >
                    <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.modalRetryText}>
                      {retrying ? 'Syncing...' : 'Retry Sync'}
                    </Text>
                  </Tactile3DButton>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 96,
    gap: 12,
  },
  headerBlock: {
    gap: 2,
  },
  screenTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiWrap: {
    flex: 1,
  },
  kpiOuter: {
    position: 'relative',
  },
  kpiShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: RADII.card,
  },
  kpiCard: {
    borderRadius: RADII.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  kpiValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiLabel: {
    fontFamily: FONTS.displaySemi,
    fontSize: 11,
    fontWeight: '600',
  },
  bleCardInner: {
    padding: 14,
  },
  bleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radarBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
  radarCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleTextCol: {
    flex: 1,
    gap: 2,
  },
  bleTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    fontWeight: '700',
  },
  bleSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  scanBtnInner: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  scanBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    fontWeight: '700',
  },
  terminalList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  terminalRow: {
    borderRadius: RADII.control,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  terminalName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    fontWeight: '700',
  },
  terminalRssi: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  terminalAction: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    fontWeight: '700',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    fontWeight: '700',
  },
  clearFilterText: {
    fontFamily: FONTS.displaySemi,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtnWrap: {
    marginTop: 4,
  },
  emptyActionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyActionText: {
    fontFamily: FONTS.displayBold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportCardOuter: {
    position: 'relative',
  },
  cardShadowBacking: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: RADII.card,
  },
  reportCard: {
    borderRadius: RADII.card,
    borderWidth: 2,
    borderLeftWidth: 5,
    padding: 16,
    gap: 6,
  },
  reportTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reportCategory: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    fontWeight: '700',
  },
  severityText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  syncPlainText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    fontWeight: '700',
  },
  reportMetaLine: {
    fontFamily: FONTS.monoReg,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  reportBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  coords: {
    fontFamily: FONTS.monoReg,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    justifyContent: 'center',
    padding: 18,
  },
  modalOuter: {
    position: 'relative',
    maxHeight: '86%',
  },
  modalCard: {
    borderRadius: RADII.card,
    borderWidth: 2,
    padding: 20,
    gap: 12,
  },
  modalHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalHeroLeft: {
    flex: 1,
    gap: 2,
  },
  modalTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalCloseIconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEyebrow: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 21,
    fontWeight: '700',
  },
  modalMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalMetricBox: {
    flex: 1,
    borderRadius: RADII.control,
    borderWidth: 2,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    fontWeight: '700',
  },
  metricMono: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modalNotesBox: {
    flexShrink: 1,
    borderRadius: RADII.control,
    borderWidth: 2,
    padding: 12,
    gap: 6,
  },
  modalNotesScroll: {
    maxHeight: 150,
  },
  modalMetaCard: {
    borderRadius: RADII.control,
    borderWidth: 2,
    padding: 12,
    gap: 10,
  },
  metaSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaCol: {
    flex: 1,
    gap: 3,
  },
  metaColRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  metaDivider: {
    height: 1,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mapLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapLinkText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    fontWeight: '700',
  },
  modalNotesText: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  modalDeleteBtnWrap: {
    flex: 1,
  },
  modalDeleteBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalDeleteText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    fontWeight: '700',
  },
  modalRetryBtnWrap: {
    flex: 2,
  },
  modalRetryBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalRetryText: {
    fontFamily: FONTS.displayBold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
