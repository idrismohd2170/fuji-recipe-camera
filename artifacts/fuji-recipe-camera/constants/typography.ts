import type { TextStyle } from 'react-native';

/**
 * SF-style type scale, set in Inter (loaded in app/_layout.tsx). Android ignores
 * fontWeight for custom fonts, so each weight is its own family name.
 * Tracking is tightened on large sizes the way Apple's display type is.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const type = {
  largeTitle: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.9 },
  title1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  title2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
  title3: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.35 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  callout: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 21, letterSpacing: -0.25 },
  subhead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  overline: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;
