import type { FilmLook, Vec3 } from '@/constants/recipes';

/**
 * GPU port of the film look in `lib/film-grade.ts`, as a Skia runtime effect
 * (SkSL). This file has no React Native or Skia imports so it can be loaded in
 * plain Node: the shader source, the uniform maths and a plain-TypeScript
 * reference evaluation of one pixel all live here.
 *
 * Same pipeline as `gradePixels`, in the same order:
 *   1. exposure + white balance in linear light, then the filmic S-curve with
 *      highlight roll-off, shadow lift and black fade (analytic, per channel;
 *      `gradePixels` bakes the same formula into a 256-entry LUT)
 *   2. colour matrix, or the channel mix for monochrome stocks
 *   3. vibrance-style saturation
 *   4. split toning
 *   5. luminance-weighted grain from the same noise tile, plus a little
 *      colour noise on colour stocks
 *   6. vignette
 *
 * Known, deliberate differences from `gradePixels` (all sub-level):
 *   - luminance is continuous here; `gradePixels` rounds it to 0..255 first
 *     for the split-tone and grain-weight tables
 *   - the grain tile is stored as an 8-bit texture (see NOISE_RANGE)
 *   - the output is 0..1 float; `gradePixels` writes rounded 8-bit values
 */

export const FILM_NOISE_SIZE = 256;
/** The noise tile has unit variance; it is stored as 0.5 + n / NOISE_RANGE. */
export const FILM_NOISE_RANGE = 8;

export const FILM_SHADER_SKSL = `
uniform shader image;
uniform shader noise;

uniform float2 vignetteCenter;
uniform float3 wbGain;
uniform float exposureGain;
uniform float contrastAmount;
uniform float highlights;
uniform float shadows;
uniform float fade;
uniform float toneBlack;
uniform float toneSpan;
uniform float3 matrixRow0;
uniform float3 matrixRow1;
uniform float3 matrixRow2;
uniform float useMono;
uniform float3 monoMix;
uniform float satBoost;
uniform float satCut;
uniform float3 shadowTone;
uniform float3 highlightTone;
uniform float grainAmount;
uniform float grainBlock;
uniform float grainSeedRows;
uniform float vignette;

const float TAU = 6.283185307179586;
const float NOISE_RANGE = ${FILM_NOISE_RANGE.toFixed(1)};

float srgbToLinear(float v) {
  return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4);
}

float linearToSrgb(float v) {
  float m = max(v, 0.0);
  return m <= 0.0031308 ? m * 12.92 : 1.055 * pow(m, 1.0 / 2.4) - 0.055;
}

float bump(float v, float center, float width) {
  float d = (v - center) / width;
  return exp(-d * d);
}

float rawTone(float x) {
  float y = x - contrastAmount * sin(TAU * x) / TAU;
  y += highlights * 0.12 * bump(x, 0.8, 0.22);
  y += shadows * 0.1 * bump(x, 0.2, 0.22);
  return y;
}

float tone(float v, float gain) {
  float x = clamp(linearToSrgb(srgbToLinear(v) * exposureGain * gain), 0.0, 1.0);
  float n = clamp((rawTone(x) - toneBlack) / toneSpan, 0.0, 1.0);
  return fade + n * (1.0 - fade);
}

half4 main(float2 xy) {
  float3 src = image.eval(xy).rgb;
  float3 c = float3(tone(src.r, wbGain.r), tone(src.g, wbGain.g), tone(src.b, wbGain.b));

  float lum;
  if (useMono > 0.5) {
    lum = dot(c, monoMix);
    c = float3(lum);
  } else {
    c = float3(dot(matrixRow0, c), dot(matrixRow1, c), dot(matrixRow2, c));
    lum = dot(c, float3(0.2126, 0.7152, 0.0722));
    float high = max(c.r, max(c.g, c.b));
    float low = min(c.r, min(c.g, c.b));
    float chroma = high > 0.0 ? (high - low) / high : 0.0;
    float factor = satBoost > 0.0 ? 1.0 + satBoost * (1.0 - 0.65 * chroma) : satCut;
    c = float3(lum) + (c - float3(lum)) * factor;
  }

  float l = clamp(lum, 0.0, 1.0);
  float inv = 1.0 - l;
  c += shadowTone * (inv * inv) + highlightTone * (l * l);

  if (grainAmount > 0.0) {
    float2 cell = floor(xy / grainBlock);
    float col = mod(cell.x, ${FILM_NOISE_SIZE.toFixed(1)}) + 0.5;
    float row = mod(cell.y + grainSeedRows, ${FILM_NOISE_SIZE.toFixed(1)}) + 0.5;
    float strength = grainAmount * (0.25 + 0.75 * 4.0 * l * inv);
    float g = (noise.eval(float2(col, row)).r - 0.5) * NOISE_RANGE * strength;
    c += float3(g);
    if (useMono < 0.5) {
      float chromaRow = mod(cell.y + 97.0, ${FILM_NOISE_SIZE.toFixed(1)}) + 0.5;
      float k = (noise.eval(float2(col, chromaRow)).r - 0.5) * NOISE_RANGE * strength * 0.14;
      c.r += k;
      c.b -= k;
    }
  }

  if (vignette > 0.0) {
    float2 d = (xy - 0.5 - vignetteCenter) / vignetteCenter;
    float dist = 0.5 * (d.x * d.x + d.y * d.y);
    c *= 1.0 - vignette * dist * dist;
  }

  return half4(half3(clamp(c, 0.0, 1.0)), 1.0);
}
`;

/** Children, in declaration order: `image` (the frame), then `noise`. */
export const FILM_SHADER_CHILDREN = ['image', 'noise'] as const;

type Vec2 = readonly [number, number];

export type FilmShaderUniforms = {
  vignetteCenter: Vec2;
  wbGain: Vec3;
  exposureGain: number;
  contrastAmount: number;
  highlights: number;
  shadows: number;
  fade: number;
  toneBlack: number;
  toneSpan: number;
  matrixRow0: Vec3;
  matrixRow1: Vec3;
  matrixRow2: Vec3;
  useMono: number;
  monoMix: Vec3;
  satBoost: number;
  satCut: number;
  /** 0..1 units (the recipe stores 8-bit levels). */
  shadowTone: Vec3;
  highlightTone: Vec3;
  /** 0..1 units. */
  grainAmount: number;
  /** Grain cell size in output pixels. */
  grainBlock: number;
  grainSeedRows: number;
  vignette: number;
};

/** Declaration order of the uniforms in the SkSL above (children excluded). */
export const FILM_UNIFORM_ORDER: readonly (keyof FilmShaderUniforms)[] = [
  'vignetteCenter',
  'wbGain',
  'exposureGain',
  'contrastAmount',
  'highlights',
  'shadows',
  'fade',
  'toneBlack',
  'toneSpan',
  'matrixRow0',
  'matrixRow1',
  'matrixRow2',
  'useMono',
  'monoMix',
  'satBoost',
  'satCut',
  'shadowTone',
  'highlightTone',
  'grainAmount',
  'grainBlock',
  'grainSeedRows',
  'vignette',
];

function clamp(value: number, min: number, max: number) {
  'worklet';
  return value < min ? min : value > max ? max : value;
}

function bump(value: number, center: number, width: number) {
  'worklet';
  const distance = (value - center) / width;
  return Math.exp(-distance * distance);
}

function rawTone(x: number, u: Pick<FilmShaderUniforms, 'contrastAmount' | 'highlights' | 'shadows'>) {
  'worklet';
  let y = x - (u.contrastAmount * Math.sin(2 * Math.PI * x)) / (2 * Math.PI);
  y += u.highlights * 0.12 * bump(x, 0.8, 0.22);
  y += u.shadows * 0.1 * bump(x, 0.2, 0.22);
  return y;
}

/**
 * Turns a recipe look into shader uniforms. Marked 'worklet' (with the helpers it calls and
 * `flattenFilmShaderUniforms`) so the camera's frame callback can call it per frame size.
 * `width` / `height` are the size of the image being drawn (they set the grain
 * cell size and the vignette centre, as in `gradePixels`).
 */
export function computeFilmShaderUniforms(
  look: FilmLook,
  width: number,
  height: number,
  grainSeed = 0,
): FilmShaderUniforms {
  'worklet';
  const partial = {
    contrastAmount: clamp(look.contrast - 1, -0.85, 0.85),
    highlights: look.highlights,
    shadows: look.shadows,
  };
  const toneBlack = rawTone(0, partial);
  const toneSpan = rawTone(1, partial) - toneBlack || 1;
  const matrix = look.matrix;
  const mono = look.channelMix;

  return {
    vignetteCenter: [(width - 1) / 2 || 1, (height - 1) / 2 || 1],
    wbGain: [1 + 0.12 * look.warmth, 1 - 0.06 * look.tint, 1 - 0.14 * look.warmth],
    exposureGain: Math.pow(2, look.exposure),
    ...partial,
    fade: look.fade,
    toneBlack,
    toneSpan,
    matrixRow0: matrix ? [matrix[0], matrix[1], matrix[2]] : [1, 0, 0],
    matrixRow1: matrix ? [matrix[3], matrix[4], matrix[5]] : [0, 1, 0],
    matrixRow2: matrix ? [matrix[6], matrix[7], matrix[8]] : [0, 0, 1],
    useMono: mono ? 1 : 0,
    monoMix: mono ?? [0, 0, 0],
    satBoost: look.saturation > 1 ? look.saturation - 1 : 0,
    satCut: look.saturation <= 1 ? look.saturation : 1,
    shadowTone: [look.shadowTone[0] / 255, look.shadowTone[1] / 255, look.shadowTone[2] / 255],
    highlightTone: [
      look.highlightTone[0] / 255,
      look.highlightTone[1] / 255,
      look.highlightTone[2] / 255,
    ],
    grainAmount: (look.grain * 9) / 255,
    grainBlock: Math.max(1, Math.round((look.grainSize * Math.max(width, height)) / 3000)),
    grainSeedRows: (grainSeed * 40503) & 0xffff,
    vignette: look.vignette,
  };
}

/** Flat float array in the order `makeShaderWithChildren` expects. */
export function flattenFilmShaderUniforms(u: FilmShaderUniforms): number[] {
  'worklet';
  const out: number[] = [];
  for (const key of FILM_UNIFORM_ORDER) {
    const value = u[key];
    if (typeof value === 'number') out.push(value);
    else out.push(...value);
  }
  return out;
}

let noiseFloat: Float32Array | null = null;
let noiseBytes: Uint8Array | null = null;

/**
 * The same unit-variance Gaussian-ish tile as the private one in
 * `lib/film-grade.ts` (same xorshift seed and normalisation), so live preview
 * grain and `gradePixels` grain come from one pattern.
 */
function getNoiseFloat() {
  if (noiseFloat) return noiseFloat;
  const tile = new Float32Array(FILM_NOISE_SIZE * FILM_NOISE_SIZE);
  let state = 0x9e3779b9;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296 - 0.5;
  };
  let sum = 0;
  let sumSquares = 0;
  for (let index = 0; index < tile.length; index += 1) {
    const value = next() + next() + next();
    tile[index] = value;
    sum += value;
    sumSquares += value * value;
  }
  const mean = sum / tile.length;
  const deviation = Math.sqrt(sumSquares / tile.length - mean * mean) || 1;
  for (let index = 0; index < tile.length; index += 1) {
    tile[index] = (tile[index] - mean) / deviation;
  }
  noiseFloat = tile;
  return tile;
}

/**
 * RGBA8 pixels (256 x 256, opaque, R = G = B) for the shader's `noise` child.
 * Value = 0.5 + n / FILM_NOISE_RANGE, rounded to 8 bits.
 */
export function createFilmNoiseBytes(): Uint8Array {
  if (noiseBytes) return noiseBytes;
  const tile = getNoiseFloat();
  const bytes = new Uint8Array(tile.length * 4);
  for (let index = 0; index < tile.length; index += 1) {
    const encoded = Math.round(clamp(0.5 + tile[index] / FILM_NOISE_RANGE, 0, 1) * 255);
    bytes[index * 4] = encoded;
    bytes[index * 4 + 1] = encoded;
    bytes[index * 4 + 2] = encoded;
    bytes[index * 4 + 3] = 255;
  }
  noiseBytes = bytes;
  return bytes;
}

function sampleNoise(row: number, column: number) {
  const bytes = createFilmNoiseBytes();
  const r = row & (FILM_NOISE_SIZE - 1);
  const c = column & (FILM_NOISE_SIZE - 1);
  return (bytes[(r * FILM_NOISE_SIZE + c) * 4] / 255 - 0.5) * FILM_NOISE_RANGE;
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number) {
  const v = Math.max(0, value);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/**
 * Plain-TypeScript evaluation of the shader for one pixel, line for line the
 * same maths as `FILM_SHADER_SKSL`, reading the same uniforms.
 *
 * `rgb` is 0..255 input, `x` / `y` the integer pixel position. Returns 0..255
 * floats (clamped, not rounded).
 */
export function evaluateFilmPixelReference(
  u: FilmShaderUniforms,
  rgb: Vec3,
  x: number,
  y: number,
): [number, number, number] {
  const tone = (v: number, gain: number) => {
    const xv = clamp(linearToSrgb(srgbToLinear(v) * u.exposureGain * gain), 0, 1);
    const n = clamp((rawTone(xv, u) - u.toneBlack) / u.toneSpan, 0, 1);
    return u.fade + n * (1 - u.fade);
  };

  let r = tone(rgb[0] / 255, u.wbGain[0]);
  let g = tone(rgb[1] / 255, u.wbGain[1]);
  let b = tone(rgb[2] / 255, u.wbGain[2]);

  let lum: number;
  if (u.useMono > 0.5) {
    lum = r * u.monoMix[0] + g * u.monoMix[1] + b * u.monoMix[2];
    r = lum;
    g = lum;
    b = lum;
  } else {
    const nr = u.matrixRow0[0] * r + u.matrixRow0[1] * g + u.matrixRow0[2] * b;
    const ng = u.matrixRow1[0] * r + u.matrixRow1[1] * g + u.matrixRow1[2] * b;
    const nb = u.matrixRow2[0] * r + u.matrixRow2[1] * g + u.matrixRow2[2] * b;
    r = nr;
    g = ng;
    b = nb;
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    const chroma = high > 0 ? (high - low) / high : 0;
    const factor = u.satBoost > 0 ? 1 + u.satBoost * (1 - 0.65 * chroma) : u.satCut;
    r = lum + (r - lum) * factor;
    g = lum + (g - lum) * factor;
    b = lum + (b - lum) * factor;
  }

  const l = clamp(lum, 0, 1);
  const inv = 1 - l;
  r += u.shadowTone[0] * inv * inv + u.highlightTone[0] * l * l;
  g += u.shadowTone[1] * inv * inv + u.highlightTone[1] * l * l;
  b += u.shadowTone[2] * inv * inv + u.highlightTone[2] * l * l;

  if (u.grainAmount > 0) {
    const cellX = Math.floor(x / u.grainBlock);
    const cellY = Math.floor(y / u.grainBlock);
    const strength = u.grainAmount * (0.25 + 0.75 * 4 * l * inv);
    const grain = sampleNoise(cellY + u.grainSeedRows, cellX) * strength;
    r += grain;
    g += grain;
    b += grain;
    if (u.useMono < 0.5) {
      const colour = sampleNoise(cellY + 97, cellX) * strength * 0.14;
      r += colour;
      b -= colour;
    }
  }

  if (u.vignette > 0) {
    const dx = (x - u.vignetteCenter[0]) / u.vignetteCenter[0];
    const dy = (y - u.vignetteCenter[1]) / u.vignetteCenter[1];
    const dist = 0.5 * (dx * dx + dy * dy);
    const shade = 1 - u.vignette * dist * dist;
    r *= shade;
    g *= shade;
    b *= shade;
  }

  return [clamp(r, 0, 1) * 255, clamp(g, 0, 1) * 255, clamp(b, 0, 1) * 255];
}
