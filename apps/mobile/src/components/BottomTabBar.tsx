import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';
import { EMERGENCY_COLORS, RADII } from '../theme/tokens';

export type MobileTab = 'report' | 'outbox' | 'guide';

interface BottomTabBarProps {
  activeTab: MobileTab;
  pendingCount: number;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomTabBar({
  activeTab,
  pendingCount,
  onSelectTab,
}: BottomTabBarProps) {
  const { colors } = useAppTheme();

  const tabs: { id: MobileTab; label: string; badge?: number }[] = [
    { id: 'report', label: 'Report' },
    { id: 'outbox', label: 'Outbox', badge: pendingCount },
    { id: 'guide', label: 'Guide' },
  ];

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.bgSurface, borderTopColor: colors.borderSubtle },
      ]}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={[
              styles.tabItem,
              active && {
                backgroundColor: colors.accentSubtle,
                borderColor: colors.accentPrimary,
              },
            ]}
          >
            <View style={styles.tabLabelRow}>
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.accentPrimary : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              {typeof tab.badge === 'number' && tab.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: EMERGENCY_COLORS.moderate,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
