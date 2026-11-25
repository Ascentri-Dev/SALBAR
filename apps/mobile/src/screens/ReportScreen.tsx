import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { TRIAGE_CATEGORIES, URGENCY_OPTIONS } from '../constants/triage';
import { createReport } from '../db/reportsRepository';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { GpsReading, IncidentCategory, IncidentUrgency } from '../types/report';
import { getUtf8ByteLength, MAX_RAW_TEXT_BYTES, truncateToUtf8Bytes } from '../utils/utf8';

interface ReportScreenProps {
  gps: GpsReading;
  onReportSaved: () => void;
}

export function ReportScreen({ gps, onReportSaved }: ReportScreenProps) {
  const { colors } = useAppTheme();
  const [category, setCategory] = useState<IncidentCategory>('trapped-persons');
  const [urgency, setUrgency] = useState<IncidentUrgency>('CRITICAL');
  const [victimCount, setVictimCount] = useState(1);
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const byteCount = getUtf8ByteLength(rawText);

  const handleSelectCategory = (selected: IncidentCategory, defaultUrgency: IncidentUrgency) => {
    setCategory(selected);
    setUrgency(defaultUrgency);
  };

  const handleTextChange = (text: string) => {
    setRawText(truncateToUtf8Bytes(text, MAX_RAW_TEXT_BYTES));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const saved = await createReport({
        category,
        urgency,
        victimCount,
        rawText,
        lat: gps.lat,
        lng: gps.lng,
        accuracyMeters: gps.accuracyMeters,
        posAgeS: gps.posAgeS,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRawText('');
      setVictimCount(1);
      onReportSaved();
      Alert.alert(
        'Report Saved Offline',
        `ID #${saved.incidentIdNum} stored locally and queued for Cloud / BLE relay.`,
      );
    } catch (err) {
      Alert.alert('Save Error', err instanceof Error ? err.message : 'Failed to save report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bgBase }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        1. Select Emergency Type
      </Text>
      <View style={styles.grid}>
        {TRIAGE_CATEGORIES.map((item) => {
          const selected = item.id === category;
          return (
            <Pressable
              key={item.id}
              onPress={() => handleSelectCategory(item.id, item.defaultUrgency)}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: selected ? colors.accentSubtle : colors.bgSurface,
                  borderColor: selected ? colors.accentPrimary : colors.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.categoryLabel, { color: colors.textPrimary }]}>
                {item.label}
              </Text>
              <Text style={[styles.categoryHint, { color: colors.textSecondary }]}>
                {item.localHint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Urgency Level</Text>
      <View style={styles.urgencyRow}>
        {URGENCY_OPTIONS.map((opt) => {
          const selected = opt.id === urgency;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setUrgency(opt.id)}
              style={[
                styles.urgencyPill,
                {
                  backgroundColor: selected ? opt.color : colors.bgSurface,
                  borderColor: selected ? opt.color : colors.borderSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.urgencyText,
                  { color: selected ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.stepperCard,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <View>
          <Text style={[styles.stepperTitle, { color: colors.textPrimary }]}>
            Estimated Affected Persons
          </Text>
          <Text style={[styles.stepperSub, { color: colors.textSecondary }]}>
            Tap + / - to adjust victim count
          </Text>
        </View>
        <View style={styles.stepperControls}>
          <Pressable
            onPress={() => setVictimCount((v) => Math.max(0, v - 1))}
            style={[
              styles.stepBtn,
              { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
            ]}
          >
            <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>-</Text>
          </Pressable>
          <Text style={[styles.stepValue, { color: colors.textPrimary }]}>{victimCount}</Text>
          <Pressable
            onPress={() => setVictimCount((v) => Math.min(99, v + 1))}
            style={[
              styles.stepBtn,
              { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
            ]}
          >
            <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          3. Situation Details (EN / TL / CEB)
        </Text>
        <Text
          style={[
            styles.byteCounter,
            {
              color:
                byteCount >= MAX_RAW_TEXT_BYTES
                  ? EMERGENCY_COLORS.critical
                  : colors.textSecondary,
            },
          ]}
        >
          {byteCount} / {MAX_RAW_TEXT_BYTES} bytes
        </Text>
      </View>
      <TextInput
        multiline
        numberOfLines={3}
        value={rawText}
        onChangeText={handleTextChange}
        placeholder="Describe landmark or urgent need (e.g., Naay natabunan sa Sitio Riverside)..."
        placeholderTextColor={colors.textMuted}
        style={[
          styles.textArea,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            color: colors.textPrimary,
          },
        ]}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={[
          styles.submitBtn,
          { backgroundColor: colors.accentPrimary, opacity: submitting ? 0.7 : 1 },
        ]}
      >
        <Text style={styles.submitText}>
          {submitting ? 'SAVING LOCALLY...' : 'SAVE & SEND REPORT'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48.3%',
    minHeight: 88,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  categoryLabel: { fontSize: 14, fontWeight: '700' },
  categoryHint: { fontSize: 11, fontWeight: '500' },
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyText: { fontSize: 11, fontWeight: '800' },
  stepperCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperTitle: { fontSize: 13, fontWeight: '700' },
  stepperSub: { fontSize: 11, marginTop: 2 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: RADII.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontWeight: '700' },
  stepValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  byteCounter: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  textArea: {
    minHeight: 88,
    borderRadius: RADII.control,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitBtn: {
    minHeight: 56,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
