import { Alarm, AlarmPayload } from '../types/ble';
import { palette } from './theme';

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const buildAlarmPayload = (alarm: Alarm): AlarmPayload => ({
  type: 'alarm',
  time: alarm.time,
  enabled: alarm.enabled,
  intensity: alarm.intensity,
});

export const formatTime12Hour = (value: string) => {
  const [hoursRaw = '0', minutes = '00'] = value.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${minutes} ${period}`;
};

export const formatSyncTime = (value: string | null) => {
  if (!value) {
    return 'Waiting for first sync';
  }

  return `Last sync ${value}`;
};

export const getRepeatLabel = (days: number[]) => {
  if (days.length === 7) {
    return 'Every day';
  }

  if (days.length === 5 && !days.includes(0) && !days.includes(6)) {
    return 'Weekdays';
  }

  if (days.length === 2 && days.includes(0) && days.includes(6)) {
    return 'Weekend';
  }

  return days
    .slice()
    .sort((left, right) => left - right)
    .map(day => weekdayNames[day])
    .join(' • ');
};

export const getSignalTone = (rssi?: number | null) => {
  if (rssi == null) {
    return { label: 'Unknown', color: palette.textSoft };
  }

  if (rssi >= -58) {
    return { label: 'Excellent', color: palette.cyan };
  }

  if (rssi >= -68) {
    return { label: 'Strong', color: palette.green };
  }

  if (rssi >= -78) {
    return { label: 'Fair', color: palette.amber };
  }

  return { label: 'Weak', color: palette.red };
};

export const getBatteryTone = (value: number | null) => {
  if (value == null) {
    return palette.textSoft;
  }

  if (value >= 65) {
    return palette.cyan;
  }

  if (value >= 30) {
    return palette.amber;
  }

  return palette.red;
};
