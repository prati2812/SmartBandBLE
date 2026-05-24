import { Alert, PermissionsAndroid, Platform } from 'react-native';
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

const buildMockDevices = (): Partial<Device>[] =>
  Array.from({ length: 4 }, (_, index) => {
    const deviceNumber = `${index + 1}`.padStart(2, '0');

    return {
      id: `DE:MO:00:00:00:${deviceNumber}`,
      name: `Smart Band ${deviceNumber}`,
      localName: `Smart Band ${deviceNumber}`,
      rssi: -45 - index * 8,
    };
  });

class BLEService {
  private manager = new BleManager();
  private mockInterval: ReturnType<typeof setInterval> | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private mockMode = true;

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

  setMockMode(value: boolean) {
    this.mockMode = value;
    useBLEStore.getState().setDemoMode(value);
  }

  getMockMode() {
    return this.mockMode;
  }

  private getIdleStatus() {
    return useBLEStore.getState().connectedDevice ? 'connected' : 'idle';
  }

  private clearTimers() {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }

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
    if (this.mockMode) {
      return State.PoweredOn;
    }

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

  private promptDemoMode(title: string, message: string) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use Demo Mode',
        onPress: () => {
          this.setMockMode(true);
          this.startMockScan();
        },
      },
    ]);
  }

  async startScanning() {
    const store = useBLEStore.getState();
    store.clearScannedDevices();
    store.setConnectionStatus('scanning');
    console.log(
      `[BLEService] startScanning called. demoMode=${this.mockMode ? 'ON' : 'OFF'}`,
    );

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.log('[BLEService] Required BLE permissions were not granted.');
      this.stopScanning();
      this.promptDemoMode(
        'BLE permissions required',
        'Bluetooth permissions were denied. Grant permissions to scan real BLE devices, or switch to demo mode for UI testing.',
      );
      return;
    }

    const bluetoothState = await this.waitForPoweredOn();
    if (bluetoothState !== State.PoweredOn) {
      console.log(`[BLEService] Bluetooth adapter is not ready. finalState=${bluetoothState}`);
      this.stopScanning();
      this.promptDemoMode(
        'Bluetooth unavailable',
        `Bluetooth is not ready for BLE scanning. Current state: ${bluetoothState}. Please make sure Bluetooth is turned on and permissions are allowed, then try again. If you are still blocked, you can use demo mode.`,
      );
      return;
    }

    if (this.mockMode) {
      console.log('[BLEService] Demo mode is ON. Starting mock scan flow.');
      this.startMockScan();
      return;
    }

    this.clearTimers();
    console.log('[BLEService] Starting native BLE device scan.');
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('[BLEService] Native BLE scan error:', error);
        this.stopScanning();
        this.promptDemoMode(
          'BLE scan failed',
          'The Bluetooth scan could not start in this environment. Try again on a physical Android device, or use demo mode.',
        );
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

  private startMockScan() {
    this.clearTimers();
    useBLEStore.getState().setConnectionStatus('scanning');
    useBLEStore.getState().clearScannedDevices();
    const mockDevices = buildMockDevices();
    console.log(`[BLEService] Mock scanning started with ${mockDevices.length} generated devices.`);

    let index = 0;
    this.mockInterval = setInterval(() => {
      if (index >= mockDevices.length) {
        console.log('[BLEService] Mock scan completed.');
        this.stopScanning();
        return;
      }

      useBLEStore.getState().addOrUpdateScannedDevice(mockDevices[index] as Device);
      console.log(
        `[BLEService] Mock device emitted: ${(mockDevices[index]?.name as string) ?? mockDevices[index]?.id}`,
      );
      index += 1;
    }, 800);

    this.scanTimeout = setTimeout(() => {
      console.log('[BLEService] Mock scan timed out after 9 seconds.');
      this.stopScanning();
    }, 9000);
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

    if (this.mockMode) {
      await new Promise<void>(resolve => setTimeout(resolve, 1800));
      useBLEStore.getState().hydrateConnectionSnapshot({
        device,
        batteryLevel: null,
        lastSyncedAt: nowTimeLabel(),
      });
      return { success: true, device };
    }

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
      if (device && !this.mockMode) {
        await this.manager.cancelDeviceConnection(device.id);
      } else {
        await new Promise<void>(resolve => setTimeout(resolve, 600));
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

    if (this.mockMode) {
      await new Promise<void>(resolve => setTimeout(resolve, 900));
      useBLEStore.getState().setLastSyncedAt(nowTimeLabel());
      useBLEStore.getState().setConnectionStatus('connected');
      return true;
    }

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

    if (this.mockMode) {
      await new Promise<void>(resolve => setTimeout(resolve, 900));
      useBLEStore.getState().setLastSyncedAt(nowTimeLabel());
      useBLEStore.getState().setConnectionStatus('connected');
      return true;
    }

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
