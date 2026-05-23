import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Device } from 'react-native-ble-plx';
import Svg, { Path } from 'react-native-svg';

import BLELoader from '../components/BLELoader';
import DeviceCard from '../components/DeviceCard';
import GradientBackground from '../components/GradientBackground';
import PrimaryButton from '../components/PrimaryButton';
import { useBleScan } from '../hooks/useBleScan';
import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';
import { RootStackParamList } from '../types/navigation';
import { showToast } from '../utils/toast';
import { palette, radii, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export default function Scan({ navigation }: Props) {
  const devices = useBLEStore(state => state.scannedDevices);
  const connectedDevice = useBLEStore(state => state.connectedDevice);
  const { isDemoMode, isScanning, startScan, stopScan, toggleDemoMode } = useBleScan();
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  useEffect(() => {
    startScan();
    return () => {
      stopScan();
    };
  }, [startScan, stopScan]);

  const handleConnect = async (device: Device) => {
    setActiveDevice(device);
    const result = await bleService.connectToDevice(device);
    setActiveDevice(null);

    if (result.success) {
      showToast(`${device.name || 'Wearable'} connected`);
      navigation.goBack();
      return;
    }

    showToast(result.error || 'Unable to connect to wearable');
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          style={styles.list}
          data={devices}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <Path d="M15 18L9 12L15 6" stroke={palette.text} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Pressable>

                <View style={styles.headerCopy}>
                  <Text style={styles.headerKicker}>Bluetooth Low Energy</Text>
                  <Text style={styles.headerTitle}>Scan nearby smart bands</Text>
                </View>
              </View>

              <View style={styles.heroCard}>
                <BLELoader size={172} isScanning={isScanning} />
                <Text style={styles.heroTitle}>
                  {isScanning ? 'Searching for wearable devices' : 'Scan paused'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {isDemoMode
                    ? 'Demo mode is active so you can test the premium flow without a physical device.'
                    : 'Keep your smart band close to the phone while we scan and resolve writable BLE services.'}
                </Text>

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Demo mode</Text>
                  <PrimaryButton
                    title={isDemoMode ? 'Using demo data' : 'Use demo data'}
                    variant="secondary"
                    style={styles.demoButton}
                    onPress={toggleDemoMode}
                  />
                </View>
              </View>

              <View style={styles.listHeader}>
                <View>
                  <Text style={styles.listKicker}>Nearby devices</Text>
                  <Text style={styles.listTitle}>{devices.length} found</Text>
                </View>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No wearables discovered yet</Text>
              <Text style={styles.emptyText}>
                Keep scanning for a few seconds or enable demo mode to preview the app flow.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              onConnect={handleConnect}
              isConnecting={activeDevice?.id === item.id}
              isConnected={connectedDevice?.id === item.id}
            />
          )}
        />

        <Pressable
          onPress={isScanning ? stopScan : startScan}
          style={[styles.fab, isScanning ? styles.fabStop : styles.fabStart]}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {isScanning ? (
              <Path d="M7 7H17V17H7V7Z" fill={palette.bg} />
            ) : (
              <Path
                d="M12 2V22M12 2L17 7L7 17M7 7L17 17L12 22"
                stroke={palette.bg}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </Pressable>

        <Modal visible={!!activeDevice} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <BLELoader size={132} isScanning />
              <Text style={styles.modalTitle}>Connecting securely</Text>
              <Text style={styles.modalSubtitle}>
                Linking to {activeDevice?.name || activeDevice?.localName || 'wearable'} and discovering writable services.
              </Text>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  header: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 6,
  },
  heroCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    backgroundColor: palette.bgCard,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroTitle: {
    marginTop: spacing.lg,
    color: palette.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  toggleRow: {
    width: '100%',
    marginTop: spacing.xl,
  },
  toggleLabel: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  demoButton: {
    minHeight: 48,
  },
  listHeader: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  listKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  listTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: palette.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: palette.textMuted,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabStart: {
    backgroundColor: palette.cyan,
  },
  fabStop: {
    backgroundColor: palette.amber,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: palette.bgElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  modalSubtitle: {
    marginTop: spacing.sm,
    color: palette.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
});
