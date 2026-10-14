import { useColorScheme } from 'react-native';
import colors, { type Colors } from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 * Dark is the default, so an unknown scheme resolves to the true-black palette.
 */
export function useColors(): Colors {
  const scheme = useColorScheme();
  const palette = scheme === 'light' ? colors.light : colors.dark;
  return { ...palette, radius: colors.radius };
}
