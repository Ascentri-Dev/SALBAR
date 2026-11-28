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
import { Tactile3DButton, Tactile3DCard } from '../components/Tactile3D';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, FONTS, RADII } from '../theme/tokens';
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

/**
 * Renders distinct subtle geometric background textures per emergency type.
 */
function ContainerTexture({ texture, color }: { texture: TileTexture; color: string }) {
  switch (texture) {
    case 'diamond':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          {[-20, 14, 48, 82].map((offset, i) => (
            <View
              key={`a-${i}`}
              style={[styles.diamondLineA, { backgroundColor: color, left: offset }]}
            />
          ))}
          {[-20, 14, 48, 82].map((offset, i) => (
            <View
              key={`b-${i}`}
              style={[styles.diamondLineB, { backgroundColor: color, left: offset }]}
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
          <View style={[styles.waveRingMd, { borderColor: color }]} />
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
    case 'stripes':
      return (
        <View pointerEvents="none" style={styles.textureLayer}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.stripeLine, { backgroundColor: color, right: -24 + i * 24 }]}
            />
          ))}
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
 * Stage 1 Tile: Centered typography, unique texture, and spotlight focus on press/hold.
 */
function EmergencyTile({
  item,
  focusedId,
  onPressInTile,
  onPressOutTile,
  onPress,
}: {
  item: CategoryOption;
  focusedId: IncidentCategory | null;
  onPressInTile: () => void;
  onPressOutTile: () => void;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const focusAnim = useRef(new Animated.Value(0)).current;
  const dimAnim = useRef(new Animated.Value(1)).current;

  const isThisFocused = focusedId === item.id;
  const isOtherFocused = focusedId !== null && !isThisFocused;
  const baseTint = isDark ? item.tintDark : item.tintLight;

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: isThisFocused ? 1 : 0,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [isThisFocused, focusAnim]);

  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: isOtherFocused ? 0.34 : 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [isOtherFocused, dimAnim]);

  const depress = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2.5],
  });

  return (
    <Pressable
      onPressIn={onPressInTile}
      onPressOut={onPressOutTile}
      onPress={onPress}
      style={styles.gridTileWrapper}
    >
      <View style={styles.tileOuter}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tileShadowBacking,
            { backgroundColor: colors.tactileShadow, opacity: dimAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.gridTile,
            {
              backgroundColor: colors.bgSurface,
              borderColor: isThisFocused ? item.accentColor : colors.tactileBorder,
              borderWidth: 2,
              transform: [{ translateX: depress }, { translateY: depress }],
            },
          ]}
        >
          <Animated.View style={[styles.tileInnerFill, { opacity: dimAnim }]}>
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
        </Animated.View>
      </View>
    </Pressable>
  );
}

/**
 * 2x2 Urgency Card with spotlight focus (unselected cards dim smoothly) and high-contrast text scrim.
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
  const { colors, isDark } = useAppTheme();
  const focusAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const isCritical = opt.id === 'CRITICAL';
  const baseTint = isDark ? opt.tintDark : opt.tintLight;

  useEffect(() => {
    Animated.spring(focusAnim, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [selected, focusAnim]);

  const opacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.46, 1],
  });

  return (
    <Pressable
      onPress={() => {
        Animated.sequence([
          Animated.timing(focusAnim, { toValue: 0.2, duration: 70, useNativeDriver: true }),
          Animated.spring(focusAnim, {
            toValue: 1,
            friction: 5,
            tension: 160,
            useNativeDriver: true,
          }),
        ]).start();
        onPress();
      }}
      style={styles.urgencyGridWrap}
    >
      <View style={styles.tileOuter}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tileShadowBacking,
            { backgroundColor: colors.tactileShadow, opacity },
          ]}
        />
        <View
          style={[
            styles.urgencyGridCard,
            {
              backgroundColor: selected ? opt.color : colors.bgSurface,
              borderColor: colors.tactileBorder,
              borderWidth: 2,
            },
          ]}
        >
          <Animated.View style={[styles.tileInnerFill, { opacity }]}>
            {!selected ? (
              <View style={[styles.tileTintOverlay, { backgroundColor: baseTint }]} />
            ) : null}

            {/* CRITICAL gets a unique hazard diagonal-stripe texture */}
            {isCritical ? (
              <View pointerEvents="none" style={[styles.textureLayer, { opacity: selected ? 0.18 : 0.14 }]}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.stripeLine,
                      { backgroundColor: selected ? '#FFFFFF' : opt.color, right: -24 + i * 24 },
                    ]}
                  />
                ))}
              </View>
            ) : null}

            <Text
              style={[
                styles.urgencyCardLabel,
                { color: selected ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              {opt.label}
            </Text>
            <Text
              style={[
                styles.urgencyCardSub,
                { color: selected ? 'rgba(255,255,255,0.92)' : colors.textSecondary },
              ]}
            >
              {opt.subtitle}
            </Text>
          </Animated.View>
        </View>
      </View>
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
  const [focusedTile, setFocusedTile] = useState<IncidentCategory | null>(null);
  const [category, setCategory] = useState<IncidentCategory>('trapped-persons');
  const [urgency, setUrgency] = useState<IncidentUrgency>('LOW');
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
    outputRange: [colors.tactileBorder, colors.accentPrimary],
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

  const handleSelectCategory = (selected: IncidentCategory) => {
    setFocusedTile(null);
    setCategory(selected);
    setUrgency('LOW');
    void Haptics.selectionAsync();
    goToStage(2);
  };

  const handleTextChange = (text: string) => {
    // Strip control characters and enforce UTF-8 128-byte cap in UI
    const sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
    setRawText(truncateToUtf8Bytes(sanitized, MAX_RAW_TEXT_BYTES));
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
    <View style={styles.root}>
      {/* Top Arrow Progress Bar: Type ---> Urgency ---> Notes */}
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
                    borderColor: active
                      ? colors.tactileBorder
                      : completed
                        ? colors.accentPrimary
                        : colors.tactileBorder,
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
                  focusedId={focusedTile}
                  onPressInTile={() => setFocusedTile(item.id)}
                  onPressOutTile={() => setFocusedTile((prev) => (prev === item.id ? null : prev))}
                  onPress={() => handleSelectCategory(item.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* STAGE 2: Full-Height Urgency Grid (LOW -> CRITICAL) + Symmetric People Stepper */}
        {stage === 2 ? (
          <View style={styles.stageContainer}>
            <View style={styles.headerBlock}>
              <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                Urgency & Impact
              </Text>
              <Text style={[styles.stageSubtitle, { color: colors.textSecondary }]}>
                Select priority level and people affected
              </Text>
            </View>

            {/* 2x2 Urgency Grid filling remaining vertical space */}
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

            <Tactile3DCard offset={4} contentStyle={styles.peopleCardInner}>
              <Text style={[styles.peopleTitle, { color: colors.textPrimary }]}>
                Affected Persons (Tap number to type)
              </Text>
              <View style={styles.peopleInputRow}>
                <Tactile3DButton
                  onPress={() => adjustVictimCount(-10)}
                  offset={2}
                  backgroundColor={colors.bgSurfaceElevated}
                  borderColor={colors.tactileBorder}
                  contentStyle={styles.adjBtn}
                >
                  <Text style={[styles.adjBtnText, { color: colors.textPrimary }]}>-10</Text>
                </Tactile3DButton>

                <Tactile3DButton
                  onPress={() => adjustVictimCount(-1)}
                  offset={2}
                  backgroundColor={colors.bgSurfaceElevated}
                  borderColor={colors.tactileBorder}
                  contentStyle={styles.adjBtn}
                >
                  <Text style={[styles.adjBtnText, { color: colors.textPrimary }]}>-1</Text>
                </Tactile3DButton>

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
                      borderColor: colors.tactileBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                />

                <Tactile3DButton
                  onPress={() => adjustVictimCount(1)}
                  offset={2}
                  backgroundColor={colors.bgSurfaceElevated}
                  borderColor={colors.tactileBorder}
                  contentStyle={styles.adjBtn}
                >
                  <Text style={[styles.adjBtnText, { color: colors.textPrimary }]}>+1</Text>
                </Tactile3DButton>

                <Tactile3DButton
                  onPress={() => adjustVictimCount(10)}
                  offset={2}
                  backgroundColor={colors.bgSurfaceElevated}
                  borderColor={colors.tactileBorder}
                  contentStyle={styles.adjBtn}
                >
                  <Text style={[styles.adjBtnText, { color: colors.textPrimary }]}>+10</Text>
                </Tactile3DButton>
              </View>
            </Tactile3DCard>

            <Tactile3DButton
              onPress={() => {
                void Haptics.selectionAsync();
                goToStage(3);
              }}
              borderColor={colors.tactileBorder}
              contentStyle={styles.primaryCtaInner}
            >
              <Text style={styles.primaryCtaText}>NEXT: SITUATION NOTES</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Tactile3DButton>
          </View>
        ) : null}

        {/* STAGE 3: Massive Notes Box + Voice Indicator */}
        {stage === 3 ? (
          <View style={styles.stageContainer}>
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

            <View style={styles.notesBoxWrap}>
              <View
                pointerEvents="none"
                style={[styles.tileShadowBacking, { backgroundColor: colors.tactileShadow }]}
              />
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
                  maxLength={MAX_RAW_TEXT_BYTES}
                  value={rawText}
                  onChangeText={handleTextChange}
                  onFocus={() => setNotesFocused(true)}
                  onBlur={() => setNotesFocused(false)}
                  placeholder="Describe landmarks, hazards, or urgent needs (e.g., Naay natabunan sa Sitio Riverside, tabang!)..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.massiveTextInput, { color: colors.textPrimary }]}
                />
              </Animated.View>
            </View>

            <Tactile3DButton
              onPress={() => {
                void Haptics.selectionAsync();
                setConfirmOpen(true);
              }}
              borderColor={colors.tactileBorder}
              contentStyle={styles.primaryCtaInner}
            >
              <Text style={styles.primaryCtaText}>REVIEW & SEND</Text>
              <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
            </Tactile3DButton>
          </View>
        ) : null}
      </Animated.View>

      {/* Tactical Dispatch Confirmation Modal */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalOuter}>
            <View
              pointerEvents="none"
              style={[styles.tileShadowBacking, { backgroundColor: colors.tactileShadow }]}
            />
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.bgSurface, borderColor: colors.tactileBorder },
              ]}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeroRow}>
                  <View style={styles.modalHeroLeft}>
                    <Text style={[styles.modalEyebrow, { color: colors.textSecondary }]}>
                      EMERGENCY DISPATCH REPORT
                    </Text>
                    <Text style={[styles.modalHeroTitle, { color: colors.textPrimary }]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.urgencyBadge,
                      {
                        backgroundColor: getUrgencyColor(urgency),
                        borderColor: colors.tactileBorder,
                      },
                    ]}
                  >
                    <Text style={styles.urgencyBadgeText}>{urgency}</Text>
                  </View>
                </View>

                {/* 2-up Telemetry Tiles */}
                <View style={styles.modalMetricsRow}>
                  <View
                    style={[
                      styles.modalMetricBox,
                      { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                    ]}
                  >
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                      AFFECTED
                    </Text>
                    <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                      {parsedVictimCount} {parsedVictimCount === 1 ? 'person' : 'people'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.modalMetricBox,
                      { backgroundColor: colors.bgBase, borderColor: colors.tactileBorder },
                    ]}
                  >
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>GPS FIX</Text>
                    <Text
                      style={[styles.metricMono, { color: EMERGENCY_COLORS.telemetry }]}
                      numberOfLines={1}
                    >
                      {gps.fixState === 'LOCKED' || gps.fixState === 'LAST_KNOWN'
                        ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
                        : gps.fixState}
                    </Text>
                  </View>
                </View>

                {/* Bounded Scrollable Notes Preview (edge-case safe for long text) */}
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
                    <Text style={[styles.notesText, { color: colors.textPrimary }]}>
                      {rawText.trim() ? rawText.trim() : 'No additional notes provided.'}
                    </Text>
                  </ScrollView>
                </View>

                <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                  Stored locally on your device immediately, then routed via Cloud or BLE.
                </Text>

                <View style={styles.modalActions}>
                  <Tactile3DButton
                    onPress={() => setConfirmOpen(false)}
                    offset={3}
                    backgroundColor={colors.bgSurfaceElevated}
                    borderColor={colors.tactileBorder}
                    style={styles.modalCancelBtnWrap}
                    contentStyle={styles.modalCancelBtn}
                  >
                    <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>Edit</Text>
                  </Tactile3DButton>

                  <Tactile3DButton
                    onPress={handleSubmit}
                    disabled={submitting}
                    offset={3}
                    backgroundColor={colors.accentPrimary}
                    borderColor={colors.tactileBorder}
                    style={styles.modalSendBtnWrap}
                    contentStyle={styles.modalSendBtn}
                  >
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.modalSendText}>
                      {submitting ? 'SAVING...' : 'CONFIRM & SEND'}
                    </Text>
                  </Tactile3DButton>
                </View>
              </View>
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
    fontFamily: FONTS.displayBold,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
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
    width: '48%',
    height: '31%',
  },
  tileOuter: {
    flex: 1,
    position: 'relative',
  },
  tileShadowBacking: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: RADII.card,
  },
  gridTile: {
    flex: 1,
    borderRadius: RADII.card,
    overflow: 'hidden',
  },
  tileInnerFill: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  diamondLineA: {
    position: 'absolute',
    top: -40,
    width: 3,
    height: 240,
    transform: [{ rotate: '35deg' }],
  },
  diamondLineB: {
    position: 'absolute',
    top: -40,
    width: 3,
    height: 240,
    transform: [{ rotate: '-35deg' }],
  },
  crossVert: {
    position: 'absolute',
    top: 16,
    right: 34,
    width: 22,
    height: 76,
    borderRadius: 6,
  },
  crossHoriz: {
    position: 'absolute',
    top: 43,
    right: 7,
    width: 76,
    height: 22,
    borderRadius: 6,
  },
  waveRingLg: {
    position: 'absolute',
    top: -28,
    right: -28,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 8,
  },
  waveRingMd: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 6,
  },
  waveRingSm: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 5,
  },
  gridLineH1: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    height: 2,
  },
  gridLineH2: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    height: 2,
  },
  gridLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 30,
    width: 2,
  },
  gridLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 64,
    width: 2,
  },
  stripeLine: {
    position: 'absolute',
    top: -30,
    width: 10,
    height: 200,
    transform: [{ rotate: '28deg' }],
  },
  dotsCluster: {
    top: 14,
    right: 14,
    left: undefined,
    bottom: undefined,
    width: 66,
    height: 66,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dotMatrixItem: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  tileTextBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tileHint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  urgencyGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    rowGap: 10,
  },
  urgencyGridWrap: {
    width: '48%',
    height: '47.5%',
  },
  urgencyGridCard: {
    flex: 1,
    borderRadius: RADII.card,
    overflow: 'hidden',
  },
  urgencyCardLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  urgencyCardSub: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  peopleCardInner: {
    padding: 14,
    gap: 10,
  },
  peopleTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  peopleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adjBtn: {
    minWidth: 46,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  adjBtnText: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    fontWeight: '700',
  },
  peopleInput: {
    flex: 1,
    height: 44,
    borderRadius: RADII.pill,
    borderWidth: 2,
    textAlign: 'center',
    fontFamily: FONTS.monoBold,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  byteCounter: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notesBoxWrap: {
    flex: 1,
    position: 'relative',
  },
  massiveNotesBox: {
    flex: 1,
    borderRadius: RADII.card,
    borderWidth: 2,
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
  primaryCtaInner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    fontFamily: FONTS.displayBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  arrowBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
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
    borderWidth: 2,
  },
  stagePillText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    justifyContent: 'center',
    padding: 18,
  },
  modalOuter: {
    position: 'relative',
  },
  modalCard: {
    borderRadius: RADII.card,
    borderWidth: 2,
    overflow: 'hidden',
  },
  modalAccentStrip: {
    height: 6,
    width: '100%',
  },
  modalContent: {
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
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalHeroTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 2,
  },
  urgencyBadgeText: {
    fontFamily: FONTS.monoBold,
    color: '#FFFFFF',
    fontSize: 11,
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
    fontSize: 15,
    fontWeight: '700',
  },
  metricMono: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modalNotesBox: {
    borderRadius: RADII.control,
    borderWidth: 2,
    padding: 12,
    gap: 6,
  },
  modalNotesScroll: {
    maxHeight: 100,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalHint: {
    fontSize: 11,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtnWrap: {
    flex: 1,
  },
  modalCancelBtn: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSendBtnWrap: {
    flex: 2,
  },
  modalSendBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSendText: {
    fontFamily: FONTS.displayBold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
