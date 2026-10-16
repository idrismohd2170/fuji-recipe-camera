import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/typography';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  index: 'layers',
  camera: 'camera',
  gallery: 'image',
};

/**
 * Floating glass tab bar. It sits above the gesture-navigation inset, so every tab is
 * reachable with the thumb on the S24 Ultra's tall screen.
 */
function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;
  const hidden =
    (focusedOptions?.tabBarStyle as { display?: string } | undefined)?.display === 'none';
  if (hidden) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <Glass radius={32} intensity={60} style={styles.bar}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const label = descriptors[route.key]?.options.title ?? route.name;
            return (
              <PressableScale
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                haptic={Haptics.ImpactFeedbackStyle.Light}
                pressedScale={0.92}
                lift={0.1}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={[
                  styles.tab,
                  focused && { backgroundColor: colors.primary + '26' },
                ]}
              >
                <Feather
                  name={ICONS[route.name] ?? 'circle'}
                  size={21}
                  color={focused ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.label,
                    { color: focused ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Recipes' }} />
      <Tabs.Screen
        name="camera"
        options={{ title: 'Shoot', tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen name="gallery" options={{ title: 'Gallery' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: { padding: 6 },
  row: { flexDirection: 'row', gap: 4 },
  tab: {
    minWidth: 88,
    height: 56,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 12,
  },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.1 },
});
