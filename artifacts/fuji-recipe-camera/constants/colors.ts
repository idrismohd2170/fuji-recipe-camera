/**
 * Semantic design tokens.
 *
 * Dark is the primary theme: a true-black (#000) OLED background so the S24 Ultra's
 * AMOLED pixels switch off, with raised surfaces in near-black greys (Apple "elevated"
 * style). Light is a secondary, iOS-like grouped palette. Both share the same token
 * names so screens never branch on the scheme.
 */

type Palette = {
  text: string;
  tint: string;
  background: string;
  /** Slightly raised surface (cards, grouped rows). */
  card: string;
  cardForeground: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  /** 1px separators between rows. */
  separator: string;
  /** Translucent fill used for glass surfaces (tab bar, chips, overlays). */
  glass: string;
  /** Hairline highlight on the edge of glass surfaces. */
  glassBorder: string;
  /** Blur tint for expo-blur. */
  blurTint: 'dark' | 'light';
};

const dark: Palette = {
  text: '#ffffff',
  tint: '#ff9f43',
  background: '#000000',
  card: '#1c1c1e',
  cardForeground: '#ffffff',
  foreground: '#ffffff',
  primary: '#ff9f43',
  primaryForeground: '#1a0f00',
  secondary: '#2c2c2e',
  secondaryForeground: '#ffffff',
  muted: '#2c2c2e',
  mutedForeground: '#8e8e93',
  accent: '#ffb86b',
  accentForeground: '#1a0f00',
  destructive: '#ff453a',
  destructiveForeground: '#ffffff',
  border: 'rgba(255,255,255,0.12)',
  input: '#2c2c2e',
  separator: 'rgba(255,255,255,0.10)',
  glass: 'rgba(38,38,40,0.72)',
  glassBorder: 'rgba(255,255,255,0.14)',
  blurTint: 'dark',
};

const light: Palette = {
  text: '#000000',
  tint: '#e8780a',
  background: '#f2f2f7',
  card: '#ffffff',
  cardForeground: '#000000',
  foreground: '#000000',
  primary: '#e8780a',
  primaryForeground: '#ffffff',
  secondary: '#e5e5ea',
  secondaryForeground: '#000000',
  muted: '#e5e5ea',
  mutedForeground: '#6c6c70',
  accent: '#c2630a',
  accentForeground: '#ffffff',
  destructive: '#ff3b30',
  destructiveForeground: '#ffffff',
  border: 'rgba(0,0,0,0.12)',
  input: '#e5e5ea',
  separator: 'rgba(0,0,0,0.10)',
  glass: 'rgba(250,250,252,0.78)',
  glassBorder: 'rgba(255,255,255,0.7)',
  blurTint: 'light',
};

const colors = {
  dark,
  light,
  /** Default corner radius for cards. */
  radius: 24,
};

export type Colors = Palette & { radius: number };

export default colors;
