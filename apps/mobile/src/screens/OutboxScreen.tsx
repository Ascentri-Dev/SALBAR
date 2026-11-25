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
  const focusAnim = useRef(new Animated.Value(0)).current;
  const dimAnim = useRef(new Animated.Value(1)).current;

  const isSelected = activeFilter === filterKey;
  const isOtherSelected = activeFilter !== 'ALL' && !isSelected;

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: isSelected ? 1 : 0,
      friction: 6,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [isSelected, focusAnim]);

  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: isOtherSelected ? 0.42 : 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [isOtherSelected, dimAnim]);

  const scale = Animated.add(
    focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
    dimAnim.interpolate({ inputRange: [0.42, 1], outputRange: [-0.04, 0] }),
  );

  return (
    <Pressable onPress={onPress} style={styles.kpiWrap}>
      <Animated.View
        style={[
          styles.kpiCard,
          {
            backgroundColor: colors.bgSurface,
            borderColor: isSelected ? accentColor : colors.borderSubtle,
            borderWidth: isSelected ? 2 : 1,
            opacity: dimAnim,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[styles.kpiValue, { color: accentColor }]}>{value}</Text>
        <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{label}</Text>
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
  onRefresh,
  onGoToReport,
}: OutboxScreenProps) {
  const { colors } = useAppTheme();
  const [filter, setFilter] = useState<OutboxFilter>('ALL');
  const [scanning, setScanning] = useState(false);
  const [selectedReport, setSelectedReport] = useState<LocalReport | null>(null);

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
            <Pressable onPress={() => setFilter('ALL')}>
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
              onPress={reports.length === 0 ? onGoToReport : () => setFilter('ALL')}
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
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
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
  kpiCard: {
    borderRadius: RADII.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
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
