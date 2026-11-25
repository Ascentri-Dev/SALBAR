import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCategoryLabel, getUrgencyColor } from '../constants/triage';
import { deleteReport } from '../db/reportsRepository';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { LocalReport, ReportCounts } from '../types/report';

interface OutboxScreenProps {
  reports: LocalReport[];
  counts: ReportCounts;
  onRefresh: () => void;
}

export function OutboxScreen({ reports, counts, onRefresh }: OutboxScreenProps) {
  const { colors } = useAppTheme();

  const handleDelete = (report: LocalReport) => {
    Alert.alert(
      'Delete Local Report?',
      `Remove report #${report.incidentIdNum} from local outbox?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteReport(report.id);
            onRefresh();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bgBase }]}
      contentContainerStyle={styles.content}
    >
      {/* 3-KPI Summary Strip */}
      <View style={styles.kpiRow}>
        <View
          style={[
            styles.kpiCard,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.kpiValue, { color: EMERGENCY_COLORS.moderate }]}>
            {counts.pending}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pending</Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.kpiValue, { color: EMERGENCY_COLORS.telemetry }]}>
            {counts.relayedBle}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>BLE Relayed</Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.kpiValue, { color: EMERGENCY_COLORS.success }]}>
            {counts.sentCloud}
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Cloud Sent</Text>
        </View>
      </View>

      {/* BLE Central Scanner Skeleton Card (Phase 4) */}
      <View
        style={[
          styles.bleCard,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.bleHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Nearby Responder Terminals (BLE)
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Phase 4 will scan for SALBAR-* TTGO T-Beam nodes
            </Text>
          </View>
          <Pressable
            onPress={() =>
              Alert.alert('BLE Sync', 'BLE GATT relay will be wired in Phase 4.')
            }
            style={[styles.scanBtn, { backgroundColor: colors.accentPrimary }]}
          >
            <Text style={styles.scanBtnText}>Scan Now</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        Saved Reports ({reports.length})
      </Text>

      {reports.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Local Reports</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Submitted reports are saved offline here first before Cloud or BLE sync.
          </Text>
        </View>
      ) : (
        reports.map((report) => {
          const urgencyColor = getUrgencyColor(report.urgency);
          const shortId = report.id.slice(0, 6).toUpperCase();
          return (
            <Pressable
              key={report.id}
              onLongPress={() => handleDelete(report)}
              style={[
                styles.reportCard,
                { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
              ]}
            >
              <View style={styles.reportTop}>
                <Text style={[styles.reportId, { color: colors.textSecondary }]}>
                  #{report.incidentIdNum} ({shortId})
                </Text>
                <View style={[styles.urgencyChip, { backgroundColor: urgencyColor }]}>
                  <Text style={styles.urgencyChipText}>{report.urgency}</Text>
                </View>
              </View>

              <Text style={[styles.reportCategory, { color: colors.textPrimary }]}>
                {getCategoryLabel(report.category)} | Victims: {report.victimCount}
              </Text>

              {report.rawText ? (
                <Text
                  style={[styles.reportBody, { color: colors.textSecondary }]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {report.rawText}
                </Text>
              ) : null}

              <View style={styles.reportFooter}>
                <Text style={[styles.coords, { color: colors.textMuted }]}>
                  {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                </Text>
                <Text style={[styles.syncBadge, { color: EMERGENCY_COLORS.moderate }]}>
                  {report.syncStatus}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 96 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: {
    flex: 1,
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  bleCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 14,
  },
  bleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { fontSize: 13, fontWeight: '700' },
  cardSub: { fontSize: 11, marginTop: 2 },
  scanBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADII.control,
  },
  scanBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  emptyCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center' },
  reportCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  reportTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportId: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  urgencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  urgencyChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  reportCategory: { fontSize: 14, fontWeight: '700' },
  reportBody: { fontSize: 13 },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  coords: { fontSize: 11, fontVariant: ['tabular-nums'] },
  syncBadge: { fontSize: 11, fontWeight: '700' },
});
