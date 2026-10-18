'use no memo'; // Skia + reanimated shared values; see FilmCamera.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { AURORA_COLORS, AURORA_SKSL } from '@/lib/aurora-shader';
import { useColors } from '@/hooks/useColors';

/**
 * Slow flowing colour field behind a screen (lib/aurora-shader.ts), so the glass on top has
 * something to catch the light. Drawn at a quarter of the screen's pixel size and scaled up
 * (it is all soft gradients, so nothing is lost), animated only while the screen is focused,
 * and dark-theme only: on the light theme it draws nothing. `null` if the SkSL does not compile.
 */
const SCALE = 4;
/** Drift speed multiplier; the shader also scales time by 0.07 internally. */
const DRIFT = 1 / 1000;
/** Time shown while paused and for the first frame. */
const STILL_TIME = 12;

const effect = (() => {
  try {
    return Skia.RuntimeEffect.Make(AURORA_SKSL);
  } catch (error) {
    console.warn('Aurora shader failed to compile, skipping it:', error);
    return null;
  }
})();

export const AURORA_READY = effect != null;

function AuroraCanvas({ time }: { time: SharedValue<number> | null }) {
  const size = useSharedValue({ width: 1, height: 1 });
  const uniforms = useDerivedValue(() => ({
    res: [Math.max(size.value.width, 1), Math.max(size.value.height, 1)],
    time: time ? STILL_TIME + time.value * DRIFT : STILL_TIME,
    color1: [...AURORA_COLORS.color1],
    color2: [...AURORA_COLORS.color2],
    color3: [...AURORA_COLORS.color3],
    intensity: 0.8,
  }));
  if (!effect) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} onSize={size}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

function Running() {
  return <AuroraCanvas time={useClock()} />;
}

export function Aurora() {
  const colors = useColors();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  if (!effect || colors.blurTint !== 'dark') return null;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setBox(event.nativeEvent.layout)}
    >
      {box.width > 0 && (
        <View
          style={{
            width: box.width / SCALE,
            height: box.height / SCALE,
            transform: [{ scale: SCALE }],
            transformOrigin: 'top left',
          }}
        >
          {focused ? <Running /> : <AuroraCanvas time={null} />}
        </View>
      )}
    </View>
  );
}
