import { useCallback } from 'react';

import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';

export const useBleScan = () => {
  const connectionStatus = useBLEStore(state => state.connectionStatus);
  const isDemoMode = useBLEStore(state => state.isDemoMode);
  const setDemoMode = useBLEStore(state => state.setDemoMode);

  const startScan = useCallback(async () => {
    await bleService.startScanning();
  }, []);

  const stopScan = useCallback(() => {
    bleService.stopScanning();
  }, []);

  const toggleDemoMode = useCallback(async () => {
    const next = !useBLEStore.getState().isDemoMode;
    setDemoMode(next);
    bleService.setMockMode(next);
    bleService.stopScanning();
    await bleService.startScanning();
  }, [setDemoMode]);

  return {
    connectionStatus,
    isDemoMode,
    isScanning: connectionStatus === 'scanning',
    startScan,
    stopScan,
    toggleDemoMode,
  };
};
