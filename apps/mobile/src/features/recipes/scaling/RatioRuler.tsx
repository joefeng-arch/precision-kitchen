import { useCallback, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Typography } from '@/components/ui';
import { colors, shadows } from '@/lib/theme/tokens';

import { useDebouncedCallback } from './useDebouncedCallback';

const HANDLE_SIZE = 28;
const TRACK_HEIGHT = 40;

export interface RatioRulerProps {
  /** Positions the handle once on mount. To reset (profile/member switch), remount via a `key` prop change rather than feeding a new value in — see ScalingWorkbench usage. */
  initialValue: number;
  /** Called continuously, debounced (~debounceMs) as the user drags. */
  onChange: (value: number) => void;
  /** Fires immediately on gesture end, bypassing the debounce window. */
  onSettle?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  debounceMs?: number;
  label: string;
  unit?: string;
  formatValue?: (v: number) => string;
  disabled?: boolean;
}

function clampJs(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function RatioRuler({
  initialValue,
  onChange,
  onSettle,
  min,
  max,
  step = 1,
  debounceMs = 200,
  label,
  unit,
  formatValue,
  disabled,
}: RatioRulerProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [liveValue, setLiveValue] = useState(initialValue);
  const debounced = useDebouncedCallback(onChange, debounceMs);
  const hasPositioned = useRef(false);

  const range = Math.max(max - min, 1e-6);
  const valueToX = useCallback(
    (v: number, width: number) => ((clampJs(v, min, max) - min) / range) * width,
    [min, range],
  );
  const xToValue = useCallback(
    (x: number, width: number) => {
      const raw = min + (clampJs(x, 0, width) / Math.max(width, 1)) * range;
      return step > 0 ? Math.round(raw / step) * step : raw;
    },
    [min, range, step],
  );

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  // Distinguishes a real drag from the one-time programmatic reposition onLayout
  // does on mount — without this guard, that initial reposition would trigger the
  // reaction below using a stale (pre-re-render) trackWidth of 0, incorrectly
  // reporting `min` as if the user had dragged there.
  const isUserDriven = useSharedValue(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setTrackWidth(width);
    if (!hasPositioned.current && width > 0) {
      hasPositioned.current = true;
      translateX.value = valueToX(initialValue, width);
    }
  };

  const reportRawValue = useCallback(
    (x: number) => {
      const v = xToValue(x, trackWidth);
      setLiveValue(v);
      debounced.call(v);
    },
    [xToValue, trackWidth, debounced],
  );

  const handleSettle = useCallback(
    (x: number) => {
      const v = xToValue(x, trackWidth);
      setLiveValue(v);
      debounced.flush(v);
      onSettle?.(v);
    },
    [xToValue, trackWidth, debounced, onSettle],
  );

  useAnimatedReaction(
    () => translateX.value,
    (current, previous) => {
      if (isUserDriven.value && previous !== null && current !== previous) {
        runOnJS(reportRawValue)(current);
      }
    },
    [reportRawValue],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .onStart(() => {
          isUserDriven.value = true;
          startX.value = translateX.value;
        })
        .onUpdate((e) => {
          translateX.value = Math.min(trackWidth, Math.max(0, startX.value + e.translationX));
        })
        .onEnd(() => {
          runOnJS(handleSettle)(translateX.value);
          isUserDriven.value = false;
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, trackWidth],
  );

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - HANDLE_SIZE / 2 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: translateX.value }));

  const display = formatValue ? formatValue(liveValue) : liveValue.toFixed(0);

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          {label.toUpperCase()}
        </Typography>
        <View className="flex-row items-baseline gap-1">
          <Typography variant="measurementLg" className="text-primary">
            {display}
          </Typography>
          {unit && (
            <Typography variant="measurementSm" className="text-on-surface-variant">
              {unit}
            </Typography>
          )}
        </View>
      </View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={onLayout}
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: colors['surface-container'],
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT / 2,
                backgroundColor: colors['primary-container'],
              },
              fillStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: (TRACK_HEIGHT - HANDLE_SIZE) / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                borderRadius: HANDLE_SIZE / 2,
                backgroundColor: colors['surface-container-lowest'],
              },
              shadows.card,
              handleStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
