import { PermissionsAndroid, Platform } from 'react-native';
import base64 from 'react-native-base64';
import { BleManager, Device, State } from 'react-native-ble-plx';

import { useBLEStore } from '../store/useBLEStore';
import { Alarm, ConnectResult } from '../types/ble';
import { buildAlarmPayload } from '../utils/format';

export const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
export const CHARACTERISTIC_UUID = 'abcd1234-5678-90ab-cdef-123456789abc';
const AUTO_SEND_TEST_PAYLOAD_ON_CONNECT = false;

const nowTimeLabel = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const buildTestAlarm = (): Alarm => ({
  id: 'test-alarm',
  time: '07:30',
  enabled: true,
  intensity: 70,
  repeatDays: [1, 2, 3, 4, 5],
});

class BLEService {
  private manager = new BleManager();
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        return;
      }

      if (state === State.PoweredOff && useBLEStore.getState().connectedDevice) {
        useBLEStore.getState().resetConnection();
      }
    }, true);
  }

  private getIdleStatus() {
    return useBLEStore.getState().connectedDevice ? 'connected' : 'idle';
  }

  private clearTimers() {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  async requestPermissions() {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (Platform.Version >= 31) {
      const statuses = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      console.log('[BLEService] Android BLE permission results:', statuses);

      return (
        statuses[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        statuses[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
        statuses[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    console.log('[BLEService] Android location permission result:', status);
    return status === PermissionsAndroid.RESULTS.GRANTED;
  }

  private async waitForPoweredOn(timeoutMs = 4000): Promise<State> {
    const initialState = await this.manager.state();
    console.log(`[BLEService] Initial BLE adapter state: ${initialState}`);

    if (initialState === State.PoweredOn) {
      return initialState;
    }

    return new Promise((resolve) => {
      let settled = false;

      const finish = (state: State) => {
        if (settled) {
          return;
        }

        settled = true;
        subscription.remove();
        clearTimeout(timeoutId);
        resolve(state);
      };

      const subscription = this.manager.onStateChange((state) => {
        console.log(`[BLEService] onStateChange observed: ${state}`);
        if (state === State.PoweredOn) {
          finish(state);
        }
      }, true);

      const timeoutId = setTimeout(async () => {
        try {
          const latestState = await this.manager.state();
          console.log(`[BLEService] BLE state after wait timeout: ${latestState}`);
          finish(latestState);
        } catch {
          finish(initialState);
        }
      }, timeoutMs);
    });
  }

  async startScanning() {
    const store = useBLEStore.getState();
    store.clearScannedDevices();
    store.setConnectionStatus('scanning');
    console.log('[BLEService] startScanning called.');

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.log('[BLEService] Required BLE permissions were not granted.');
      this.stopScanning();
      return;
    }

    const bluetoothState = await this.waitForPoweredOn();
    if (bluetoothState !== State.PoweredOn) {
      console.log(`[BLEService] Bluetooth adapter is not ready. finalState=${bluetoothState}`);
      this.stopScanning();
      return;
    }

    this.clearTimers();
    console.log('[BLEService] Starting native BLE device scan.');
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('[BLEService] Native BLE scan error:', error);
        this.stopScanning();
        return;
      }

      if (!device) {
        return;
      }

      console.log(
        `[BLEService] Device discovered id=${device.id} name=${device.name ?? 'N/A'} localName=${
          device.localName ?? 'N/A'
        } rssi=${device.rssi ?? 'N/A'}`,
      );

      if (device.name || device.localName) {
        useBLEStore.getState().addOrUpdateScannedDevice(device);
        console.log(`[BLEService] Device added to scan list: ${device.id}`);
      } else {
        console.log(`[BLEService] Device ignored because it has no visible name: ${device.id}`);
      }
    });

    this.scanTimeout = setTimeout(() => {
      console.log('[BLEService] Native BLE scan timed out after 14 seconds.');
      this.stopScanning();
    }, 14000);
  }

  stopScanning() {
    console.log('[BLEService] stopScanning called.');
    this.clearTimers();
    this.manager.stopDeviceScan();
    useBLEStore.getState().setConnectionStatus(this.getIdleStatus());
  }

  async connectToDevice(device: Device): Promise<ConnectResult> {
    this.stopScanning();
    useBLEStore.getState().setConnectionStatus('connecting');

    try {
      const connected = await device.connect();
      const discovered = await connected.discoverAllServicesAndCharacteristics();

      discovered.onDisconnected((error, disconnectedDevice) => {
        console.log(
          '[BLEService] Device disconnected:',
          error?.message ?? 'No BLE error message',
          disconnectedDevice?.id ?? 'unknown-device',
        );
        if (disconnectedDevice) {
          useBLEStore.getState().resetConnection();
        }
      });

      useBLEStore.getState().hydrateConnectionSnapshot({
        device: discovered,
        batteryLevel: null,
        lastSyncedAt: nowTimeLabel(),
      });

      if (AUTO_SEND_TEST_PAYLOAD_ON_CONNECT) {
        const testPayloadSent = await this.sendTestPayload(discovered);
        if (!testPayloadSent) {
          console.log('[BLEService] Connected successfully, but automatic test payload send failed.');
        }
      }

      return { success: true, device: discovered };
    } catch (error) {
      useBLEStore.getState().setConnectionStatus(this.getIdleStatus());
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async disconnect() {
    const device = useBLEStore.getState().connectedDevice;
    useBLEStore.getState().setConnectionStatus('connecting');

    try {
      if (device) {
        await this.manager.cancelDeviceConnection(device.id);
      }
    } finally {
      useBLEStore.getState().resetConnection();
    }
  }

  private async writeJsonPayload(device: Device, payload: string) {
    const encodedPayload = base64.encode(payload);
    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      encodedPayload,
    );
  }

  async sendTestPayload(overrideDevice?: Device) {
    const device = overrideDevice ?? useBLEStore.getState().connectedDevice;
    if (!device) {
      return false;
    }

    const payload = JSON.stringify(buildAlarmPayload(buildTestAlarm()), null, 2);
    useBLEStore.getState().setPendingPayload(payload);
    useBLEStore.getState().setConnectionStatus('syncing');

    try {
      await this.writeJsonPayload(device, payload);
      useBLEStore.getState().setLastSyncedAt(nowTimeLabel());
      useBLEStore.getState().setConnectionStatus('connected');
      return true;
    } catch {
      useBLEStore.getState().setConnectionStatus('connected');
      return false;
    }
  }

  async sendAlarmConfig(alarm: Alarm) {
    const device = useBLEStore.getState().connectedDevice;
    if (!device) {
      return false;
    }

    const payload = JSON.stringify(buildAlarmPayload(alarm), null, 2);
    useBLEStore.getState().setPendingPayload(payload);
    useBLEStore.getState().setConnectionStatus('syncing');

    try {
      await this.writeJsonPayload(device, payload);
      useBLEStore.getState().setLastSyncedAt(nowTimeLabel());
      useBLEStore.getState().setConnectionStatus('connected');
      return true;
    } catch {
      useBLEStore.getState().setConnectionStatus('connected');
      return false;
    }
  }

  async syncEnabledAlarms(alarms: Alarm[]) {
    for (const alarm of alarms) {
      if (!alarm.enabled) {
        continue;
      }

      const success = await this.sendAlarmConfig(alarm);
      if (!success) {
        return false;
      }
    }

    return true;
  }

  destroy() {
    this.clearTimers();
    this.manager.stopDeviceScan();
    this.manager.destroy();
  }
}

export const bleService = new BLEService();
