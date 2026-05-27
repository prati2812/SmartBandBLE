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
  duration_sec: number;
  snooze: number;
  pattern: 'normal' | 'gentle' | 'heavy_sleeper' | 'escalating';
}

export interface AlarmPayload {
  cmd: 'set_alarm';
  alarm_id: string;
  alarm_time: string;
  enabled: boolean;
  intensity: number;
  duration_sec: number;
  snooze: number;
  pattern: 'normal' | 'gentle' | 'heavy_sleeper' | 'escalating';
  repeat: string[];
}

export interface SyncAlarmsPayload {
  cmd: 'sync_alarms';
  alarms: Omit<AlarmPayload, 'cmd'>[];
}

export interface ConnectResult {
  success: boolean;
  device?: Device;
  error?: string;
}
