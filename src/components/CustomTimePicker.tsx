import React, { useEffect, useRef } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '../utils/theme';

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const hourItems = Array.from({ length: 12 }).map((_, i) => `${i + 1}`);
const minuteItems = Array.from({ length: 60 }).map((_, i) => `${i}`.padStart(2, '0'));
const periodItems = ['AM', 'PM'];

const ITEM_HEIGHT = 52;

interface WheelProps {
  items: string[];
  selectedItem: string;
  onItemChange: (item: string) => void;
}

function Wheel({ items, selectedItem, onItemChange }: WheelProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const selectedIndex = items.indexOf(selectedItem);

  useEffect(() => {
    if (selectedIndex !== -1 && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [selectedIndex]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const yOffset = e.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    const newItem = items[clampedIndex];
    if (newItem !== selectedItem) {
      onItemChange(newItem);
    }
  };

  return (
    <View style={styles.wheelWrapper}>
      {/* Selection highlight bar */}
      <View pointerEvents="none" style={styles.highlightBar} />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top padding to center first item */}
        <View style={styles.padder} />
        {items.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.itemContainer}>
            <Text
              style={[
                styles.itemText,
                item === selectedItem ? styles.itemTextSelected : styles.itemTextUnselected,
              ]}>
              {item}
            </Text>
          </View>
        ))}
        {/* Bottom padding to center last item */}
        <View style={styles.padder} />
      </ScrollView>
    </View>
  );
}

export default function CustomTimePicker({
  value,
  onChange,
}: CustomTimePickerProps) {
  const [hoursRaw = '06', minutesRaw = '30'] = value.split(':');
  const h = Number(hoursRaw);
  const m = Number(minutesRaw);

  const hour12 = h % 12 || 12;
  const period = h >= 12 ? 'PM' : 'AM';

  const formatTo24h = (h12Val: number, mVal: number, pVal: string) => {
    let finalH = h12Val;
    if (pVal === 'PM' && finalH < 12) finalH += 12;
    if (pVal === 'AM' && finalH === 12) finalH = 0;
    return `${`${finalH}`.padStart(2, '0')}:${`${mVal}`.padStart(2, '0')}`;
  };

  const handleHourChange = (newHour: string) =>
    onChange(formatTo24h(Number(newHour), m, period));

  const handleMinuteChange = (newMin: string) =>
    onChange(formatTo24h(hour12, Number(newMin), period));

  const handlePeriodChange = (newPeriod: string) =>
    onChange(formatTo24h(hour12, m, newPeriod));

  return (
    <View style={styles.pickerRoot}>
      {/* Column labels */}
      <View style={styles.columnLabels}>
        <Text style={styles.columnLabel}>Hour</Text>
        <Text style={styles.columnLabel}>Minute</Text>
        <Text style={styles.columnLabel}>Period</Text>
      </View>

      {/* Wheel picker */}
      <View style={styles.pickerContainer}>
        <Wheel items={hourItems} selectedItem={`${hour12}`} onItemChange={handleHourChange} />
        <View style={styles.divider} />
        <Wheel items={minuteItems} selectedItem={minutesRaw} onItemChange={handleMinuteChange} />
        <View style={styles.divider} />
        <Wheel items={periodItems} selectedItem={period} onItemChange={handlePeriodChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerRoot: {
    width: '100%',
  },
  columnLabels: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  columnLabel: {
    flex: 1,
    textAlign: 'center',
    color: palette.textSoft,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pickerContainer: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * 5,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  wheelWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    // no extra padding — padding handled by padder views
  },
  padder: {
    height: ITEM_HEIGHT * 2,
  },
  highlightBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    zIndex: 10,
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  itemTextSelected: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  itemTextUnselected: {
    color: 'rgba(255,255,255,0.25)',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
