import { Device } from 'react-native-ble-plx';

export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'syncing';

export interface Alarm {
  id: string;
  time: string;
  enabled: boolean;
  intensity: number;
  repeatDays: number[];
}

export interface AlarmPayload {
  type: 'alarm';
  time: string;
  enabled: boolean;
  intensity: number;
}

export interface ConnectResult {
  success: boolean;
  device?: Device;
  error?: string;
}
