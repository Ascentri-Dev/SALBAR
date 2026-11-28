import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, FONTS, RADII } from '../theme/tokens';

export type MobileTab = 'report' | 'outbox' | 'guide';

interface BottomTabBarProps {
  activeTab: MobileTab;
  pendingCount: number;
  onSelectTab: (tab: MobileTab) => void;
}

const TAB_ITEMS: {
  id: MobileTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'report', label: 'Report', icon: 'alert-circle-outline' },
  { id: 'outbox', label: 'Outbox', icon: 'layers-outline' },
  { id: 'guide', label: 'Guide', icon: 'book-outline' },
];

const CHAR_HEIGHT = 16;

interface StaggeredTextProps {
  text: string;
  isActive: boolean;
  inactiveColor: string;
  activeColor: string;
}

/**
 * 1-to-1 React Native port of the web dashboard's StaggeredText letter-flip animation.
 */
function StaggeredText({ text, isActive, inactiveColor, activeColor }: StaggeredTextProps) {
  const characters = text.split('');

  return (
    <View style={styles.staggerRow}>
      {characters.map((char, index) => (
        <StaggeredChar
          key={`${text}-${index}`}
          char={char}
          index={index}
          isActive={isActive}
          inactiveColor={inactiveColor}
          activeColor={activeColor}
        />
      ))}
    </View>
  );
}

function StaggeredChar({
  char,
  index,
  isActive,
  inactiveColor,
  activeColor,
}: {
  char: string;
  index: number;
  isActive: boolean;
  inactiveColor: string;
  activeColor: string;
}) {
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 360,
      delay: index * 22,
      easing: Easing.bezier(0.76, 0, 0.24, 1),
      useNativeDriver: true,
    }).start();
  }, [isActive, index, progress]);

  const topTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -CHAR_HEIGHT],
  });

  const bottomTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CHAR_HEIGHT, 0],
  });

  const displayChar = char === ' ' ? '\u00A0' : char;

  return (
    <View style={styles.charBox}>
      <Animated.Text
        style={[
          styles.charText,
          { color: inactiveColor, transform: [{ translateY: topTranslateY }] },
        ]}
      >
        {displayChar}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.charText,
          styles.charOverlay,
          styles.charTextActive,
          { color: activeColor, transform: [{ translateY: bottomTranslateY }] },
        ]}
      >
        {displayChar}
      </Animated.Text>
    </View>
  );
}

export function BottomTabBar({
  activeTab,
  pendingCount,
  onSelectTab,
}: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View pointerEvents="box-none" style={styles.floatingWrapper}>
      <View style={styles.pillOuter}>
        <View
          pointerEvents="none"
          style={[styles.pillShadow, { backgroundColor: colors.tactileShadow }]}
        />
        <View
          style={[
            styles.pillBar,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.tactileBorder,
            },
          ]}
        >
        {TAB_ITEMS.map((tab) => {
          const active = tab.id === activeTab;
          const iconColor = active ? colors.accentPrimary : colors.textSecondary;
          const showBadge = tab.id === 'outbox' && pendingCount > 0;

          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelectTab(tab.id)}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.tabPressed,
              ]}
            >
              <Ionicons name={tab.icon} size={16} color={iconColor} />
              <StaggeredText
                text={tab.label}
                isActive={active}
                inactiveColor={colors.textPrimary}
                activeColor={colors.accentPrimary}
              />
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 16,
    right: 20,
    bottom: 16,
    alignItems: 'center',
  },
  pillOuter: {
    width: '100%',
    position: 'relative',
  },
  pillShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: RADII.pill,
  },
  pillBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADII.pill,
    borderWidth: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  tabPressed: {
    opacity: 0.78,
    transform: [{ translateY: 1 }],
  },
  staggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  charBox: {
    height: CHAR_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  charText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    lineHeight: CHAR_HEIGHT,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  charOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  charTextActive: {
    fontWeight: '800',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: EMERGENCY_COLORS.moderate,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
