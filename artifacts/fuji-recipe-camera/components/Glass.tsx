import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColors } from '@/hooks/useColors';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  /** Force the dark treatment (e.g. controls floating over the camera preview). */
  forceDark?: boolean;
};

/**
 * Translucent "glass" surface: a blur layer, a tinted fill and a hairline edge.
 * On Android expo-blur's default method paints a semi-transparent fill instead of a
 * real blur (real blur needs a BlurTargetView), so the tinted fill carries the look.
 */
export function Glass({ children, style, radius = 24, intensity = 40, forceDark = false }: Props) {
  const colors = useColors();
  const dark = forceDark || colors.blurTint === 'dark';
  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: radius,
          borderColor: forceDark ? 'rgba(255,255,255,0.16)' : colors.glassBorder,
        },
        style,
      ]}
    >
      <BlurView
        tint={dark ? 'dark' : 'light'}
        intensity={intensity}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: forceDark ? 'rgba(28,28,30,0.62)' : colors.glass },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
