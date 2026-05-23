import { Device } from 'react-native-ble-plx';
import { create } from 'zustand';

import { Alarm, ConnectionStatus } from '../types/ble';

interface BLEState {
  scannedDevices: Device[];
  connectedDevice: Device | null;
  connectionStatus: ConnectionStatus;
  batteryLevel: number | null;
  lastSyncedAt: string | null;
  alarms: Alarm[];
  isDemoMode: boolean;
  pendingPayload: string | null;
  addOrUpdateScannedDevice: (device: Device) => void;
  clearScannedDevices: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setConnectedDevice: (device: Device | null) => void;
  setBatteryLevel: (level: number | null) => void;
  setLastSyncedAt: (value: string | null) => void;
  setDemoMode: (value: boolean) => void;
  setPendingPayload: (value: string | null) => void;
  upsertAlarm: (alarm: Alarm) => void;
  toggleAlarm: (id: string) => void;
  deleteAlarm: (id: string) => void;
  hydrateConnectionSnapshot: (snapshot: {
    device: Device;
    batteryLevel: number | null;
    lastSyncedAt: string;
  }) => void;
  resetConnection: () => void;
}

export const useBLEStore = create<BLEState>((set) => ({
  scannedDevices: [],
  connectedDevice: null,
  connectionStatus: 'idle',
  batteryLevel: null,
  lastSyncedAt: null,
  alarms: [],
  isDemoMode: true,
  pendingPayload: null,
  addOrUpdateScannedDevice: (device) =>
    set((state) => {
      const existingIndex = state.scannedDevices.findIndex(
        scanned => scanned.id === device.id,
      );

      if (existingIndex === -1) {
        return {
          scannedDevices: [...state.scannedDevices, device].sort((left, right) => {
            const leftRssi = left.rssi ?? -999;
            const rightRssi = right.rssi ?? -999;
            return rightRssi - leftRssi;
          }),
        };
      }

      const nextDevices = [...state.scannedDevices];
      nextDevices[existingIndex] = device;
      nextDevices.sort((left, right) => (right.rssi ?? -999) - (left.rssi ?? -999));

      return { scannedDevices: nextDevices };
    }),
  clearScannedDevices: () => set({ scannedDevices: [] }),
  setConnectionStatus: status => set({ connectionStatus: status }),
  setConnectedDevice: connectedDevice => set({ connectedDevice }),
  setBatteryLevel: batteryLevel => set({ batteryLevel }),
  setLastSyncedAt: lastSyncedAt => set({ lastSyncedAt }),
  setDemoMode: isDemoMode => set({ isDemoMode }),
  setPendingPayload: pendingPayload => set({ pendingPayload }),
  upsertAlarm: (alarm) =>
    set((state) => {
      const exists = state.alarms.some(item => item.id === alarm.id);
      return {
        alarms: exists
          ? state.alarms.map(item => (item.id === alarm.id ? alarm : item))
          : [alarm, ...state.alarms],
      };
    }),
  toggleAlarm: (id) =>
    set((state) => ({
      alarms: state.alarms.map(alarm =>
        alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm,
      ),
    })),
  deleteAlarm: id =>
    set((state) => ({
      alarms: state.alarms.filter(alarm => alarm.id !== id),
    })),
  hydrateConnectionSnapshot: ({ device, batteryLevel, lastSyncedAt }) =>
    set({
      connectedDevice: device,
      batteryLevel,
      lastSyncedAt,
      connectionStatus: 'connected',
    }),
  resetConnection: () =>
    set({
      connectedDevice: null,
      connectionStatus: 'idle',
      batteryLevel: null,
      lastSyncedAt: null,
      pendingPayload: null,
    }),
}));
