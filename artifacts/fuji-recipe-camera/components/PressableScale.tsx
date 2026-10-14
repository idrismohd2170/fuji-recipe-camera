import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Smaller controls can use a stronger value. */
  pressedScale?: number;
  /** Haptic fired on press. Pass `false` to stay silent. */
  haptic?: Haptics.ImpactFeedbackStyle | false;
};

const SPRING = { damping: 18, stiffness: 420, mass: 0.6 } as const;

/**
 * Pressable with an Apple-style spring squish. The scale runs on the UI thread
 * (reanimated shared value), so it stays smooth at the S24 Ultra's 120Hz.
 */
export function PressableScale({
  style,
  pressedScale = 0.96,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic !== false) void Haptics.impactAsync(haptic);
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
