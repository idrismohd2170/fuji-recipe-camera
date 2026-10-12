/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#f2eee2',
    tint: '#df704d',
    background: '#171a16',
    foreground: '#f2eee2',
    card: '#222720',
    cardForeground: '#f2eee2',
    primary: '#df704d',
    primaryForeground: '#171a16',
    secondary: '#30362d',
    secondaryForeground: '#e5e2d7',
    muted: '#292e27',
    mutedForeground: '#a7aa9f',
    accent: '#87916e',
    accentForeground: '#171a16',
    destructive: '#dc665a',
    destructiveForeground: '#ffffff',
    border: '#3b4038',
    input: '#3b4038',
  },

  radius: 16,
};

export default colors;
