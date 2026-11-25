import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { EMERGENCY_COLORS } from '../theme/tokens';

interface SplashScreenProps {
  ready: boolean;
  onFinish: () => void;
}

/**
 * Dedicated launch splash screen with a temporary geometric SALBAR emblem.
 */
export function SplashScreen({ ready, onFinish }: SplashScreenProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.spring(pulse, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [pulse]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 1200);
    return () => clearTimeout(timer);
  }, [ready, opacity, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Animated.View style={[styles.logoCluster, { transform: [{ scale: pulse }] }]}>
        {/* Temporary geometric shield + signal ring logo */}
        <View style={styles.outerRing}>
          <View style={styles.innerRing}>
            <View style={styles.emblemCore}>
              <Text style={styles.emblemLetter}>S</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Text style={styles.brandTitle}>SALBAR</Text>
      <Text style={styles.brandSubtitle}>RESIDENT EMERGENCY TERMINAL</Text>

      <View style={styles.footer}>
        <View style={styles.statusDot} />
        <Text style={styles.footerText}>OFFLINE-FIRST | BLE + CLOUD RELAY</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    backgroundColor: '#0A0F1D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logoCluster: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 0, 0.5)',
    backgroundColor: '#111C38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemCore: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemLetter: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 4,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#111C38',
    borderWidth: 1,
    borderColor: '#1F2E5C',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EMERGENCY_COLORS.telemetry,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
});
