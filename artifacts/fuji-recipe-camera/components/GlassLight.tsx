'use no memo'; // Skia + reanimated shared values; see FilmCamera.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { GLASS_LIGHT_DIR, GLASS_SKSL } from '@/lib/glass-shader';

/**
 * Edge lighting for a Glass panel (rim, bevel, bounce light, inner tray line, sheen), drawn by
 * lib/glass-shader.ts over the panel's blur and tinted body. Static: Skia redraws it only
 * when the panel's size or press amount changes. `null` when the SkSL does not compile on this
 * device, in which case Glass keeps its layered-gradient look.
 */
const effect = (() => {
  try {
    return Skia.RuntimeEffect.Make(GLASS_SKSL);
  } catch (error) {
    console.warn('Glass shader failed to compile, using gradients:', error);
    return null;
  }
})();

export const GLASS_LIGHT_READY = effect != null;

export function GlassLight({
  radius,
  dark,
  press,
}: {
  radius: number;
  dark: boolean;
  /** 0..1 press amount from PressableScale, brightens the light. */
  press?: SharedValue<number> | null;
}) {
  const size = useSharedValue({ width: 0, height: 0 });
  const uniforms = useDerivedValue(() => ({
    size: [size.value.width, size.value.height],
    radius,
    lightDir: [GLASS_LIGHT_DIR[0], GLASS_LIGHT_DIR[1]],
    press: press ? press.value : 0,
    dark: dark ? 1 : 0,
    strength: 1,
  }));

  if (!effect) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={styles.canvas} onSize={size}>
        <Fill>
          <Shader source={effect} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
