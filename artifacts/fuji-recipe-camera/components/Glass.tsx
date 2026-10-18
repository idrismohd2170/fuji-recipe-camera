import React, { createContext, useContext, useRef, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { PressContext } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';

/**
 * Master switch for the real Android blur. If a device shows blank or broken glass,
 * set this to false: every Glass then falls back to the tinted fill (always safe).
 * [unverified on device: real blur needs Android 12+, which the S24 Ultra has]
 */
const REAL_BLUR = true;

/**
 * Panels with a radius of at least this get their edge lighting from a Skia shader
 * (components/GlassLight.tsx); smaller controls (round buttons, pills, badges) keep the cheap
 * layered gradients, because each shader panel is its own small Skia canvas and the camera
 * screen already runs one for the live preview. Set SHADER_GLASS to false to use the gradients
 * everywhere. The module is required lazily and checked, so a Skia or shader failure falls back
 * to the gradients instead of taking the app down. [unverified on device]
 */
const SHADER_GLASS = true;
const SHADER_MIN_RADIUS = 24;
let GlassLightImpl: typeof import('@/components/GlassLight').GlassLight | null = null;
if (SHADER_GLASS) {
  try {
    const light: typeof import('@/components/GlassLight') = require('@/components/GlassLight');
    if (light.GLASS_LIGHT_READY) GlassLightImpl = light.GlassLight;
  } catch (error) {
    console.warn('Glass shader unavailable, using gradients:', error);
  }
}

type BlurTargetRef = RefObject<View | null>;
const BlurTargetContext = createContext<BlurTargetRef | null>(null);

/**
 * Real blur on Android needs the content to blur wrapped in a `GlassBackdrop`, with the
 * `Glass` panels as siblings (never children) of it, all inside one `GlassScope`:
 *
 *   <GlassScope>
 *     <GlassBackdrop style={{ flex: 1 }}>...scrolling content...</GlassBackdrop>
 *     <Glass>...floating panel...</Glass>
 *   </GlassScope>
 *
 * A Glass outside any scope, or over a native surface such as the camera preview (which
 * cannot be captured), uses the tinted fill instead.
 */
export function GlassScope({ children }: { children: React.ReactNode }) {
  const ref = useRef<View | null>(null);
  return <BlurTargetContext.Provider value={ref}>{children}</BlurTargetContext.Provider>;
}

/**
 * Wrap the contents of a Modal in this. A Modal is a separate native window, so a blur
 * target outside it cannot be used from inside; its Glass panels use the tinted fill.
 */
export function GlassNoBlur({ children }: { children: React.ReactNode }) {
  return <BlurTargetContext.Provider value={null}>{children}</BlurTargetContext.Provider>;
}

export function GlassBackdrop({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useContext(BlurTargetContext);
  if (Platform.OS !== 'android' || !REAL_BLUR || !ref) {
    return <View style={style}>{children}</View>;
  }
  return (
    <BlurTargetView ref={ref} style={style}>
      {children}
    </BlurTargetView>
  );
}

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  /** Force the dark treatment (e.g. controls floating over the camera preview). */
  forceDark?: boolean;
  /** Soft drop shadow under the panel. */
  depth?: boolean;
};

/**
 * Liquid-glass surface, from back to front:
 *   1. blur (real on Android inside a GlassScope, otherwise a translucent fill)
 *   2. tinted body fill
 *   3. edge lighting: a Skia shader on panels with radius >= SHADER_MIN_RADIUS (rim, bevel,
 *      bounce light, inner tray line, sheen, adapted from liquid-glass-js); otherwise layered
 *      gradients: a sheen fading down from the top, an inner glow rising from the bottom, a
 *      top rim line and a bevelled hairline
 *   4. press lift: a white overlay that follows the PressableScale around it
 */
export function Glass({
  children,
  style,
  radius = 24,
  intensity = 40,
  forceDark = false,
  depth = true,
}: Props) {
  const colors = useColors();
  const blurTarget = useContext(BlurTargetContext);
  const pressed = useContext(PressContext);
  // Brightens while the PressableScale around this glass is pressed.
  const liftStyle = useAnimatedStyle(() => ({ opacity: (pressed?.value ?? 0) * 0.16 }));
  const dark = forceDark || colors.blurTint === 'dark';
  const realBlur = Platform.OS === 'android' && REAL_BLUR && !!blurTarget;
  const shaderLight = GlassLightImpl !== null && radius >= SHADER_MIN_RADIUS;

  const sheen = dark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.70)';
  const glow = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.35)';
  const rim = dark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.95)';
  const edgeTop = dark ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.9)';
  const edgeSide = forceDark ? 'rgba(255,255,255,0.14)' : colors.glassBorder;
  const edgeBottom = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  // With a real blur behind it the body fill can be thinner so the blur shows through.
  const body = forceDark
    ? realBlur
      ? 'rgba(28,28,30,0.38)'
      : 'rgba(28,28,30,0.62)'
    : realBlur
      ? dark
        ? 'rgba(38,38,40,0.42)'
        : 'rgba(255,255,255,0.42)'
      : colors.glass;

  return (
    <View
      style={[
        styles.base,
        depth && styles.depth,
        { borderRadius: radius },
        style,
      ]}
    >
      <BlurView
        tint={dark ? 'dark' : 'light'}
        intensity={intensity}
        blurTarget={realBlur ? blurTarget : undefined}
        blurMethod={realBlur ? 'dimezisBlurViewSdk31Plus' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: body }]} />
      {shaderLight && GlassLightImpl ? (
        <GlassLightImpl radius={radius} dark={dark} press={pressed} />
      ) : (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[sheen, 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.sheen}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', glow]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.glow}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', rim, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.rim, { left: radius * 0.6, right: radius * 0.6 }]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.edge,
              {
                borderRadius: radius,
                borderTopColor: edgeTop,
                borderLeftColor: edgeSide,
                borderRightColor: edgeSide,
                borderBottomColor: edgeBottom,
              },
            ]}
          />
        </>
      )}
      {pressed && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.lift, liftStyle]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  depth: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  glow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%' },
  rim: { position: 'absolute', top: 0, height: 1 },
  lift: { backgroundColor: '#fff' },
  edge: { borderWidth: StyleSheet.hairlineWidth * 1.5 },
});
