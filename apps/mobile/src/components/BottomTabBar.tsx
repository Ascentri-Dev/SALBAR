import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';

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

export function BottomTabBar({
  activeTab,
  pendingCount,
  onSelectTab,
}: BottomTabBarProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View pointerEvents="box-none" style={styles.floatingWrapper}>
      <View
        style={[
          styles.pillBar,
          {
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle,
            shadowColor: isDark ? '#000000' : '#64748B',
          },
        ]}
      >
        {TAB_ITEMS.map((tab) => {
          const active = tab.id === activeTab;
          const itemColor = active ? colors.accentPrimary : colors.textSecondary;
          const showBadge = tab.id === 'outbox' && pendingCount > 0;

          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelectTab(tab.id)}
              style={[
                styles.tabItem,
                active && { backgroundColor: colors.accentSubtle },
              ]}
            >
              <Ionicons name={tab.icon} size={16} color={itemColor} />
              <Text
                style={[
                  styles.tabText,
                  { color: itemColor },
                  active && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
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
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    alignItems: 'center',
  },
  pillBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADII.pill,
    borderWidth: 1,
    padding: 6,
    gap: 6,
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      default: {},
    }),
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tabTextActive: {
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
