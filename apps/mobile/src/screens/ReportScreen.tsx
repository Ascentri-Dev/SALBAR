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
  getCategoryOption,
  getUrgencyColor,
  TRIAGE_CATEGORIES,
  URGENCY_OPTIONS,
  UrgencyOption,
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

/**
 * Stage 1 Tile: Unique color-coded identity container (no icon), crisp header + subheading,
 * and tactile spring scale + zoom-in press feedback.
 */
function EmergencyTile({ item, onPress }: { item: CategoryOption; onPress: () => void }) {
  const { colors, isDark } = useAppTheme();
  const pressAnim = useRef(new Animated.Value(0)).current;

  const baseTint = isDark ? item.tintDark : item.tintLight;

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 6,
      tension: 160,
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
    outputRange: [1, 0.93],
  });

  const borderColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [item.accentColor, colors.textPrimary],
  });

  const barWidth = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['28%', '100%'],
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
            backgroundColor: colors.bgSurface,
            borderColor,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Subtle category identity tint layer */}
        <View style={[styles.tileTintOverlay, { backgroundColor: baseTint }]} />

        {/* Top Tag Pill */}
        <View style={styles.tileTopRow}>
          <View style={[styles.tagPill, { backgroundColor: item.accentColor }]}>
            <Text style={styles.tagPillText}>{item.tag}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={item.accentColor} />
        </View>

        {/* Crisp Header & Subheading */}
        <View style={styles.tileTextBlock}>
          <Text style={[styles.tileLabel, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.label}
          </Text>
          <Text style={[styles.tileHint, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.localHint}
          </Text>
        </View>

        {/* Bottom Identity Accent Bar */}
        <View style={[styles.tileAccentTrack, { backgroundColor: colors.borderSubtle }]}>
          <Animated.View
            style={[
              styles.tileAccentBar,
              { backgroundColor: item.accentColor, width: barWidth },
            ]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Animated Urgency Pill with spring pop on select.
 */
function AnimatedUrgencyPill({
  opt,
  selected,
  onPress,
}: {
  opt: UrgencyOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const scale = useRef(new Animated.Value(selected ? 1.03 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.04 : 1,
      friction: 5,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Pressable
      onPress={() => {
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 0.9,
            duration: 70,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1.04,
            friction: 5,
            tension: 160,
            useNativeDriver: true,
          }),
        ]).start();
        onPress();
      }}
      style={styles.urgencyPillWrap}
    >
      <Animated.View
        style={[
          styles.urgencyPill,
          {
            backgroundColor: selected ? opt.color : colors.bgSurface,
            borderColor: selected ? opt.color : colors.borderSubtle,
            transform: [{ scale }],
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
      </Animated.View>
    </Pressable>
  );
}

/**
 * Animated Arrow Connector between progress stages (Type ---> Details ---> Confirm)
 */
function ArrowConnector({ filled }: { filled: boolean }) {
  const { colors } = useAppTheme();
  const fillAnim = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: filled ? 1 : 0,
      duration: 360,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [filled, fillAnim]);

  const shaftWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.arrowConnector}>
      <View style={[styles.arrowShaftTrack, { backgroundColor: colors.borderSubtle }]}>
        <Animated.View
          style={[
            styles.arrowShaftFill,
            { backgroundColor: colors.accentPrimary, width: shaftWidth },
          ]}
        />
      </View>
      <Ionicons
        name="chevron-forward"
        size={15}
        color={filled ? colors.accentPrimary : colors.textMuted}
        style={styles.arrowHead}
      />
    </View>
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
  const [notesFocused, setNotesFocused] = useState(false);

  const prevStageRef = useRef<ReportStage>(1);
  const stageFade = useRef(new Animated.Value(1)).current;
  const stageScale = useRef(new Animated.Value(1)).current;
  const countBounce = useRef(new Animated.Value(1)).current;
  const notesBorderAnim = useRef(new Animated.Value(0)).current;

  const byteCount = getUtf8ByteLength(rawText);
  const selectedCategoryObj = getCategoryOption(category);

  const goToStage = (nextStage: ReportStage) => {
    const isForward = nextStage >= prevStageRef.current;
    prevStageRef.current = nextStage;
    setStage(nextStage);

    // Dynamic "door-open / zoom-in" transition
    stageFade.setValue(0);
    stageScale.setValue(isForward ? 0.86 : 1.08);

    Animated.parallel([
      Animated.timing(stageFade, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(stageScale, {
        toValue: 1,
        friction: 7,
        tension: 95,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const bumpVictimCount = (delta: number) => {
    setVictimCount((v) => Math.max(0, Math.min(99, v + delta)));
    void Haptics.selectionAsync();
    countBounce.setValue(1.3);
    Animated.spring(countBounce, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    Animated.timing(notesBorderAnim, {
      toValue: notesFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [notesFocused, notesBorderAnim]);

  const notesBorderColor = notesBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderSubtle, colors.accentPrimary],
  });

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

  return (
    <View style={[styles.root, { backgroundColor: colors.bgBase }]}>
      <Animated.View
        style={[
          styles.stageAnimatedBody,
          {
            opacity: stageFade,
            transform: [{ scale: stageScale }],
          },
        ]}
      >
        {/* STAGE 1: 3x2 Unique Identity Emergency Type Grid */}
        {stage === 1 ? (
          <View style={styles.stageOneContainer}>
            <View style={styles.headerBlock}>
              <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                Emergency Type
              </Text>
              <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                Select a hazard card to open report details
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

        {/* STAGE 2: Urgency Level + Situation Details */}
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
                  style={({ pressed }) => [
                    styles.backBtn,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderSubtle,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                  <Text style={[styles.backText, { color: colors.textPrimary }]}>Back</Text>
                </Pressable>
                <View
                  style={[
                    styles.selectedChip,
                    { backgroundColor: selectedCategoryObj.accentColor },
                  ]}
                >
                  <Text style={styles.selectedChipText}>{selectedCategoryObj.label}</Text>
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
                {URGENCY_OPTIONS.map((opt) => (
                  <AnimatedUrgencyPill
                    key={opt.id}
                    opt={opt}
                    selected={opt.id === urgency}
                    onPress={() => {
                      setUrgency(opt.id);
                      void Haptics.selectionAsync();
                    }}
                  />
                ))}
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
                    onPress={() => bumpVictimCount(-1)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      {
                        backgroundColor: colors.bgSurfaceElevated,
                        borderColor: colors.borderSubtle,
                        transform: [{ scale: pressed ? 0.88 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Animated.Text
                    style={[
                      styles.stepValue,
                      { color: colors.textPrimary, transform: [{ scale: countBounce }] },
                    ]}
                  >
                    {victimCount}
                  </Animated.Text>
                  <Pressable
                    onPress={() => bumpVictimCount(1)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      {
                        backgroundColor: colors.bgSurfaceElevated,
                        borderColor: colors.borderSubtle,
                        transform: [{ scale: pressed ? 0.88 : 1 }],
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

                <Animated.View
                  style={[
                    styles.textAreaContainer,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: notesBorderColor,
                    },
                  ]}
                >
                  <TextInput
                    multiline
                    value={rawText}
                    onChangeText={handleTextChange}
                    onFocus={() => setNotesFocused(true)}
                    onBlur={() => setNotesFocused(false)}
                    placeholder="Describe landmark or urgent need (e.g., Naay natabunan sa Sitio Riverside)..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textAreaFill, { color: colors.textPrimary }]}
                  />
                </Animated.View>
              </View>
            </View>

            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                goToStage(3);
              }}
              style={({ pressed }) => [
                styles.primaryCta,
                {
                  backgroundColor: colors.accentPrimary,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={styles.primaryCtaText}>REVIEW & CONFIRM</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </ScrollView>
        ) : null}

        {/* STAGE 3: Confirmation */}
        {stage === 3 ? (
          <ScrollView style={styles.scrollStage} contentContainerStyle={styles.scrollFillContent}>
            <View style={styles.topSection}>
              <View style={styles.stageHeaderRow}>
                <Pressable
                  onPress={() => goToStage(2)}
                  style={({ pressed }) => [
                    styles.backBtn,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderSubtle,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
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
                  <View
                    style={[
                      styles.summaryCatPill,
                      { backgroundColor: selectedCategoryObj.accentColor },
                    ]}
                  >
                    <Text style={styles.summaryCatText}>{getCategoryLabel(category)}</Text>
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
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={EMERGENCY_COLORS.success}
                />
                <Text style={[styles.offlineNoticeText, { color: colors.textSecondary }]}>
                  Saved safely to your phone immediately, then sent via Cloud Relay or BLE when a
                  responder is nearby.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.primaryCta,
                {
                  backgroundColor: colors.accentPrimary,
                  opacity: submitting ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
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

      {/* Animated Arrow Flow Progress Bar: Type ---> Details ---> Confirm */}
      <View style={styles.arrowBarContainer}>
        {STAGE_LABELS.map((s, idx) => {
          const active = s.step === stage;
          const completed = s.step < stage;
          const highlighted = active || completed;
          const isLast = idx === STAGE_LABELS.length - 1;
          return (
            <View
              key={s.step}
              style={isLast ? styles.arrowBarSegmentEnd : styles.arrowBarSegment}
            >
              <Pressable
                disabled={s.step > stage}
                onPress={() => {
                  if (s.step < stage) goToStage(s.step);
                }}
                style={[
                  styles.stagePill,
                  {
                    backgroundColor: active
                      ? colors.accentPrimary
                      : completed
                        ? colors.accentSubtle
                        : colors.bgSurface,
                    borderColor: highlighted ? colors.accentPrimary : colors.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stagePillText,
                    {
                      color: active
                        ? '#FFFFFF'
                        : completed
                          ? colors.accentPrimary
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {completed ? `✓ ${s.title}` : s.title}
                </Text>
              </Pressable>

              {idx < STAGE_LABELS.length - 1 ? (
                <ArrowConnector filled={stage > s.step} />
              ) : null}
            </View>
          );
        })}
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
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tileTintOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  tileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  tagPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  tileTextBlock: {
    gap: 3,
  },
  tileLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tileHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileAccentTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tileAccentBar: {
    height: '100%',
    borderRadius: 2,
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
    color: '#FFFFFF',
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
  urgencyPillWrap: {
    flex: 1,
  },
  urgencyPill: {
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
    minWidth: 26,
    textAlign: 'center',
    fontSize: 18,
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
  textAreaContainer: {
    flex: 1,
    minHeight: 110,
    borderRadius: RADII.card,
    borderWidth: 1.5,
  },
  textAreaFill: {
    flex: 1,
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
  summaryCatPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADII.pill,
  },
  summaryCatText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
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
  arrowBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  arrowBarSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBarSegmentEnd: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stagePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  arrowConnector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  arrowShaftTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  arrowShaftFill: {
    height: '100%',
    borderRadius: 2,
  },
  arrowHead: {
    marginLeft: -4,
  },
});
