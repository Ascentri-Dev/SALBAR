import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DiscoveredTerminal,
  isBleNativeAvailable,
  relayReportOverBle,
  startTerminalScan,
} from '../ble/bleRelayService';
import {
  listPendingReports,
  updateReportSyncStatus,
} from '../db/reportsRepository';
import { uploadReportToCloudRelay } from '../sync/cloudRelayClient';
import type { LocalReport } from '../types/report';

const DEFAULT_RELAY_URL =
  process.env.EXPO_PUBLIC_CLOUD_RELAY_URL ?? 'http://localhost:8000';

export function useSyncEngine({
  canUseCloudRelay,
  onSyncCompleted,
}: {
  canUseCloudRelay: boolean;
  onSyncCompleted: () => Promise<void> | void;
}) {
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY_URL);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const [terminals, setTerminals] = useState<DiscoveredTerminal[]>([]);

  const bleAvailable = isBleNativeAvailable();
  const stopScanRef = useRef<(() => void) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  const syncPendingViaCloud = useCallback(async () => {
    if (!canUseCloudRelay || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const pending = await listPendingReports();
      for (const report of pending) {
        await updateReportSyncStatus(report.id, 'SYNCING', 'CLOUD_RELAY');
        const res = await uploadReportToCloudRelay(report, relayUrl);
        if (res.ok) {
          await updateReportSyncStatus(report.id, 'SENT_CLOUD', 'CLOUD_RELAY', null);
        } else {
          await updateReportSyncStatus(
            report.id,
            'PENDING_LOCAL',
            null,
            res.error ?? 'Upload failed',
            true,
          );
        }
      }
      await onSyncCompleted();
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [canUseCloudRelay, relayUrl, onSyncCompleted]);

  const stopBleScan = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    stopScanRef.current?.();
    stopScanRef.current = null;
    setIsScanningBle(false);
  }, []);

  const relayPendingToTerminal = useCallback(
    async (deviceId: string) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setIsSyncing(true);
      try {
        const pending = await listPendingReports();
        for (const report of pending) {
          await updateReportSyncStatus(report.id, 'SYNCING', 'LORA_MESH_BLE');
          const res = await relayReportOverBle(deviceId, report);
          if (res.ok) {
            await updateReportSyncStatus(report.id, 'RELAYED_BLE', 'LORA_MESH_BLE', null);
          } else {
            await updateReportSyncStatus(
              report.id,
              'PENDING_LOCAL',
              null,
              res.error ?? 'BLE relay failed',
              true,
            );
          }
        }
        await onSyncCompleted();
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [onSyncCompleted],
  );

  const startBleScan = useCallback(() => {
    stopBleScan();
    setBleError(null);
    setTerminals([]);
    setIsScanningBle(true);

    const stop = startTerminalScan(
      (device) => {
        setTerminals((prev) => {
          const idx = prev.findIndex((t) => t.id === device.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = device;
            return next;
          }
          return [...prev, device].sort((a, b) => b.rssi - a.rssi);
        });
      },
      (errMsg) => {
        setBleError(errMsg);
        setIsScanningBle(false);
      },
    );

    stopScanRef.current = stop;
    scanTimerRef.current = setTimeout(() => {
      stopBleScan();
    }, 6000);
  }, [stopBleScan]);

  const retrySingleReport = useCallback(
    async (report: LocalReport): Promise<{ ok: boolean; message: string }> => {
      if (canUseCloudRelay) {
        await updateReportSyncStatus(report.id, 'SYNCING', 'CLOUD_RELAY');
        const res = await uploadReportToCloudRelay(report, relayUrl);
        if (res.ok) {
          await updateReportSyncStatus(report.id, 'SENT_CLOUD', 'CLOUD_RELAY', null);
          await onSyncCompleted();
          return { ok: true, message: 'Uploaded to Cloud Relay.' };
        }
        await updateReportSyncStatus(
          report.id,
          'PENDING_LOCAL',
          null,
          res.error ?? 'Upload failed',
          true,
        );
        await onSyncCompleted();
        return { ok: false, message: res.error ?? 'Cloud Relay unreachable.' };
      }

      if (terminals.length > 0) {
        await updateReportSyncStatus(report.id, 'SYNCING', 'LORA_MESH_BLE');
        const res = await relayReportOverBle(terminals[0].id, report);
        if (res.ok) {
          await updateReportSyncStatus(report.id, 'RELAYED_BLE', 'LORA_MESH_BLE', null);
          await onSyncCompleted();
          return { ok: true, message: `Relayed via BLE to ${terminals[0].name}.` };
        }
        await updateReportSyncStatus(
          report.id,
          'PENDING_LOCAL',
          null,
          res.error ?? 'BLE transfer failed',
          true,
        );
        await onSyncCompleted();
        return { ok: false, message: res.error ?? 'BLE transfer failed.' };
      }

      return {
        ok: false,
        message: bleAvailable
          ? 'Offline: Tap Scan to find a nearby T-Beam terminal.'
          : 'Offline: Cloud Relay unreachable and BLE requires an Android APK build.',
      };
    },
    [bleAvailable, canUseCloudRelay, onSyncCompleted, relayUrl, terminals],
  );

  // Auto-sync when internet connectivity turns on
  useEffect(() => {
    if (canUseCloudRelay) {
      void syncPendingViaCloud();
    }
  }, [canUseCloudRelay, syncPendingViaCloud]);

  useEffect(() => {
    return () => {
      stopBleScan();
    };
  }, [stopBleScan]);

  return {
    relayUrl,
    setRelayUrl,
    isSyncing,
    isScanningBle,
    bleAvailable,
    bleError,
    terminals,
    syncPendingViaCloud,
    startBleScan,
    stopBleScan,
    relayPendingToTerminal,
    retrySingleReport,
  };
}
