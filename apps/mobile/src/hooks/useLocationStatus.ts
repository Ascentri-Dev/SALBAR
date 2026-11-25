import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { GpsReading } from '../types/report';

const POS_NONE = 65535;

const INITIAL_READING: GpsReading = {
  lat: 0,
  lng: 0,
  accuracyMeters: 0,
  posAgeS: POS_NONE,
  fixState: 'SEARCHING',
  lastUpdatedMs: null,
};

export function useLocationStatus() {
  const [reading, setReading] = useState<GpsReading>(INITIAL_READING);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastUpdatedRef = useRef<number | null>(null);

  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setReading((prev) => ({ ...prev, fixState: 'DENIED' }));
        return;
      }

      setReading((prev) => ({
        ...prev,
        fixState: prev.lastUpdatedMs ? 'LAST_KNOWN' : 'SEARCHING',
      }));

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const ageS = Math.max(
          1,
          Math.min(65534, Math.round((Date.now() - lastKnown.timestamp) / 1000)),
        );
        lastUpdatedRef.current = lastKnown.timestamp;
        setReading({
          lat: lastKnown.coords.latitude,
          lng: lastKnown.coords.longitude,
          accuracyMeters: Math.round((lastKnown.coords.accuracy ?? 0) * 10) / 10,
          posAgeS: ageS,
          fixState: 'LAST_KNOWN',
          lastUpdatedMs: lastKnown.timestamp,
        });
      }

      subscriptionRef.current?.remove();
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 3,
        },
        (loc) => {
          lastUpdatedRef.current = loc.timestamp;
          setReading({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracyMeters: Math.round((loc.coords.accuracy ?? 0) * 10) / 10,
            posAgeS: 0,
            fixState: 'LOCKED',
            lastUpdatedMs: loc.timestamp,
          });
        },
      );
    } catch {
      setReading((prev) => ({
        ...prev,
        fixState: prev.lastUpdatedMs ? 'LAST_KNOWN' : 'NO_FIX',
      }));
    }
  }, []);

  useEffect(() => {
    void startTracking();

    const ageTimer = setInterval(() => {
      if (lastUpdatedRef.current === null) return;
      const ageS = Math.max(0, Math.round((Date.now() - lastUpdatedRef.current) / 1000));
      setReading((prev) => {
        if (ageS > 30 && prev.fixState === 'LOCKED') {
          return { ...prev, posAgeS: Math.min(65534, ageS), fixState: 'LAST_KNOWN' };
        }
        return prev.fixState === 'LAST_KNOWN'
          ? { ...prev, posAgeS: Math.min(65534, ageS) }
          : prev;
      });
    }, 5000);

    return () => {
      clearInterval(ageTimer);
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [startTracking]);

  return { reading, refreshPermission: startTracking };
}
