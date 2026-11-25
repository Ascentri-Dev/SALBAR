import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager as BleManagerType, Device, Subscription } from 'react-native-ble-plx';
import type { LocalReport } from '../types/report';
import {
  base64ToUint8,
  encodeIncidentBinaryFrame,
  uint8ToBase64,
} from './salbarBinaryCodec';

export const SALBAR_BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const SALBAR_BLE_INCIDENT_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const SALBAR_BLE_ACK_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const SALBAR_DEVICE_PREFIX = 'SALBAR-';

export interface DiscoveredTerminal {
  id: string;
  name: string;
  rssi: number;
  lastSeenMs: number;
}

let managerInstance: BleManagerType | null = null;
let nativeLoadAttempted = false;

function getBleManager(): BleManagerType | null {
  if (managerInstance) return managerInstance;
  if (nativeLoadAttempted) return null;
  nativeLoadAttempted = true;
  try {
    // Lazy require so Expo Go does not crash when native BLE module is absent
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    managerInstance = new BleManager();
    return managerInstance;
  } catch {
    return null;
  }
}

export function isBleNativeAvailable(): boolean {
  return getBleManager() !== null;
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }
    const loc = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return loc === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function startTerminalScan(
  onDeviceFound: (terminal: DiscoveredTerminal) => void,
  onError: (message: string) => void,
): () => void {
  const manager = getBleManager();
  if (!manager) {
    onError('BLE requires an Android Development Build / APK (not supported in Expo Go).');
    return () => {};
  }

  let stopped = false;

  void (async () => {
    const granted = await requestBlePermissions();
    if (!granted || stopped) {
      if (!stopped) onError('Bluetooth permissions were denied.');
      return;
    }

    const state = await manager.state();
    if (state !== 'PoweredOn') {
      onError(`Bluetooth adapter is ${state}. Please turn on Bluetooth.`);
      return;
    }

    manager.startDeviceScan(
      [SALBAR_BLE_SERVICE_UUID],
      { allowDuplicates: true },
      (error, device: Device | null) => {
        if (error) {
          onError(error.message);
          return;
        }
        if (!device) return;
        const name = device.name ?? device.localName ?? '';
        if (!name && !device.serviceUUIDs?.includes(SALBAR_BLE_SERVICE_UUID)) return;
        if (name && !name.startsWith(SALBAR_DEVICE_PREFIX)) return;

        onDeviceFound({
          id: device.id,
          name: name || 'SALBAR-NODE',
          rssi: device.rssi ?? -90,
          lastSeenMs: Date.now(),
        });
      },
    );
  })();

  return () => {
    stopped = true;
    try {
      manager.stopDeviceScan();
    } catch {
      // ignore
    }
  };
}

export async function relayReportOverBle(
  deviceId: string,
  report: LocalReport,
): Promise<{ ok: boolean; error?: string }> {
  const manager = getBleManager();
  if (!manager) {
    return {
      ok: false,
      error: 'BLE native module unavailable in Expo Go.',
    };
  }

  let device: Device | null = null;
  const ackSubHolder: { sub: Subscription | null } = { sub: null };

  try {
    device = await manager.connectToDevice(deviceId, { timeout: 6000 });
    await device.discoverAllServicesAndCharacteristics();

    let mtu = 23;
    try {
      const updated = await device.requestMTU(256);
      mtu = updated.mtu ?? 23;
    } catch {
      mtu = 23;
    }

    const frame = encodeIncidentBinaryFrame(report);

    const ackPromise = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      ackSubHolder.sub = device!.monitorCharacteristicForService(
        SALBAR_BLE_SERVICE_UUID,
        SALBAR_BLE_ACK_CHAR_UUID,
        (err, char) => {
          if (err || !char?.value) return;
          const ackBytes = base64ToUint8(char.value);
          if (ackBytes.length >= 3) {
            const ackId = ackBytes[0] | (ackBytes[1] << 8);
            if (ackId === (report.incidentIdNum & 0xffff) && ackBytes[2] === 0) {
              clearTimeout(timer);
              resolve(true);
            }
          }
        },
      );
    });

    if (mtu - 3 >= frame.length) {
      await device.writeCharacteristicWithResponseForService(
        SALBAR_BLE_SERVICE_UUID,
        SALBAR_BLE_INCIDENT_CHAR_UUID,
        uint8ToBase64(frame),
      );
    } else {
      // Fallback 20-byte chunking if Android device did not negotiate large MTU
      const chunkSize = 18;
      for (let offset = 0, seq = 0; offset < frame.length; offset += chunkSize, seq++) {
        const slice = frame.slice(offset, offset + chunkSize);
        const packet = new Uint8Array(2 + slice.length);
        packet[0] = seq;
        packet[1] = Math.ceil(frame.length / chunkSize);
        packet.set(slice, 2);
        await device.writeCharacteristicWithResponseForService(
          SALBAR_BLE_SERVICE_UUID,
          SALBAR_BLE_INCIDENT_CHAR_UUID,
          uint8ToBase64(packet),
        );
      }
    }

    const acked = await ackPromise;
    return acked
      ? { ok: true }
      : { ok: false, error: 'Timed out waiting for T-Beam ACK.' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'BLE transfer failed.',
    };
  } finally {
    try {
      ackSubHolder.sub?.remove();
      if (device) {
        await manager.cancelDeviceConnection(device.id);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}
