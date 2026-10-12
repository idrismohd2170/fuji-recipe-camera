export type FilmLook = {
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  grain: number;
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

export const recipes: FilmRecipe[] = [
  {
    id: 'coastal-chrome',
    name: 'Coastal Chrome',
    simulation: 'Classic Chrome',
    description: 'Quiet blues, crisp light, and deep greens for open-air days.',
    settings: ['DR200', 'WB Daylight · R+2 B−3', 'Color +2', 'Shadow +1'],
    image: 0,
    look: {
      exposure: 2,
      contrast: 1.12,
      saturation: 0.83,
      warmth: -4,
      grain: 2.2,
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
      exposure: 4,
      contrast: 1.06,
      saturation: 0.98,
      warmth: 12,
      grain: 1.7,
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
      exposure: 5,
      contrast: 0.94,
      saturation: 1.08,
      warmth: 10,
      grain: 2.7,
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
      exposure: -3,
      contrast: 0.91,
      saturation: 0.73,
      warmth: 2,
      grain: 3.4,
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
      exposure: 3,
      contrast: 1.14,
      saturation: 1.12,
      warmth: 8,
      grain: 2.4,
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
      exposure: 2,
      contrast: 1.2,
      saturation: 0,
      warmth: 0,
      grain: 3.2,
      previewTint: 'rgba(28, 31, 29, 0.17)',
    },
  },
];

export function getRecipe(id: string): FilmRecipe {
  return recipes.find((recipe) => recipe.id === id) ?? recipes[0];
}
