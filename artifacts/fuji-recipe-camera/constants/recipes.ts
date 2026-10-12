export type Vec3 = readonly [number, number, number];

/** 3x3 colour matrix, row-major. Each row should sum to 1 so greys stay grey. */
export type ColorMatrix = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export type FilmLook = {
  /** Exposure compensation in stops (EV). */
  exposure: number;
  /** 1 = neutral. Above 1 adds an S-curve, below 1 flattens. */
  contrast: number;
  /** -1..1. Negative rolls highlights off (like Fuji DR400 / Highlight -). */
  highlights: number;
  /** -1..1. Positive lifts shadows (like Fuji Shadow -), negative deepens them. */
  shadows: number;
  /** 0..0.1 lift of the blacks for a faded, filmic base. */
  fade: number;
  /** 1 = neutral, 0 = monochrome. Above 1 is applied as vibrance. */
  saturation: number;
  /** -1 cool .. 1 warm (white balance Red up / Blue down). */
  warmth: number;
  /** -1 green .. 1 magenta. */
  tint: number;
  /** RGB offsets (8-bit levels) blended into the shadows. */
  shadowTone: Vec3;
  /** RGB offsets (8-bit levels) blended into the highlights. */
  highlightTone: Vec3;
  /** Simulation colour character. */
  matrix?: ColorMatrix;
  /** Monochrome channel weights, e.g. ACROS with a yellow filter. */
  channelMix?: Vec3;
  /** 0..1 grain strength. */
  grain: number;
  /** 1 = fine, larger = coarser grain. */
  grainSize: number;
  /** 0..1 corner darkening. */
  vignette: number;
  previewTint: string;
};

export type FilmRecipe = {
  id: string;
  name: string;
  simulation: string;
  description: string;
  settings: string[];
  image: number;
  look: FilmLook;
};

const CLASSIC_CHROME: ColorMatrix = [0.93, 0.06, 0.01, 0.03, 0.92, 0.05, 0.02, 0.1, 0.88];
const NOSTALGIC_NEG: ColorMatrix = [0.98, 0.04, -0.02, 0.01, 0.96, 0.03, 0, 0.06, 0.94];
const ETERNA: ColorMatrix = [0.92, 0.07, 0.01, 0.02, 0.93, 0.05, 0.01, 0.05, 0.94];
const CHROME_REDS: ColorMatrix = [1.04, -0.03, -0.01, 0, 0.97, 0.03, 0, 0.06, 0.94];

export const recipes: FilmRecipe[] = [
  {
    id: 'coastal-chrome',
    name: 'Coastal Chrome',
    simulation: 'Classic Chrome',
    description: 'Quiet blues, crisp light, and deep greens for open-air days.',
    settings: ['DR200', 'WB Daylight · R+2 B−3', 'Color +2', 'Shadow +1'],
    image: 0,
    look: {
      exposure: 0.05,
      contrast: 1.1,
      highlights: -0.25,
      shadows: -0.1,
      fade: 0.01,
      saturation: 0.86,
      warmth: 0.18,
      tint: 0,
      shadowTone: [-3, 2, 5],
      highlightTone: [2, 1, -2],
      matrix: CLASSIC_CHROME,
      grain: 0.4,
      grainSize: 1.2,
      vignette: 0.12,
      previewTint: 'rgba(106, 142, 146, 0.12)',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour 400',
    simulation: 'Reala Ace',
    description: 'Honeyed highlights and a soft, sunlit warmth.',
    settings: ['DR400', 'WB Daylight · R+3 B−4', 'Color +1', 'Highlight −1'],
    image: 1,
    look: {
      exposure: 0.1,
      contrast: 1.05,
      highlights: -0.45,
      shadows: 0.1,
      fade: 0.012,
      saturation: 1.0,
      warmth: 0.45,
      tint: 0.05,
      shadowTone: [3, 1, -3],
      highlightTone: [5, 3, -5],
      grain: 0.3,
      grainSize: 1.1,
      vignette: 0.1,
      previewTint: 'rgba(232, 156, 76, 0.15)',
    },
  },
  {
    id: 'soft-negative',
    name: 'Soft Negative',
    simulation: 'Nostalgic Neg.',
    description: 'Gentle contrast, warm skin tones, and relaxed color.',
    settings: ['DR400', 'WB Auto · R+2 B−5', 'Color +2', 'Highlight −2'],
    image: 0,
    look: {
      exposure: 0.15,
      contrast: 0.94,
      highlights: -0.6,
      shadows: 0.15,
      fade: 0.03,
      saturation: 1.05,
      warmth: 0.35,
      tint: 0.1,
      shadowTone: [-2, 2, 4],
      highlightTone: [6, 2, -6],
      matrix: NOSTALGIC_NEG,
      grain: 0.55,
      grainSize: 1.4,
      vignette: 0.15,
      previewTint: 'rgba(214, 152, 104, 0.13)',
    },
  },
  {
    id: 'cinema-800',
    name: 'Cinema 800',
    simulation: 'ETERNA',
    description: 'Low-key color and softer highlights with a film-set mood.',
    settings: ['DR400', 'WB 5600K · R+1 B−2', 'Color −2', 'Shadow −1'],
    image: 1,
    look: {
      exposure: -0.1,
      contrast: 0.9,
      highlights: -0.5,
      shadows: 0.25,
      fade: 0.04,
      saturation: 0.74,
      warmth: 0.08,
      tint: -0.05,
      shadowTone: [-4, 3, 2],
      highlightTone: [3, 2, -1],
      matrix: ETERNA,
      grain: 0.65,
      grainSize: 1.5,
      vignette: 0.2,
      previewTint: 'rgba(64, 93, 79, 0.16)',
    },
  },
  {
    id: 'red-forest',
    name: 'Red Forest',
    simulation: 'Classic Chrome',
    description: 'A vivid autumn recipe that lets reds stand out against foliage.',
    settings: ['DR200', 'WB Shade · R+2 B−3', 'Color +3', 'Shadow +1'],
    image: 1,
    look: {
      exposure: 0.08,
      contrast: 1.14,
      highlights: -0.2,
      shadows: -0.15,
      fade: 0.008,
      saturation: 1.12,
      warmth: 0.3,
      tint: 0,
      shadowTone: [-2, 1, 2],
      highlightTone: [5, 2, -4],
      matrix: CHROME_REDS,
      grain: 0.45,
      grainSize: 1.2,
      vignette: 0.14,
      previewTint: 'rgba(199, 94, 56, 0.12)',
    },
  },
  {
    id: 'silver-160',
    name: 'Silver 160',
    simulation: 'ACROS',
    description: 'A textured black-and-white look for shape, shadow, and light.',
    settings: ['ACROS + Ye', 'DR200', 'Highlight +1', 'Grain Weak'],
    image: 0,
    look: {
      exposure: 0.05,
      contrast: 1.18,
      highlights: 0.1,
      shadows: -0.2,
      fade: 0,
      saturation: 0,
      warmth: 0,
      tint: 0,
      shadowTone: [0, 0, 0],
      highlightTone: [0, 0, 0],
      // Yellow filter: darkens blue skies, keeps skin and foliage bright.
      channelMix: [0.4, 0.52, 0.08],
      grain: 0.6,
      grainSize: 1.2,
      vignette: 0.15,
      previewTint: 'rgba(28, 31, 29, 0.17)',
    },
  },
];

export function getRecipe(id: string): FilmRecipe {
  return recipes.find((recipe) => recipe.id === id) ?? recipes[0];
}
