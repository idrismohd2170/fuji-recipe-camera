import type { FilmRecipe } from '@/constants/recipes';

export type SettingRow = { label: string; value: string };

/** Map a free-text setting such as "DR200" or "Color +2" to a Fujifilm menu label. */
function labelFor(setting: string): { label: string; value: string } {
  const text = setting.trim();
  const rules: [RegExp, string, (s: string) => string][] = [
    [/^DR\s*(\d+)/i, 'Dynamic Range', (s) => `DR${s.match(/\d+/)?.[0] ?? ''}`],
    [/^WB\s+/i, 'White Balance', (s) => s.replace(/^WB\s+/i, '')],
    [/^Color\s+/i, 'Color', (s) => s.replace(/^Color\s+/i, '')],
    [/^Shadow\s+/i, 'Shadow Tone', (s) => s.replace(/^Shadow\s+/i, '')],
    [/^Highlight\s+/i, 'Highlight Tone', (s) => s.replace(/^Highlight\s+/i, '')],
    [/^Grain\s+/i, 'Grain Effect', (s) => s.replace(/^Grain\s+/i, '')],
    [/^ACROS/i, 'Filter', (s) => s],
  ];
  for (const [pattern, label, value] of rules) {
    if (pattern.test(text)) return { label, value: value(text) };
  }
  return { label: 'Setting', value: text };
}

/** In-camera menu settings, derived from the recipe's `simulation` and `settings`. */
export function menuSettings(recipe: FilmRecipe): SettingRow[] {
  return [
    { label: 'Film Simulation', value: recipe.simulation },
    ...recipe.settings.map(labelFor),
  ];
}

const signed = (n: number, digits = 2) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
const percent = (n: number) => `${Math.round(n * 100)}%`;

/** The processing values the capture pipeline uses for this recipe. */
export function lookValues(recipe: FilmRecipe): SettingRow[] {
  const { look } = recipe;
  const rows: SettingRow[] = [
    { label: 'Exposure', value: `${signed(look.exposure)} EV` },
    { label: 'Contrast', value: `${look.contrast.toFixed(2)}×` },
    { label: 'Highlights', value: signed(look.highlights) },
    { label: 'Shadows', value: signed(look.shadows) },
    { label: 'Saturation', value: look.saturation === 0 ? 'Monochrome' : `${look.saturation.toFixed(2)}×` },
    { label: 'Warmth', value: signed(look.warmth) },
    { label: 'Grain', value: `${percent(look.grain)} · size ${look.grainSize.toFixed(1)}` },
    { label: 'Vignette', value: percent(look.vignette) },
  ];
  return rows;
}
