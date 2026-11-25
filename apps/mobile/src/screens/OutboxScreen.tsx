import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  getCategoryLabel,
  getCategoryOption,
  getUrgencyColor,
} from '../constants/triage';
import { deleteReport } from '../db/reportsRepository';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { LocalReport, ReportCounts, SyncStatus } from '../types/report';

interface OutboxScreenProps {
  reports: LocalReport[];
  counts: ReportCounts;
  canUseCloudRelay: boolean;
  forceOffline: boolean;
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
 * 1-to-1 React Native port of web-dashboard KPIStrip metric pill with proportional fill bar.
 */
function MetricPill({
  label,
  value,
  pct,
  pctText,
  toneColor,
  selected,
  onPress,
}: {
  label: string;
  value: number;
  pct: number;
  pctText: string;
  toneColor: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const fillAnim = useRef(new Animated.Value(pct / 100)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct / 100,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, fillAnim]);

  const barWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricPill,
        {
          backgroundColor: selected
            ? isDark
              ? colors.bgSurfaceElevated
              : colors.bgSurface
            : colors.bgSurface,
          borderColor: selected ? colors.accentPrimary : hexToRgba(toneColor, 0.35),
          borderWidth: selected ? 2 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {/* Proportional Occupancy Meter Fill Bar */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.metricFillBar,
          {
            backgroundColor: hexToRgba(toneColor, isDark ? 0.24 : 0.16),
            width: barWidth,
          },
        ]}
      />

      <View style={styles.metricLeft}>
        <Text
          style={[
            styles.metricPillLabel,
            { color: selected ? colors.accentPrimary : colors.textPrimary },
          ]}
        >
          {label}
        </Text>
        <Text style={[styles.metricPctText, { color: colors.textSecondary }]}>{pctText}</Text>
      </View>

      <Text style={[styles.metricCount, { color: toneColor }]}>{value}</Text>
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
  onRefresh,
  onGoToReport,
}: OutboxScreenProps) {
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState<OutboxFilter>('ALL');
  const [scanning, setScanning] = useState(false);
  const [selectedReport, setSelectedReport] = useState<LocalReport | null>(null);

  const getPct = (val: number) => {
    if (counts.total === 0) return 0;
    return Math.round((val / counts.total) * 100);
  };

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

  const selectFilter = (target: OutboxFilter) => {
    void Haptics.selectionAsync();
    setFilter((prev) => (prev === target && target !== 'ALL' ? 'ALL' : target));
  };

  useEffect(() => {
    if (!scanning) return;
    const timer = setTimeout(() => {
      setScanning(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [scanning]);

  const handleScanToggle = () => {
    void Haptics.selectionAsync();
    setScanning((prev) => !prev);
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
    <View style={[styles.root, { backgroundColor: colors.bgBase }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean Header (no Cloud Ready pill) */}
        <View style={styles.headerBlock}>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Outbox & Sync</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Offline storage queue and responder BLE handoff
          </Text>
        </View>

        {/* Web-Dashboard Style METRICS Filter Stack */}
        <View style={styles.metricsSection}>
          <Text style={[styles.metricsEyebrow, { color: colors.accentPrimary }]}>METRICS</Text>
          <View style={styles.metricsList}>
            <MetricPill
              label="TOTAL REPORTS"
              value={counts.total}
              pct={counts.total > 0 ? 100 : 0}
              pctText="All Saved"
              toneColor={colors.textPrimary}
              selected={filter === 'ALL'}
              onPress={() => selectFilter('ALL')}
            />
            <MetricPill
              label="PENDING LOCAL"
              value={counts.pending}
              pct={getPct(counts.pending)}
              pctText={`${getPct(counts.pending)}%`}
              toneColor={EMERGENCY_COLORS.moderate}
              selected={filter === 'PENDING'}
              onPress={() => selectFilter('PENDING')}
            />
            <MetricPill
              label="BLE RELAYED"
              value={counts.relayedBle}
              pct={getPct(counts.relayedBle)}
              pctText={`${getPct(counts.relayedBle)}%`}
              toneColor={EMERGENCY_COLORS.telemetry}
              selected={filter === 'BLE'}
              onPress={() => selectFilter('BLE')}
            />
            <MetricPill
              label="CLOUD SENT"
              value={counts.sentCloud}
              pct={getPct(counts.sentCloud)}
              pctText={`${getPct(counts.sentCloud)}%`}
              toneColor={EMERGENCY_COLORS.success}
              selected={filter === 'CLOUD'}
              onPress={() => selectFilter('CLOUD')}
            />
          </View>
        </View>

        {/* Animated BLE Responder Radar Card */}
        <View
          style={[
            styles.bleCard,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
          ]}
        >
          <View style={styles.bleRow}>
            <RadarBeacon scanning={scanning} color={EMERGENCY_COLORS.telemetry} />
            <View style={styles.bleTextCol}>
              <Text style={[styles.bleTitle, { color: colors.textPrimary }]}>
                {scanning ? 'Scanning for Responder Terminals...' : 'Responder BLE Radar'}
              </Text>
              <Text style={[styles.bleSub, { color: colors.textSecondary }]}>
                {scanning
                  ? 'Listening for nearby SALBAR-* T-Beam units'
                  : 'Relays pending reports offline when a T-Beam is near'}
              </Text>
            </View>
            <Pressable
              onPress={handleScanToggle}
              style={({ pressed }) => [
                styles.scanBtn,
                {
                  backgroundColor: scanning ? colors.bgSurfaceElevated : colors.accentPrimary,
                  borderColor: scanning ? colors.borderSubtle : colors.accentPrimary,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  styles.scanBtnText,
                  { color: scanning ? colors.textPrimary : '#FFFFFF' },
                ]}
              >
                {scanning ? 'Stop' : 'Scan'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Feed Section Header */}
        <View style={styles.feedHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {filter === 'ALL'
              ? `Saved Reports (${filteredReports.length})`
              : `${filter} (${filteredReports.length})`}
          </Text>
          {filter !== 'ALL' ? (
            <Pressable onPress={() => selectFilter('ALL')}>
              <Text style={[styles.clearFilterText, { color: colors.accentPrimary }]}>
                Show All
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Empty State or Web-Dashboard Style Left-Accent Report Cards */}
        {filteredReports.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
            ]}
          >
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
            <Pressable
              onPress={reports.length === 0 ? onGoToReport : () => selectFilter('ALL')}
              style={({ pressed }) => [
                styles.emptyActionBtn,
                {
                  backgroundColor: colors.accentPrimary,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text style={styles.emptyActionText}>
                {reports.length === 0 ? 'CREATE EMERGENCY REPORT' : 'SHOW ALL REPORTS'}
              </Text>
            </Pressable>
          </View>
        ) : (
          filteredReports.map((report) => {
            const catOpt = getCategoryOption(report.category);
            const urgencyColor = getUrgencyColor(report.urgency);
            const syncMeta = getSyncMeta(report.syncStatus);

            return (
              <Pressable
                key={report.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelectedReport(report);
                }}
                style={({ pressed }) => [
                  styles.reportCard,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle,
                    borderLeftColor: catOpt.accentColor,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View style={styles.reportTop}>
                  <Text style={[styles.reportCategory, { color: colors.textPrimary }]}>
                    {getCategoryLabel(report.category)}
                  </Text>
                  <View
                    style={[
                      styles.softBadge,
                      {
                        backgroundColor: hexToRgba(urgencyColor, 0.14),
                        borderColor: hexToRgba(urgencyColor, 0.32),
                      },
                    ]}
                  >
                    <Text style={[styles.softBadgeText, { color: urgencyColor }]}>
                      {report.urgency}
                    </Text>
                  </View>
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
                  <View
                    style={[
                      styles.softBadge,
                      {
                        backgroundColor: hexToRgba(syncMeta.color, 0.12),
                        borderColor: hexToRgba(syncMeta.color, 0.3),
                      },
                    ]}
                  >
                    <Text style={[styles.softBadgeText, { color: syncMeta.color }]}>
                      {syncMeta.label}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
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
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
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
                <View
                  style={[
                    styles.softBadge,
                    {
                      backgroundColor: hexToRgba(getUrgencyColor(selectedReport.urgency), 0.15),
                      borderColor: hexToRgba(getUrgencyColor(selectedReport.urgency), 0.35),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.softBadgeText,
                      { color: getUrgencyColor(selectedReport.urgency) },
                    ]}
                  >
                    {selectedReport.urgency}
                  </Text>
                </View>
              </View>

              <View style={styles.modalMetricsRow}>
                <View
                  style={[
                    styles.modalMetricBox,
                    { backgroundColor: colors.bgBase, borderColor: colors.borderSubtle },
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

                <View
                  style={[
                    styles.modalMetricBox,
                    { backgroundColor: colors.bgBase, borderColor: colors.borderSubtle },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    GPS & TIME
                  </Text>
                  <Text style={[styles.metricMono, { color: colors.textPrimary }]} numberOfLines={1}>
                    {formatTimestamp(selectedReport.createdAtUtc)} •{' '}
                    {selectedReport.lat !== 0
                      ? `${selectedReport.lat.toFixed(4)}, ${selectedReport.lng.toFixed(4)}`
                      : 'NO FIX'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.modalNotesBox,
                  { backgroundColor: colors.bgBase, borderColor: colors.borderSubtle },
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
                <Pressable
                  onPress={handleDeleteSelected}
                  style={[
                    styles.modalDeleteBtn,
                    { borderColor: hexToRgba(EMERGENCY_COLORS.critical, 0.5) },
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={EMERGENCY_COLORS.critical} />
                  <Text style={[styles.modalDeleteText, { color: EMERGENCY_COLORS.critical }]}>
                    Delete
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Alert.alert(
                      'Sync Queued',
                      'Automatic Cloud Relay & BLE transfer will be wired in Phase 4.',
                    );
                  }}
                  style={[styles.modalRetryBtn, { backgroundColor: colors.accentPrimary }]}
                >
                  <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.modalRetryText}>Retry Sync</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedReport(null)}
                  style={[
                    styles.modalCloseBtn,
                    { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
                  ]}
                >
                  <Text style={[styles.modalCloseText, { color: colors.textPrimary }]}>Close</Text>
                </Pressable>
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 13,
  },
  metricsSection: {
    gap: 8,
  },
  metricsEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    paddingHorizontal: 4,
  },
  metricsList: {
    gap: 8,
  },
  metricPill: {
    height: 52,
    borderRadius: RADII.pill,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  metricFillBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: RADII.pill,
  },
  metricLeft: {
    gap: 1,
  },
  metricPillLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  metricPctText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricCount: {
    fontSize: 19,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bleCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
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
    fontSize: 13,
    fontWeight: '700',
  },
  bleSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  scanBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADII.pill,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reportCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    borderLeftWidth: 4,
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
    fontSize: 15,
    fontWeight: '800',
  },
  softBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  softBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  reportMetaLine: {
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
  modalCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 20,
    gap: 14,
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
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  modalMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalMetricBox: {
    flex: 1,
    borderRadius: RADII.control,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricMono: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modalNotesBox: {
    borderRadius: RADII.control,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  modalNotesScroll: {
    maxHeight: 110,
  },
  modalNotesText: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalDeleteBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  modalDeleteText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalRetryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalRetryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalCloseBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
