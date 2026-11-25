import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
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
  TileTexture,
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
  { step: 2, title: 'Urgency' },
  { step: 3, title: 'Notes' },
];

const VICTIM_PRESETS = [1, 5, 10, 20];

/**
 * Renders subtle geometric background textures unique to each emergency type.
 */
function ContainerTexture({ texture, color }: { texture: TileTexture; color: string }) {
  switch (texture) {
    case 'stripes':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.stripeLine,
                {
                  backgroundColor: color,
                  right: -20 + i * 22,
                },
              ]}
            />
          ))}
        </View>
      );
    case 'cross':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          <View style={[styles.crossVert, { backgroundColor: color }]} />
          <View style={[styles.crossHoriz, { backgroundColor: color }]} />
        </View>
      );
    case 'waves':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          <View style={[styles.waveRingLg, { borderColor: color }]} />
          <View style={[styles.waveRingSm, { borderColor: color }]} />
        </View>
      );
    case 'grid':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          <View style={[styles.gridLineH1, { backgroundColor: color }]} />
          <View style={[styles.gridLineH2, { backgroundColor: color }]} />
          <View style={[styles.gridLineV1, { backgroundColor: color }]} />
          <View style={[styles.gridLineV2, { backgroundColor: color }]} />
        </View>
      );
    case 'slope':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          <View style={[styles.slopeBand1, { backgroundColor: color }]} />
          <View style={[styles.slopeBand2, { backgroundColor: color }]} />
        </View>
      );
    case 'dots':
      return (
        <View pointerEvents="none" style={[styles.textureLayer, styles.dotsCluster]}>
          {Array.from({ length: 9 }).map((_, idx) => (
            <View key={idx} style={[styles.dotMatrixItem, { backgroundColor: color }]} />
          ))}
        </View>
      );
  }
}

/**
 * Stage 1 Tile: Pure typography + unique color & geometric texture, zero pills/icons/arrows.
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
    outputRange: [1, 0.94],
  });

  const borderColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [item.accentColor, colors.textPrimary],
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
        <View style={[styles.tileTintOverlay, { backgroundColor: baseTint }]} />
        <ContainerTexture texture={item.texture} color={item.accentColor} />

        <View style={styles.tileTextBlock}>
          <Text style={[styles.tileLabel, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.label}
          </Text>
          <Text style={[styles.tileHint, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.localHint}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * 2x2 Urgency Grid Card with spring pop animation.
 */
function UrgencyGridCard({
  opt,
  selected,
  onPress,
}: {
  opt: UrgencyOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const scale = useRef(new Animated.Value(selected ? 1.02 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.02 : 1,
      friction: 6,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Pressable
      onPress={() => {
        Animated.sequence([
          Animated.timing(scale, { toValue: 0.93, duration: 70, useNativeDriver: true }),
          Animated.spring(scale, {
            toValue: 1.02,
            friction: 5,
            tension: 160,
            useNativeDriver: true,
          }),
        ]).start();
        onPress();
      }}
      style={styles.urgencyGridWrap}
    >
      <Animated.View
        style={[
          styles.urgencyGridCard,
          {
            backgroundColor: selected ? opt.color : colors.bgSurface,
            borderColor: selected ? opt.color : colors.borderSubtle,
            transform: [{ scale }],
          },
        ]}
      >
        <Text
          style={[
            styles.urgencyCardLabel,
            { color: selected ? '#FFFFFF' : opt.color },
          ]}
        >
          {opt.label}
        </Text>
        <Text
          style={[
            styles.urgencyCardSub,
            { color: selected ? 'rgba(255,255,255,0.9)' : colors.textSecondary },
          ]}
        >
          {opt.subtitle}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Animated Arrow Connector: Type ---> Urgency ---> Notes
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
  const [victimCountText, setVictimCountText] = useState('1');
  const [rawText, setRawText] = useState('');
  const [notesFocused, setNotesFocused] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const prevStageRef = useRef<ReportStage>(1);
  const stageFade = useRef(new Animated.Value(1)).current;
  const stageScale = useRef(new Animated.Value(1)).current;
  const notesBorderAnim = useRef(new Animated.Value(0)).current;

  const parsedVictimCount = Math.max(0, Math.min(999, parseInt(victimCountText || '0', 10) || 0));
  const byteCount = getUtf8ByteLength(rawText);
  const selectedCategoryObj = getCategoryOption(category);

  const goToStage = (nextStage: ReportStage) => {
    const isForward = nextStage >= prevStageRef.current;
    prevStageRef.current = nextStage;
    setStage(nextStage);

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

  const adjustVictimCount = (delta: number) => {
    const next = Math.max(0, Math.min(999, parsedVictimCount + delta));
    setVictimCountText(String(next));
    void Haptics.selectionAsync();
  };

  const handleVictimTextChange = (value: string) => {
    const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 3);
    setVictimCountText(digitsOnly);
  };

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
        victimCount: parsedVictimCount,
        rawText,
        lat: gps.lat,
        lng: gps.lng,
        accuracyMeters: gps.accuracyMeters,
        posAgeS: gps.posAgeS,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmOpen(false);
      setRawText('');
      setVictimCountText('1');
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
        {/* STAGE 1: Emergency Type (3x2 Textured Identity Grid) */}
        {stage === 1 ? (
          <View style={styles.stageContainer}>
            <View style={styles.headerBlock}>
              <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                Emergency Type
              </Text>
              <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                Tap the hazard that matches the emergency
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

        {/* STAGE 2: Urgency Level (2x2 Grid) + Affected Persons */}
        {stage === 2 ? (
          <ScrollView
            style={styles.scrollStage}
            contentContainerStyle={styles.scrollFillContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topSection}>
              <View style={styles.headerBlock}>
                <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                  Urgency & Impact
                </Text>
                <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                  Select priority level and people affected
                </Text>
              </View>

              {/* 2x2 Urgency Grid */}
              <View style={styles.urgencyGrid}>
                {URGENCY_OPTIONS.map((opt) => (
                  <UrgencyGridCard
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

              {/* UX-Friendly Affected Persons Card */}
              <View
                style={[
                  styles.peopleCard,
                  { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
                ]}
              >
                <View style={styles.peopleHeader}>
                  <Text style={[styles.peopleTitle, { color: colors.textPrimary }]}>
                    Affected Persons
                  </Text>
                  <Text style={[styles.peopleSub, { color: colors.textSecondary }]}>
                    Type exact count or tap quick increments
                  </Text>
                </View>

                <View style={styles.peopleInputRow}>
                  <Pressable
                    onPress={() => adjustVictimCount(-1)}
                    style={({ pressed }) => [
                      styles.adjBtn,
                      {
                        backgroundColor: colors.bgSurfaceElevated,
                        borderColor: colors.borderSubtle,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.adjBtnText, { color: colors.textPrimary }]}>-1</Text>
                  </Pressable>

                  <TextInput
                    value={victimCountText}
                    onChangeText={handleVictimTextChange}
                    keyboardType="number-pad"
                    maxLength={3}
                    selectTextOnFocus
                    style={[
                      styles.peopleInput,
                      {
                        backgroundColor: colors.bgBase,
                        borderColor: colors.borderSubtle,
                        color: colors.textPrimary,
                      },
                    ]}
                  />

                  <Pressable
                    onPress={() => adjustVictimCount(1)}
                    style={({ pressed }) => [
                      styles.adjBtn,
                      {
                        backgroundColor: colors.bgSurfaceElevated,
                        borderColor: colors.borderSubtle,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.adjBtnText, { color: colors.textPrimary }]}>+1</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => adjustVictimCount(10)}
                    style={({ pressed }) => [
                      styles.adjBtn,
                      {
                        backgroundColor: colors.accentSubtle,
                        borderColor: colors.accentPrimary,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.adjBtnText, { color: colors.accentPrimary }]}>+10</Text>
                  </Pressable>
                </View>

                <View style={styles.presetsRow}>
                  {VICTIM_PRESETS.map((preset) => {
                    const isPresetActive = parsedVictimCount === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => {
                          setVictimCountText(String(preset));
                          void Haptics.selectionAsync();
                        }}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isPresetActive
                              ? colors.accentPrimary
                              : colors.bgSurfaceElevated,
                            borderColor: isPresetActive
                              ? colors.accentPrimary
                              : colors.borderSubtle,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetText,
                            { color: isPresetActive ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          {preset === 20 ? '20+' : `${preset}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
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
              <Text style={styles.primaryCtaText}>NEXT: SITUATION NOTES</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </ScrollView>
        ) : null}

        {/* STAGE 3: Massive Notes Box + Voice Indicator */}
        {stage === 3 ? (
          <ScrollView
            style={styles.scrollStage}
            contentContainerStyle={styles.scrollFillContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topSection}>
              <View style={styles.notesHeaderRow}>
                <View style={styles.headerBlock}>
                  <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                    Situation Notes
                  </Text>
                  <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                    Type in English, Tagalog, or Cebuano
                  </Text>
                </View>
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
                  {byteCount}/{MAX_RAW_TEXT_BYTES}B
                </Text>
              </View>

              <Animated.View
                style={[
                  styles.massiveNotesBox,
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
                  placeholder="Describe landmarks, hazards, or urgent needs (e.g., Naay natabunan sa Sitio Riverside, tabang!)..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.massiveTextInput, { color: colors.textPrimary }]}
                />

                {/* Voice Input Indicator Bar (Upcoming Feature) */}
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Voice Reporting',
                      'Offline voice-to-text input is an upcoming feature for residents.',
                    )
                  }
                  style={[
                    styles.voiceBar,
                    {
                      backgroundColor: colors.bgSurfaceElevated,
                      borderTopColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <View style={[styles.micBadge, { backgroundColor: colors.accentSubtle }]}>
                    <Ionicons name="mic-outline" size={18} color={colors.accentPrimary} />
                  </View>
                  <View style={styles.voiceTextCol}>
                    <Text style={[styles.voiceTitle, { color: colors.textPrimary }]}>
                      Type or Use Voice Input
                    </Text>
                    <Text style={[styles.voiceSub, { color: colors.textSecondary }]}>
                      Voice-to-text transcription (Upcoming Feature)
                    </Text>
                  </View>
                  <View style={[styles.soonBadge, { borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.soonText, { color: colors.textSecondary }]}>SOON</Text>
                  </View>
                </Pressable>
              </Animated.View>
            </View>

            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setConfirmOpen(true);
              }}
              style={({ pressed }) => [
                styles.primaryCta,
                {
                  backgroundColor: colors.accentPrimary,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={styles.primaryCtaText}>REVIEW & SEND</Text>
              <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
            </Pressable>
          </ScrollView>
        ) : null}
      </Animated.View>

      {/* Bottom Arrow Progress Bar: Type ---> Urgency ---> Notes */}
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
                  if (s.step < stage) {
                    void Haptics.selectionAsync();
                    goToStage(s.step);
                  }
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
                  {s.title}
                </Text>
              </Pressable>

              {!isLast ? <ArrowConnector filled={stage > s.step} /> : null}
            </View>
          );
        })}
      </View>

      {/* Pop-up Confirmation Modal */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Confirm Emergency Report
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Saved offline immediately, then sent via Cloud Relay or BLE.
            </Text>

            <View
              style={[
                styles.modalSummary,
                { backgroundColor: colors.bgBase, borderColor: colors.borderSubtle },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Type</Text>
                <View style={styles.summaryCatRow}>
                  <View
                    style={[
                      styles.catDot,
                      { backgroundColor: selectedCategoryObj.accentColor },
                    ]}
                  />
                  <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                    {getCategoryLabel(category)}
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Urgency</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(urgency) }]}>
                  <Text style={styles.urgencyBadgeText}>{urgency}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>
                  Affected Persons
                </Text>
                <Text style={[styles.summaryVal, { color: colors.textPrimary }]}>
                  {parsedVictimCount}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>GPS</Text>
                <Text style={[styles.summaryMono, { color: EMERGENCY_COLORS.telemetry }]}>
                  {gps.fixState === 'LOCKED' || gps.fixState === 'LAST_KNOWN'
                    ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
                    : `${gps.fixState} (saved anyway)`}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.notesPreview}>
                <Text style={[styles.summaryKey, { color: colors.textSecondary }]}>Notes</Text>
                <Text style={[styles.notesText, { color: colors.textPrimary }]}>
                  {rawText.trim() ? rawText.trim() : 'No additional notes provided.'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmOpen(false)}
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: colors.bgSurfaceElevated, borderColor: colors.borderSubtle },
                ]}
              >
                <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>Edit</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={[
                  styles.modalSendBtn,
                  { backgroundColor: colors.accentPrimary, opacity: submitting ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.modalSendText}>
                  {submitting ? 'SAVING...' : 'CONFIRM & SEND'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  stageContainer: {
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
    padding: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tileTintOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  textureLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.14,
  },
  stripeLine: {
    position: 'absolute',
    top: -30,
    width: 10,
    height: 180,
    transform: [{ rotate: '28deg' }],
  },
  crossVert: {
    position: 'absolute',
    top: 14,
    right: 26,
    width: 14,
    height: 46,
    borderRadius: 4,
  },
  crossHoriz: {
    position: 'absolute',
    top: 30,
    right: 10,
    width: 46,
    height: 14,
    borderRadius: 4,
  },
  waveRingLg: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 8,
  },
  waveRingSm: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 6,
  },
  gridLineH1: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    height: 2,
  },
  gridLineH2: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    height: 2,
  },
  gridLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 28,
    width: 2,
  },
  gridLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 60,
    width: 2,
  },
  slopeBand1: {
    position: 'absolute',
    top: -10,
    right: -20,
    width: 110,
    height: 28,
    transform: [{ rotate: '-22deg' }],
  },
  slopeBand2: {
    position: 'absolute',
    top: 30,
    right: -30,
    width: 110,
    height: 18,
    transform: [{ rotate: '-22deg' }],
  },
  dotsCluster: {
    top: 14,
    right: 14,
    left: undefined,
    bottom: undefined,
    width: 42,
    height: 42,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dotMatrixItem: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tileTextBlock: {
    gap: 3,
  },
  tileLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tileHint: {
    fontSize: 12,
    fontWeight: '600',
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
    gap: 14,
  },
  urgencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  urgencyGridWrap: {
    width: '48.3%',
  },
  urgencyGridCard: {
    minHeight: 102,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    padding: 16,
    justifyContent: 'center',
    gap: 4,
  },
  urgencyCardLabel: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  urgencyCardSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  peopleCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  peopleHeader: {
    gap: 2,
  },
  peopleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  peopleSub: {
    fontSize: 12,
  },
  peopleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjBtn: {
    minWidth: 48,
    height: 46,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  adjBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  peopleInput: {
    flex: 1,
    height: 46,
    borderRadius: RADII.pill,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    height: 36,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  byteCounter: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  massiveNotesBox: {
    flex: 1,
    minHeight: 240,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  massiveTextInput: {
    flex: 1,
    padding: 18,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  micBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTextCol: {
    flex: 1,
  },
  voiceTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  voiceSub: {
    fontSize: 11,
  },
  soonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  soonText: {
    fontSize: 10,
    fontWeight: '800',
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
    paddingHorizontal: 14,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: -8,
  },
  modalSummary: {
    borderRadius: RADII.control,
    borderWidth: 1,
    padding: 16,
    gap: 12,
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
  summaryCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  urgencyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
  },
  notesPreview: {
    gap: 4,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalSendBtn: {
    flex: 2,
    minHeight: 50,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
