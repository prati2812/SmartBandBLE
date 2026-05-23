/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const View = require('react-native').View;

  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children }: { children: React.ReactNode }) => children,
    },
    Easing: {
      out: (value: unknown) => value,
      quad: {},
    },
    useSharedValue: (initialValue: number) => ({ value: initialValue }),
    useAnimatedStyle: (updater: () => unknown) => updater(),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => children,
      Screen: () => null,
    }),
  };
});

jest.mock('react-native-base64', () => ({
  __esModule: true,
  default: {
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
}));

jest.mock('react-native-ble-plx', () => ({
  BleManager: function BleManager() {
    return {
      onStateChange: () => ({ remove: jest.fn() }),
      state: jest.fn().mockResolvedValue('PoweredOn'),
      startDeviceScan: jest.fn(),
      stopDeviceScan: jest.fn(),
      cancelDeviceConnection: jest.fn(),
      destroy: jest.fn(),
    };
  },
  State: {
    PoweredOn: 'PoweredOn',
    PoweredOff: 'PoweredOff',
  },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
