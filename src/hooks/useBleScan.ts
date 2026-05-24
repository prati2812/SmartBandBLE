import { useCallback } from 'react';

import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';

export const useBleScan = () => {
  const connectionStatus = useBLEStore(state => state.connectionStatus);

  const startScan = useCallback(async () => {
    await bleService.startScanning();
  }, []);

  const stopScan = useCallback(() => {
    bleService.stopScanning();
  }, []);

  return {
    connectionStatus,
    isScanning: connectionStatus === 'scanning',
    startScan,
    stopScan,
  };
};
