import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  CategoryOption,
  getCategoryLabel,
  getUrgencyColor,
  TRIAGE_CATEGORIES,
  URGENCY_OPTIONS,
} from '../constants/triage';
import { createReport } from '../db/reportsRepository';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { GpsReading, IncidentCategory, IncidentUrgency } from '../types/report';
import { getUtf8ByteLength, MAX_RAW_TEXT_BYTES, truncateToUtf8Bytes } from '../utils/utf8';

interface ReportScreenProps {
  gps: GpsReading;
  onReportSaved: () => void;
}

type ReportStage = 1 | 2 | 3;

const STAGE_LABELS: { step: ReportStage; title: string }[] = [
  { step: 1, title: 'Type' },
  { step: 2, title: 'Details' },
  { step: 3, title: 'Confirm' },
];

interface EmergencyTileProps {
  item: CategoryOption;
  onPress: () => void;
}

function EmergencyTile({ item, onPress }: EmergencyTileProps) {
  const { colors } = useAppTheme();
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 7,
      tension: 140,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      friction: 7,
      tension: 120,
      useNativeDriver: false,
    }).start();
  };

  const scale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94],
  });

  const borderColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderSubtle, colors.accentPrimary],
  });

  const backgroundColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.bgSurface, colors.accentSubtle],
  });

  const iconScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={styles.gridTileWrapper}
    >
      <Animated.View
        style={[
          styles.gridTile,
          {
            backgroundColor,
            borderColor,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconCircle,
            {
              backgroundColor: colors.bgSurfaceElevated,
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <Ionicons name={item.icon} size={26} color={colors.accentPrimary} />
        </Animated.View>
        <Text style={[styles.tileLabel, { color: colors.textPrimary }]}>{item.label}</Text>
        <Text style={[styles.tileHint, { color: colors.textSecondary }]}>{item.localHint}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function ReportScreen({ gps, onReportSaved }: ReportScreenProps) {
  const { colors } = useAppTheme();
  const [stage, setStage] = useState<ReportStage>(1);
  const [category, setCategory] = useState<IncidentCategory>('trapped-persons');
  const [urgency, setUrgency] = useState<IncidentUrgency>('CRITICAL');
  const [victimCount, setVictimCount] = useState(1);
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const prevStageRef = useRef<ReportStage>(1);
  const stageFade = useRef(new Animated.Value(1)).current;
  const stageSlide = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1 / 3)).current;

  const byteCount = getUtf8ByteLength(rawText);
  const selectedCategoryObj = TRIAGE_CATEGORIES.find((c) => c.id === category);

  const goToStage = (nextStage: ReportStage) => {
    const direction = nextStage >= prevStageRef.current ? 1 : -1;
    prevStageRef.current = nextStage;
    setStage(nextStage);

    stageFade.setValue(0);
    stageSlide.setValue(direction * 28);

    Animated.parallel([
      Animated.timing(stageFade, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stageSlide, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: nextStage / 3,
        duration: 380,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),
    ]).start();
  };

  useEffect(() => {
    progressAnim.setValue(stage / 3);
  }, []);

  const handleSelectCategory = (selected: IncidentCategory, defaultUrgency: IncidentUrgency) => {
    setCategory(selected);
    setUrgency(defaultUrgency);
    void Haptics.selectionAsync();
    goToStage(2);
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
      goToStage(1);
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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.bgBase }]}>
      <Animated.View
        style={[
          styles.stageAnimatedBody,
          {
            opacity: stageFade,
            transform: [{ translateX: stageSlide }],
          },
        ]}
      >
        {/* STAGE 1: 3x2 Emergency Type Grid */}
        {stage === 1 ? (
          <View style={styles.stageOneContainer}>
            <View style={styles.headerBlock}>
              <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                Emergency Type
              </Text>
              <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                Tap and hold or press a hazard to begin
              </Text>
            </View>

            <View style={styles.grid3x2}>
              {TRIAGE_CATEGORIES.map((item) => (
                <EmergencyTile
                  key={item.id}
                  item={item}
                  onPress={() => handleSelectCategory(item.id, item.defaultUrgency)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* STAGE 2: Urgency Level + Situation Details (fills full height) */}
        {stage === 2 ? (
          <ScrollView
            style={styles.scrollStage}
            contentContainerStyle={styles.scrollFillContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topSection}>
              <View style={styles.stageHeaderRow}>
                <Pressable
                  onPress={() => goToStage(1)}
                  style={[
                    styles.backBtn,
                    { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
                  ]}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                  <Text style={[styles.backText, { color: colors.textPrimary }]}>Back</Text>
                </Pressable>
                <View style={[styles.selectedChip, { backgroundColor: colors.accentSubtle }]}>
                  <Text style={[styles.selectedChipText, { color: colors.accentPrimary }]}>
                    {getCategoryLabel(category)}
                  </Text>
                </View>
              </View>

              <View style={styles.headerBlock}>
                <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                  Urgency & Details
                </Text>
                <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                  Set priority and describe the situation
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Urgency Level</Text>
              <View style={styles.urgencyRow}>
                {URGENCY_OPTIONS.map((opt) => {
                  const selected = opt.id === urgency;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        setUrgency(opt.id);
                        void Haptics.selectionAsync();
                      }}
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
                    Affected Persons
                  </Text>
                  <Text style={[styles.stepperSub, { color: colors.textSecondary }]}>
                    Estimated count needing assistance
                  </Text>
                </View>
                <View style={styles.stepperControls}>
                  <Pressable
                    onPress={() => setVictimCount((v) => Math.max(0, v - 1))}
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.bgSurfaceElevated,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.stepValue, { color: colors.textPrimary }]}>
                    {victimCount}
                  </Text>
                  <Pressable
                    onPress={() => setVictimCount((v) => Math.min(99, v + 1))}
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.bgSurfaceElevated,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.notesFlexBlock}>
                <View style={styles.labelRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                    Situation Notes (EN / TL / CEB)
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
                  value={rawText}
                  onChangeText={handleTextChange}
                  placeholder="Describe landmark or urgent need (e.g., Naay natabunan sa Sitio Riverside)..."
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.textAreaFill,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderSubtle,
                      color: colors.textPrimary,
                    },
                  ]}
                />
              </View>
            </View>

            <Pressable
              onPress={() => goToStage(3)}
              style={[styles.primaryCta, { backgroundColor: colors.accentPrimary }]}
            >
              <Text style={styles.primaryCtaText}>REVIEW & CONFIRM</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </ScrollView>
        ) : null}

        {/* STAGE 3: Confirmation (fills full height) */}
        {stage === 3 ? (
          <ScrollView style={styles.scrollStage} contentContainerStyle={styles.scrollFillContent}>
            <View style={styles.topSection}>
              <View style={styles.stageHeaderRow}>
                <Pressable
                  onPress={() => goToStage(2)}
                  style={[
                    styles.backBtn,
                    { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
                  ]}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                  <Text style={[styles.backText, { color: colors.textPrimary }]}>Edit Details</Text>
                </Pressable>
              </View>

              <View style={styles.headerBlock}>
                <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                  Confirm Report
                </Text>
                <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                  Verify details before saving and sending
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>
                    Emergency Type
                  </Text>
                  <View style={styles.summaryValueRow}>
                    {selectedCategoryObj ? (
                      <Ionicons
                        name={selectedCategoryObj.icon}
                        size={17}
                        color={colors.accentPrimary}
                      />
                    ) : null}
                    <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Urgency</Text>
                  <View
                    style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(urgency) }]}
                  >
                    <Text style={styles.urgencyBadgeText}>{urgency}</Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>
                    Affected Persons
                  </Text>
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                    {victimCount}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>
                    GPS Location
                  </Text>
                  <Text style={[styles.summaryMono, { color: EMERGENCY_COLORS.telemetry }]}>
                    {gps.fixState === 'LOCKED' || gps.fixState === 'LAST_KNOWN'
                      ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
                      : `${gps.fixState} (will still save)`}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

                <View style={styles.notesPreview}>
                  <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>
                    Situation Notes
                  </Text>
                  <Text style={[styles.notesText, { color: colors.textPrimary }]}>
                    {rawText.trim() ? rawText.trim() : 'No additional notes provided.'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.offlineNoticeCard,
                  { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
                ]}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={EMERGENCY_COLORS.success} />
                <Text style={[styles.offlineNoticeText, { color: colors.textSecondary }]}>
                  Saved safely to your phone immediately, then sent via Cloud Relay or BLE when a
                  responder is nearby.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.primaryCta,
                { backgroundColor: colors.accentPrimary, opacity: submitting ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="send" size={17} color="#FFFFFF" />
              <Text style={styles.primaryCtaText}>
                {submitting ? 'SAVING LOCALLY...' : 'SEND EMERGENCY REPORT'}
              </Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </Animated.View>

      {/* Smoothly Animated Bottom 3-Stage Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressTrack, { backgroundColor: colors.borderSubtle }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.accentPrimary,
                width: progressWidth,
              },
            ]}
          />
        </View>
        <View style={styles.stepsRow}>
          {STAGE_LABELS.map((s) => {
            const active = s.step === stage;
            const completed = s.step < stage;
            return (
              <Pressable
                key={s.step}
                disabled={s.step > stage}
                onPress={() => {
                  if (s.step < stage) goToStage(s.step);
                }}
                style={styles.stepIndicator}
              >
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        active || completed ? colors.accentPrimary : colors.borderSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepDotText,
                      { color: active || completed ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {s.step}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: active ? colors.accentPrimary : colors.textSecondary,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}
                >
                  {s.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingBottom: 76,
  },
  stageAnimatedBody: {
    flex: 1,
  },
  stageOneContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  headerBlock: {
    gap: 2,
  },
  stageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  stageSubtitle: {
    fontSize: 13,
  },
  grid3x2: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    rowGap: 10,
  },
  gridTileWrapper: {
    width: '48.3%',
    height: '31.5%',
  },
  gridTile: {
    flex: 1,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileHint: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollStage: {
    flex: 1,
  },
  scrollFillContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 14,
  },
  topSection: {
    flex: 1,
    gap: 12,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  backText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectedChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADII.pill,
  },
  selectedChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urgencyPill: {
    flex: 1,
    minHeight: 46,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepperCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepperSub: {
    fontSize: 11,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  notesFlexBlock: {
    flex: 1,
    gap: 8,
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
  textAreaFill: {
    flex: 1,
    minHeight: 110,
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 16,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  summaryCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryMono: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADII.pill,
  },
  urgencyBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
  },
  notesPreview: {
    gap: 6,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  offlineNoticeCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryCta: {
    minHeight: 56,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
