import { useCallback, useEffect, useState } from 'react';
import * as Network from 'expo-network';

export interface NetworkStatusState {
  isConnected: boolean;
  isInternetReachable: boolean;
  networkType: Network.NetworkStateType;
  forceOffline: boolean;
  canUseCloudRelay: boolean;
  setForceOffline: (value: boolean) => void;
  refresh: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatusState {
  const [isConnected, setIsConnected] = useState(false);
  const [isInternetReachable, setIsInternetReachable] = useState(false);
  const [networkType, setNetworkType] = useState<Network.NetworkStateType>(
    Network.NetworkStateType.UNKNOWN,
  );
  const [forceOffline, setForceOffline] = useState(false);

  const applyState = useCallback((state: Network.NetworkState) => {
    setIsConnected(Boolean(state.isConnected));
    setIsInternetReachable(Boolean(state.isInternetReachable ?? state.isConnected));
    setNetworkType(state.type ?? Network.NetworkStateType.UNKNOWN);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      applyState(state);
    } catch {
      setIsConnected(false);
      setIsInternetReachable(false);
    }
  }, [applyState]);

  useEffect(() => {
    void refresh();
    const sub = Network.addNetworkStateListener((state) => {
      applyState(state);
    });
    return () => {
      sub.remove();
    };
  }, [applyState, refresh]);

  return {
    isConnected,
    isInternetReachable,
    networkType,
    forceOffline,
    canUseCloudRelay: !forceOffline && isConnected && isInternetReachable,
    setForceOffline,
    refresh,
  };
}
