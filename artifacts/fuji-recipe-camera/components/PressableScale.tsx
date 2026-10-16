import React, { createContext, useContext } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * 0..1 press amount of the nearest PressableScale. A Glass panel inside a PressableScale
 * reads it to brighten while pressed (see Glass.tsx), so glass controls get a light lift
 * on top of the spring squish without any extra props.
 */
export const PressContext = createContext<SharedValue<number> | null>(null);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Smaller controls can use a stronger value. */
  pressedScale?: number;
  /** Haptic fired on press. Pass `false` to stay silent. */
  haptic?: Haptics.ImpactFeedbackStyle | false;
  /**
   * Peak white overlay opacity while pressed (0 disables it). For controls that are not
   * Glass themselves, e.g. pills inside a glass bar. The overlay follows the style's
   * borderRadius.
   */
  lift?: number;
};

const SPRING = { damping: 18, stiffness: 420, mass: 0.6 } as const;
const LIFT_IN = { duration: 90 } as const;
const LIFT_OUT = { duration: 220 } as const;

/**
 * Pressable with an Apple-style spring squish. The scale runs on the UI thread
 * (reanimated shared value), so it stays smooth at the S24 Ultra's 120Hz.
 */
export function PressableScale({
  style,
  pressedScale = 0.96,
  haptic = Haptics.ImpactFeedbackStyle.Light,
  lift = 0,
  onPressIn,
  onPressOut,
  onPress,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const liftStyle = useAnimatedStyle(() => ({ opacity: pressed.value * lift }));
  const radius = lift > 0 ? StyleSheet.flatten(style)?.borderRadius : undefined;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, SPRING);
        pressed.value = withTiming(1, LIFT_IN);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, SPRING);
        pressed.value = withTiming(0, LIFT_OUT);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic !== false) void Haptics.impactAsync(haptic);
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
    >
      <PressContext.Provider value={pressed}>
        {typeof children === 'function' ? null : children}
      </PressContext.Provider>
      {lift > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#fff', borderRadius: radius },
            liftStyle,
          ]}
        />
      )}
    </AnimatedPressable>
  );
}
