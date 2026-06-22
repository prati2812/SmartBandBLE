import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Device } from 'react-native-ble-plx';
import Svg, { Circle, Path } from 'react-native-svg';

import BLELoader from '../components/BLELoader';
import DeviceCard from '../components/DeviceCard';
import GradientBackground from '../components/GradientBackground';
import { useBleScan } from '../hooks/useBleScan';
import { bleService } from '../services/bleService';
import { useBLEStore } from '../store/useBLEStore';
import { RootStackParamList } from '../types/navigation';
import { showToast } from '../utils/toast';
import { palette, radii, spacing } from '../utils/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

export default function Scan({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const devices = useBLEStore(state => state.scannedDevices);
  const connectedDevice = useBLEStore(state => state.connectedDevice);
  const { isScanning, startScan, stopScan } = useBleScan();
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  useEffect(() => {
    startScan();
    return () => { stopScan(); };
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

  const loaderSize = isSmall ? 110 : 148;
  const hPad = isSmall ? spacing.md : spacing.xl;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          style={styles.list}
          data={devices}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: hPad }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* ── Header ── */}
              <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M15 18L9 12L15 6"
                      stroke={palette.text}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>

                <View style={styles.headerCopy}>
                  <Text style={[styles.headerKicker, isSmall && styles.textShrink]}>
                    Bluetooth Low Energy
                  </Text>
                  <Text style={[styles.headerTitle, isSmall && styles.headerTitleSmall]}>
                    Nearby Devices
                  </Text>
                </View>

                {/* Scanning pulse indicator */}
                <View style={styles.scanIndicator}>
                  <View style={[
                    styles.scanDot,
                    { backgroundColor: isScanning ? palette.whoopGreen : palette.textSoft },
                  ]} />
                  <Text style={[styles.scanLabel, isSmall && styles.textShrink]}>
                    {isScanning ? 'Live' : 'Paused'}
                  </Text>
                </View>
              </View>

              {/* ── Hero Radar Card ── */}
              <View style={[styles.heroCard, isSmall && styles.heroCardSmall]}>
                <BLELoader size={loaderSize} isScanning={isScanning} />

                <View style={styles.heroTextBlock}>
                  <Text style={[styles.heroTitle, isSmall && styles.heroTitleSmall]}>
                    {isScanning ? 'Scanning for wearables' : 'Scan paused'}
                  </Text>
                  <Text style={[styles.heroSubtitle, isSmall && styles.heroSubtitleSmall]}>
                    {isScanning
                      ? 'Keep your band close and powered on.'
                      : 'Tap the button below to resume.'}
                  </Text>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <StatPill label="Found" value={`${devices.length}`} />
                  <View style={styles.statsDivider} />
                  <StatPill label="Status" value={isScanning ? 'Active' : 'Idle'} highlight={isScanning} />
                  <View style={styles.statsDivider} />
                  <StatPill label="Protocol" value="BLE 5.0" />
                </View>
              </View>

              {/* ── List header ── */}
              {devices.length > 0 && (
                <View style={styles.listHeader}>
                  <View style={styles.listHeaderLeft}>
                    <View style={styles.listHeaderDot} />
                    <Text style={[styles.listKicker, isSmall && styles.textShrink]}>
                      Discovered wearables
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{devices.length}</Text>
                  </View>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              {/* Idle icon */}
              <View style={styles.emptyIconWrap}>
                <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="12" r="9" stroke={palette.textSoft} strokeWidth="1.5" />
                  <Path
                    d="M8 12h8M12 8v8"
                    stroke={palette.textSoft}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.emptyTitle, isSmall && styles.emptyTitleSmall]}>
                No wearables found yet
              </Text>
              <Text style={[styles.emptyText, isSmall && styles.textShrink]}>
                Make sure your band is powered on, in range, and advertising over BLE. It usually takes a few seconds.
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

        {/* ── Floating Action Button ── */}
        <Pressable
          onPress={isScanning ? stopScan : startScan}
          style={({ pressed }) => [
            styles.fab,
            isScanning ? styles.fabStop : styles.fabStart,
            pressed && styles.fabPressed,
          ]}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            {isScanning ? (
              <Path
                d="M6 6h12v12H6z"
                fill={palette.bg}
              />
            ) : (
              <Path
                d="M5 3l14 9-14 9V3z"
                fill={palette.bg}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
          <Text style={styles.fabLabel}>
            {isScanning ? 'Stop' : 'Scan'}
          </Text>
        </Pressable>

        {/* ── Connecting Modal ── */}
        <Modal visible={!!activeDevice} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <BLELoader size={isSmall ? 96 : 120} isScanning />

              <Text style={[styles.modalTitle, isSmall && styles.modalTitleSmall]}>
                Connecting…
              </Text>
              <Text style={[styles.modalDevice, isSmall && styles.textShrink]}>
                {activeDevice?.name || activeDevice?.localName || 'Wearable'}
              </Text>
              <Text style={[styles.modalSubtitle, isSmall && styles.textShrink]}>
                Discovering writable BLE services and establishing a secure link.
              </Text>

              {/* Progress dots */}
              <View style={styles.dotsRow}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={styles.dot} />
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Small helper ── */
function StatPill({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={statStyles.pill}>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={[statStyles.value, highlight && statStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: { flex: 1, alignItems: 'center' },
  label: { color: palette.textSoft, fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  value: { color: palette.text, fontSize: 14, fontWeight: '700' },
  valueHighlight: { color: palette.whoopGreen },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  headerCopy: { flex: 1 },
  headerKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  headerTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerTitleSmall: {
    fontSize: 18,
  },
  scanIndicator: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  scanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scanLabel: {
    color: palette.textSoft,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* Hero Card */
  heroCard: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  heroCardSmall: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  heroTextBlock: {
    alignItems: 'center',
  },
  heroTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  heroTitleSmall: {
    fontSize: 15,
  },
  heroSubtitle: {
    marginTop: 4,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
    maxWidth: 260,
  },
  heroSubtitleSmall: {
    fontSize: 12,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  /* List header */
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.whoopGreen,
  },
  listKicker: {
    color: palette.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  countText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: palette.bgCardStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyTitleSmall: {
    fontSize: 15,
  },
  emptyText: {
    color: palette.textMuted,
    lineHeight: 20,
    fontSize: 13,
    textAlign: 'center',
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  fabStart: {
    backgroundColor: palette.whoopBlue,
  },
  fabStop: {
    backgroundColor: palette.amber,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  fabLabel: {
    color: palette.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Connecting Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#111113',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.md,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalTitleSmall: {
    fontSize: 17,
  },
  modalDevice: {
    color: palette.whoopBlue,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    marginTop: spacing.sm,
    color: palette.textMuted,
    lineHeight: 20,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.lg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.whoopBlue,
    opacity: 0.5,
  },

  /* Shared text util */
  textShrink: {
    fontSize: 11,
  },
});
