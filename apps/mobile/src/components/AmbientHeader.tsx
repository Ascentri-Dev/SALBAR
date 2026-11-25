import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

export function AmbientHeader() {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle },
      ]}
    >
      <Text style={[styles.brandText, { color: colors.textPrimary }]}>SALBAR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
