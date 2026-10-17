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
  /**
   * Per-channel curve shaping after the tone curve (1 = none). Above 1 darkens that channel's
   * mid-tones, below 1 lifts them; black and white stay fixed. Different values per channel
   * give film's colour-shifted shadows, e.g. [1.06, 1, 0.92] = teal shadows, clean highlights.
   */
  channelGamma?: Vec3;
  /**
   * Hue-selective colour, 18 numbers: red, yellow, green, cyan, blue, magenta, each as
   * [hue shift in degrees, saturation change (+0.2 = 20% more), brightness change (+0.05)].
   * Positive hue shift moves red -> yellow -> green -> cyan -> blue. Neutral greys are untouched.
   */
  hueBands?: readonly number[];
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
    id: 'vivid-slide',
    name: 'Vivid Slide 50',
    simulation: 'Velvia',
    description: 'Saturated slide-film colour: deep blues, rich greens, punchy reds, dense blacks.',
    settings: ['Velvia', 'DR100', 'Color +4', 'Shadow +2'],
    image: 1,
    look: {
      exposure: -0.05,
      contrast: 1.2,
      highlights: -0.2,
      shadows: -0.25,
      fade: 0,
      saturation: 1.35,
      warmth: 0.06,
      tint: 0,
      shadowTone: [-2, 0, 3],
      highlightTone: [3, 1, -2],
      channelGamma: [1.03, 1, 0.97],
      // red, yellow, green, cyan, blue, magenta: [hue shift, saturation, brightness]
      hueBands: [0, 0.18, -0.01, -4, 0.1, 0, 4, 0.22, -0.03, 0, 0.18, -0.03, 0, 0.28, -0.06, 0, 0.12, 0],
      grain: 0.22,
      grainSize: 0.9,
      vignette: 0.12,
      previewTint: 'rgba(40, 120, 90, 0.1)',
    },
  },
  {
    id: 'provia-clean',
    name: 'Clean Colour 100',
    simulation: 'Provia',
    description: 'True-to-life colour with a little extra snap in skies and foliage.',
    settings: ['Provia', 'DR100', 'Color +2', 'Highlight −1'],
    image: 0,
    look: {
      exposure: 0,
      contrast: 1.1,
      highlights: -0.25,
      shadows: -0.1,
      fade: 0.004,
      saturation: 1.12,
      warmth: 0.04,
      tint: 0,
      shadowTone: [-1, 0, 2],
      highlightTone: [2, 1, -1],
      hueBands: [0, 0.06, 0, 0, 0, 0, 2, 0.08, 0, 0, 0.1, -0.02, 0, 0.12, -0.03, 0, 0.05, 0],
      grain: 0.2,
      grainSize: 0.9,
      vignette: 0.08,
      previewTint: 'rgba(80, 130, 160, 0.08)',
    },
  },
  {
    id: 'astia-soft',
    name: 'Soft Skin 100',
    simulation: 'Astia',
    description: 'Gentle contrast and flattering skin, with calm greens and clear skies.',
    settings: ['Astia', 'DR200', 'Color +1', 'Highlight −2'],
    image: 0,
    look: {
      exposure: 0.1,
      contrast: 1.0,
      highlights: -0.4,
      shadows: 0.15,
      fade: 0.012,
      saturation: 1.04,
      warmth: 0.12,
      tint: 0.02,
      shadowTone: [-1, 1, 2],
      highlightTone: [4, 2, -2],
      hueBands: [-2, -0.04, 0.02, 0, -0.02, 0.01, -4, -0.1, 0, 0, 0, 0, 0, 0.06, -0.02, 0, 0, 0],
      grain: 0.25,
      grainSize: 1.0,
      vignette: 0.1,
      previewTint: 'rgba(232, 190, 160, 0.1)',
    },
  },
  {
    id: 'classic-neg',
    name: 'Classic Neg 400',
    simulation: 'Classic Neg.',
    description: 'Gritty street-film contrast with teal shadows and warm, slightly magenta highlights.',
    settings: ['Classic Neg.', 'DR200', 'Color +2', 'Shadow +2'],
    image: 1,
    look: {
      exposure: 0,
      contrast: 1.2,
      highlights: -0.1,
      shadows: -0.2,
      fade: 0.025,
      saturation: 0.98,
      warmth: 0.1,
      tint: 0.08,
      shadowTone: [-5, 2, 6],
      highlightTone: [7, 0, -5],
      channelGamma: [1.08, 1, 0.9],
      hueBands: [0, 0.1, 0, -2, -0.1, 0, 10, -0.2, -0.02, 0, 0.1, -0.02, 5, 0.1, -0.04, 0, 0.05, 0],
      grain: 0.5,
      grainSize: 1.4,
      vignette: 0.18,
      previewTint: 'rgba(60, 110, 120, 0.14)',
    },
  },
  {
    id: 'portrait-400',
    name: 'Portrait 400',
    simulation: 'Portra-style',
    description: 'Pastel skin, soft highlights and muted olive greens, shot a touch bright.',
    settings: ['Portra-style', 'Soft curve', 'Warm skin', 'Muted greens'],
    image: 0,
    look: {
      exposure: 0.2,
      contrast: 0.97,
      highlights: -0.5,
      shadows: 0.15,
      fade: 0.025,
      saturation: 0.95,
      warmth: 0.2,
      tint: 0.03,
      shadowTone: [-1, 2, 3],
      highlightTone: [5, 3, -3],
      hueBands: [-3, -0.02, 0.02, -3, 0, 0.02, -14, -0.2, 0.02, 0, -0.15, 0, 4, -0.1, 0.02, 0, -0.1, 0.01],
      grain: 0.35,
      grainSize: 1.2,
      vignette: 0.1,
      previewTint: 'rgba(235, 190, 150, 0.12)',
    },
  },
  {
    id: 'ektar-100',
    name: 'Vivid Neg 100',
    simulation: 'Ektar-style',
    description: 'Ultra-fine grain and saturated, red-leaning colour with strong contrast.',
    settings: ['Ektar-style', 'Fine grain', 'Color +3', 'Shadow +1'],
    image: 1,
    look: {
      exposure: 0,
      contrast: 1.2,
      highlights: -0.2,
      shadows: -0.2,
      fade: 0.005,
      saturation: 1.3,
      warmth: 0.1,
      tint: 0,
      shadowTone: [-1, 0, 2],
      highlightTone: [4, 1, -3],
      hueBands: [0, 0.25, -0.01, -5, 0.1, 0, -6, 0.12, -0.02, 0, 0.15, -0.02, 3, 0.2, -0.05, 0, 0.1, 0],
      grain: 0.15,
      grainSize: 0.9,
      vignette: 0.12,
      previewTint: 'rgba(210, 90, 60, 0.1)',
    },
  },
  {
    id: 'gold-200',
    name: 'Golden 200',
    simulation: 'Gold-style',
    description: 'Warm, nostalgic everyday film: honey highlights, creamy yellows, olive greens.',
    settings: ['Gold-style', 'Warm cast', 'Color +1', 'Highlight −1'],
    image: 0,
    look: {
      exposure: 0.1,
      contrast: 1.08,
      highlights: -0.3,
      shadows: 0.05,
      fade: 0.015,
      saturation: 1.08,
      warmth: 0.5,
      tint: 0,
      shadowTone: [3, 1, -4],
      highlightTone: [8, 4, -8],
      channelGamma: [0.97, 1, 1.07],
      hueBands: [3, 0.05, 0, -4, 0.12, 0.02, -14, -0.1, 0, 0, -0.1, 0, 0, -0.1, 0.01, 0, 0, 0],
      grain: 0.4,
      grainSize: 1.3,
      vignette: 0.14,
      previewTint: 'rgba(240, 180, 80, 0.15)',
    },
  },
  {
    id: 'tungsten-800',
    name: 'Tungsten 800',
    simulation: 'Night-film style',
    description: 'Cool teal shadows, glowing warm lights and heavy grain for city nights.',
    settings: ['Night-film style', 'Cool shadows', 'Color +1', 'Grain Strong'],
    image: 1,
    look: {
      exposure: 0,
      contrast: 1.12,
      highlights: 0,
      shadows: 0.1,
      fade: 0.02,
      saturation: 1.0,
      warmth: -0.18,
      tint: -0.05,
      shadowTone: [-6, 2, 8],
      highlightTone: [10, 3, -6],
      channelGamma: [1.1, 1, 0.9],
      hueBands: [-4, 0.12, 0, 0, 0.05, 0, 8, -0.1, 0, 0, 0.12, 0.02, 0, 0.18, -0.02, 0, 0.05, 0],
      grain: 0.65,
      grainSize: 1.6,
      vignette: 0.22,
      previewTint: 'rgba(40, 90, 120, 0.16)',
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
  {
    id: 'acros-100',
    name: 'Fine Silver 100',
    simulation: 'ACROS',
    description: 'Rich, smooth black-and-white: deep blacks, clean highlights, very fine grain.',
    settings: ['ACROS + Ye', 'DR100', 'Shadow +2', 'Grain Weak'],
    image: 0,
    look: {
      exposure: -0.05,
      contrast: 1.28,
      highlights: -0.1,
      shadows: -0.3,
      fade: 0,
      saturation: 0,
      warmth: 0,
      tint: 0,
      shadowTone: [0, 0, 0],
      highlightTone: [0, 0, 0],
      channelMix: [0.42, 0.5, 0.08],
      grain: 0.3,
      grainSize: 0.9,
      vignette: 0.14,
      previewTint: 'rgba(24, 26, 25, 0.17)',
    },
  },
  {
    id: 'tri-x-400',
    name: 'Street 400',
    simulation: 'Tri-X-style',
    description: 'Classic gritty reportage: strong contrast, open shadows, big visible grain.',
    settings: ['Mono', 'DR200', 'Highlight +1', 'Grain Strong'],
    image: 1,
    look: {
      exposure: -0.05,
      contrast: 1.4,
      highlights: 0,
      shadows: -0.35,
      fade: 0,
      saturation: 0,
      warmth: 0,
      tint: 0,
      shadowTone: [0, 0, 0],
      highlightTone: [0, 0, 0],
      channelMix: [0.38, 0.5, 0.12],
      grain: 0.8,
      grainSize: 1.7,
      vignette: 0.22,
      previewTint: 'rgba(26, 26, 26, 0.18)',
    },
  },
  {
    id: 'red-filter',
    name: 'Red Filter 100',
    simulation: 'ACROS + R',
    description: 'Dramatic black skies and glowing clouds, the way a red filter bends tones.',
    settings: ['ACROS + R', 'DR100', 'Shadow +2', 'Grain Weak'],
    image: 0,
    look: {
      exposure: -0.1,
      contrast: 1.3,
      highlights: -0.15,
      shadows: -0.25,
      fade: 0,
      saturation: 0,
      warmth: 0,
      tint: 0,
      shadowTone: [0, 0, 0],
      highlightTone: [0, 0, 0],
      // Red filter: blue sky goes nearly black, red and skin glow.
      channelMix: [0.92, 0.22, -0.14],
      grain: 0.5,
      grainSize: 1.3,
      vignette: 0.2,
      previewTint: 'rgba(30, 24, 24, 0.18)',
    },
  },
  {
    id: 'toned-silver',
    name: 'Toned Silver',
    simulation: 'Selenium print',
    description: 'Soft black-and-white with cool selenium shadows and warm paper highlights.',
    settings: ['Mono', 'Cool shadows', 'Warm highlights', 'Fade'],
    image: 1,
    look: {
      exposure: 0,
      contrast: 1.12,
      highlights: -0.2,
      shadows: 0,
      fade: 0.03,
      saturation: 0,
      warmth: 0,
      tint: 0,
      shadowTone: [-7, -2, 6],
      highlightTone: [7, 3, -5],
      channelMix: [0.33, 0.5, 0.17],
      grain: 0.5,
      grainSize: 1.3,
      vignette: 0.16,
      previewTint: 'rgba(30, 32, 36, 0.17)',
    },
  },
];

export function getRecipe(id: string): FilmRecipe {
  return recipes.find((recipe) => recipe.id === id) ?? recipes[0];
}
