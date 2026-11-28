import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';
import type { GpsReading } from '../types/report';

interface GuideScreenProps {
  gps: GpsReading;
  forceOffline: boolean;
  bleAvailable: boolean;
  relayUrl: string;
  onChangeRelayUrl: (url: string) => void;
  onToggleForceOffline: (value: boolean) => void;
  onRefreshLocation: () => void;
}

type GuideLang = 'EN' | 'CEB' | 'TL';

const GUIDE_CONTENT: Record<
  GuideLang,
  { step1Title: string; step1Desc: string; step2Title: string; step2Desc: string; step3Title: string; step3Desc: string }
> = {
  EN: {
    step1Title: '1. Tap Emergency & Submit',
    step1Desc: 'Choose the hazard, urgency, and notes. Your report is saved safely on your phone immediately, even with zero signal.',
    step2Title: '2. Automatic Cloud Delivery',
    step2Desc: 'If cellular data or Wi-Fi is reachable, your report uploads straight to the Barangay Command Center.',
    step3Title: '3. Blackout BLE Mesh Relay',
    step3Desc: 'During outages, keep Bluetooth ON. When a responder carrying a SALBAR T-Beam passes nearby, your phone relays the report over BLE.',
  },
  CEB: {
    step1Title: '1. Pilia ang Emerhensya',
    step1Desc: 'Pilia ang klase sa katalagman ug isulat ang detalye. Ma-save dayon kini sa imong phone bisan walay signal.',
    step2Title: '2. Diretso sa Cloud kon naay Internet',
    step2Desc: 'Kon naay mobile data o Wi-Fi, ma-send dayon ang report sa Command Center.',
    step3Title: '3. Bluetooth Relay kon Blackout',
    step3Desc: 'Kon walay signal, pasagdi nga naka-ON ang Bluetooth aron mapasa ang report ngadto sa duol nga responder nga naay T-Beam.',
  },
  TL: {
    step1Title: '1. Piliin ang Emerhensya',
    step1Desc: 'Piliin ang uri ng sakuna at ilagay ang detalye. Agad itong masa-save sa iyong phone kahit walang signal.',
    step2Title: '2. Awtomatikong Cloud Upload',
    step2Desc: 'Kapag may internet o Wi-Fi, direktang ipapadala ang ulat sa Command Center.',
    step3Title: '3. Bluetooth Relay sa Blackout',
    step3Desc: 'Kapag walang signal, panatilihing naka-ON ang Bluetooth para maipasa ang ulat sa malapit na responder na may T-Beam.',
  },
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function GuideScreen({
  gps,
  forceOffline,
  bleAvailable,
  relayUrl,
  onChangeRelayUrl,
  onToggleForceOffline,
  onRefreshLocation,
}: GuideScreenProps) {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const [lang, setLang] = useState<GuideLang>('EN');

  const locationGranted = gps.fixState !== 'DENIED';
  const guideCopy = GUIDE_CONTENT[lang];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerBlock}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Guide & Settings</Text>
        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
          Offline instructions, permissions, and app preferences
        </Text>
      </View>

      {/* Bilingual Emergency Guide Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.guideTopRow}>
          <Text style={[styles.cardHeader, { color: colors.textPrimary }]}>How Reporting Works</Text>
          <View
            style={[
              styles.langSwitch,
              { backgroundColor: colors.bgBase, borderColor: colors.borderSubtle },
            ]}
          >
            {(['EN', 'CEB', 'TL'] as GuideLang[]).map((code) => {
              const active = lang === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setLang(code);
                  }}
                  style={[
                    styles.langPill,
                    active && { backgroundColor: colors.accentPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      { color: active ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.stepItem}>
          <Text style={[styles.stepTitle, { color: colors.accentPrimary }]}>
            {guideCopy.step1Title}
          </Text>
          <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
            {guideCopy.step1Desc}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.stepItem}>
          <Text style={[styles.stepTitle, { color: EMERGENCY_COLORS.success }]}>
            {guideCopy.step2Title}
          </Text>
          <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
            {guideCopy.step2Desc}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.stepItem}>
          <Text style={[styles.stepTitle, { color: EMERGENCY_COLORS.telemetry }]}>
            {guideCopy.step3Title}
          </Text>
          <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
            {guideCopy.step3Desc}
          </Text>
        </View>
      </View>

      {/* Hardware & Permission Readiness */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <Text style={[styles.cardHeader, { color: colors.textPrimary }]}>
          Device Readiness
        </Text>

        <View style={styles.checkRow}>
          <View style={styles.rowLeft}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: hexToRgba(
                    locationGranted ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.critical,
                    0.14,
                  ),
                },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={18}
                color={locationGranted ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.critical}
              />
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                Fine Location (GPS)
              </Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                {gps.fixState === 'LOCKED'
                  ? `Locked (+/-${Math.round(gps.accuracyMeters)}m)`
                  : `Status: ${gps.fixState}`}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={locationGranted ? onRefreshLocation : () => void Linking.openSettings()}
            style={[
              styles.softBadge,
              {
                backgroundColor: hexToRgba(
                  locationGranted ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.critical,
                  0.14,
                ),
                borderColor: hexToRgba(
                  locationGranted ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.critical,
                  0.32,
                ),
              },
            ]}
          >
            <Text
              style={[
                styles.softBadgeText,
                {
                  color: locationGranted
                    ? EMERGENCY_COLORS.success
                    : EMERGENCY_COLORS.critical,
                },
              ]}
            >
              {locationGranted ? 'Ready' : 'Fix'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.checkRow}>
          <View style={styles.rowLeft}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: hexToRgba(EMERGENCY_COLORS.telemetry, 0.14) },
              ]}
            >
              <Ionicons name="bluetooth-outline" size={18} color={EMERGENCY_COLORS.telemetry} />
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                Bluetooth Low Energy (BLE)
              </Text>
              <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                Relays reports to nearby T-Beam units
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.softBadge,
              {
                backgroundColor: hexToRgba(
                  bleAvailable ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.moderate,
                  0.14,
                ),
                borderColor: hexToRgba(
                  bleAvailable ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.moderate,
                  0.32,
                ),
              },
            ]}
          >
            <Text
              style={[
                styles.softBadgeText,
                {
                  color: bleAvailable ? EMERGENCY_COLORS.success : EMERGENCY_COLORS.moderate,
                },
              ]}
            >
              {bleAvailable ? 'Ready' : 'APK Only'}
            </Text>
          </View>
        </View>
      </View>

      {/* Preferences & Field Trial Settings */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle },
        ]}
      >
        <Text style={[styles.cardHeader, { color: colors.textPrimary }]}>
          Preferences & Field Trials
        </Text>

        <View style={styles.checkRow}>
          <View style={styles.flexOne}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              Switch between Midnight Navy and Light theme
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={() => {
              void Haptics.selectionAsync();
              toggleTheme();
            }}
            trackColor={{ false: colors.borderSubtle, true: colors.accentPrimary }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.checkRow}>
          <View style={styles.flexOne}>
            <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
              Force Offline Mode (BLE Test)
            </Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              Bypass Cloud Relay even when internet is active
            </Text>
          </View>
          <Switch
            value={forceOffline}
            onValueChange={(val) => {
              void Haptics.selectionAsync();
              onToggleForceOffline(val);
            }}
            trackColor={{ false: colors.borderSubtle, true: colors.accentPrimary }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.urlBlock}>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
            Cloud Relay Base URL
          </Text>
          <TextInput
            value={relayUrl}
            onChangeText={onChangeRelayUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.bgBase,
                borderColor: colors.borderSubtle,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 96,
    gap: 14,
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
  card: {
    borderRadius: RADII.card,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '800',
  },
  guideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  langSwitch: {
    flexDirection: 'row',
    borderRadius: RADII.pill,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  langPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stepItem: {
    gap: 3,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexOne: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  softBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  softBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
  },
  urlBlock: {
    gap: 8,
  },
  input: {
    borderRadius: RADII.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
