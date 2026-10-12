import type { FilmLook } from '@/constants/recipes';

/**
 * Pure pixel pipeline for the film look. It has no React Native imports so it
 * can be unit-tested in plain Node.
 *
 * Per pixel the pipeline is:
 *   1. exposure + white balance, done in linear light (per-channel LUT)
 *   2. filmic S-curve with highlight roll-off, shadow lift and black fade
 *      (same per-channel LUT, so contrast also shifts colour like real film)
 *   3. simulation colour matrix (or channel mix for monochrome stocks)
 *   4. vibrance-style saturation that protects already-saturated colours
 *   5. split toning (shadow / highlight tints)
 *   6. luminance-weighted film grain from a pre-made noise tile
 *   7. vignette
 */

type Vec3 = readonly [number, number, number];

const NOISE_SIZE = 256;
const NOISE_MASK = NOISE_SIZE - 1;

let noiseTile: Float32Array | null = null;

function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const tile = new Float32Array(NOISE_SIZE * NOISE_SIZE);
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
    // Sum of three uniforms is close to Gaussian, which looks like real grain.
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
  noiseTile = tile;
  return tile;
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value: number) {
  const v = Math.max(0, value);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function bump(value: number, center: number, width: number) {
  const distance = (value - center) / width;
  return Math.exp(-distance * distance);
}

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Smooth S-curve that keeps 0, 0.5 and 1 fixed. */
function rawTone(x: number, look: FilmLook) {
  const amount = Math.max(-0.85, Math.min(0.85, look.contrast - 1));
  let y = x - (amount * Math.sin(2 * Math.PI * x)) / (2 * Math.PI);
  y += look.highlights * 0.12 * bump(x, 0.8, 0.22);
  y += look.shadows * 0.1 * bump(x, 0.2, 0.22);
  return y;
}

function buildToneLut(look: FilmLook, gain: number) {
  const lut = new Float32Array(256);
  const exposureGain = Math.pow(2, look.exposure);
  const black = rawTone(0, look);
  const white = rawTone(1, look);
  const span = white - black || 1;
  for (let value = 0; value < 256; value += 1) {
    const linear = srgbToLinear(value / 255) * exposureGain * gain;
    const x = clamp01(linearToSrgb(linear));
    // Re-normalise so pure black stays black and pure white stays white
    // before the fade lifts the blacks.
    const normalised = clamp01((rawTone(x, look) - black) / span);
    const faded = look.fade + normalised * (1 - look.fade);
    lut[value] = faded * 255;
  }
  return lut;
}

function buildSplitTone(shadow: Vec3, highlight: Vec3) {
  const table = new Float32Array(256 * 3);
  for (let value = 0; value < 256; value += 1) {
    const l = value / 255;
    const shadowWeight = (1 - l) * (1 - l);
    const highlightWeight = l * l;
    for (let channel = 0; channel < 3; channel += 1) {
      table[value * 3 + channel] =
        shadow[channel] * shadowWeight + highlight[channel] * highlightWeight;
    }
  }
  return table;
}

function buildGrainWeight() {
  // Grain is strongest in the mid-tones and fades in deep shadows/highlights.
  const table = new Float32Array(256);
  for (let value = 0; value < 256; value += 1) {
    const l = value / 255;
    table[value] = 0.25 + 0.75 * 4 * l * (1 - l);
  }
  return table;
}

export type GradeOptions = {
  onProgress?: (fraction: number) => void;
  /** Called between chunks so the UI thread can breathe. */
  yieldToUi?: () => Promise<void>;
  /** Offsets the grain pattern so two photos never share identical grain. */
  grainSeed?: number;
};

const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function gradePixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  look: FilmLook,
  options: GradeOptions = {},
): Promise<void> {
  const { onProgress, yieldToUi = defaultYield, grainSeed = 0 } = options;

  // A clamped view over the same memory rounds and clamps for us on write.
  const pixels =
    data instanceof Uint8ClampedArray
      ? data
      : new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);

  const redGain = 1 + 0.12 * look.warmth;
  const blueGain = 1 - 0.14 * look.warmth;
  const greenGain = 1 - 0.06 * look.tint;
  const lutR = buildToneLut(look, redGain);
  const lutG = buildToneLut(look, greenGain);
  const lutB = buildToneLut(look, blueGain);

  const split = buildSplitTone(look.shadowTone, look.highlightTone);
  const grainWeight = buildGrainWeight();
  const noise = getNoiseTile();

  const mono = look.channelMix;
  const matrix = look.matrix;
  const m0 = matrix?.[0] ?? 1;
  const m1 = matrix?.[1] ?? 0;
  const m2 = matrix?.[2] ?? 0;
  const m3 = matrix?.[3] ?? 0;
  const m4 = matrix?.[4] ?? 1;
  const m5 = matrix?.[5] ?? 0;
  const m6 = matrix?.[6] ?? 0;
  const m7 = matrix?.[7] ?? 0;
  const m8 = matrix?.[8] ?? 1;

  const saturationBoost = look.saturation > 1 ? look.saturation - 1 : 0;
  const saturationCut = look.saturation <= 1 ? look.saturation : 1;

  // Grain size scales with the image so it looks the same at any resolution.
  const grainBlock = Math.max(
    1,
    Math.round((look.grainSize * Math.max(width, height)) / 3000),
  );
  const grainAmount = look.grain * 9;
  const vignette = look.vignette;

  const columnNoise = new Uint16Array(width);
  const columnDistance = new Float32Array(width);
  const centerX = (width - 1) / 2 || 1;
  const centerY = (height - 1) / 2 || 1;
  for (let x = 0; x < width; x += 1) {
    columnNoise[x] = Math.floor(x / grainBlock) & NOISE_MASK;
    const dx = (x - centerX) / centerX;
    columnDistance[x] = dx * dx * 0.5;
  }

  const rowsPerChunk = Math.max(1, Math.floor(450000 / width));
  const seedOffset = (grainSeed * 40503) & 0xffff;

  for (let y = 0; y < height; y += 1) {
    const noiseRow = ((Math.floor(y / grainBlock) + seedOffset) & NOISE_MASK) * NOISE_SIZE;
    const chromaRow = ((Math.floor(y / grainBlock) + 97) & NOISE_MASK) * NOISE_SIZE;
    const dy = (y - centerY) / centerY;
    const rowDistance = dy * dy * 0.5;
    let index = y * width * 4;

    for (let x = 0; x < width; x += 1, index += 4) {
      let r = lutR[pixels[index]];
      let g = lutG[pixels[index + 1]];
      let b = lutB[pixels[index + 2]];
      let luminance: number;

      if (mono) {
        luminance = r * mono[0] + g * mono[1] + b * mono[2];
        r = luminance;
        g = luminance;
        b = luminance;
      } else {
        if (matrix) {
          const nr = m0 * r + m1 * g + m2 * b;
          const ng = m3 * r + m4 * g + m5 * b;
          const nb = m6 * r + m7 * g + m8 * b;
          r = nr;
          g = ng;
          b = nb;
        }
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const high = r > g ? (r > b ? r : b) : g > b ? g : b;
        const low = r < g ? (r < b ? r : b) : g < b ? g : b;
        const chroma = high > 0 ? (high - low) / high : 0;
        const factor =
          saturationBoost > 0 ? 1 + saturationBoost * (1 - 0.65 * chroma) : saturationCut;
        r = luminance + (r - luminance) * factor;
        g = luminance + (g - luminance) * factor;
        b = luminance + (b - luminance) * factor;
      }

      const bucket = luminance < 0 ? 0 : luminance > 255 ? 255 : (luminance + 0.5) | 0;
      const tone = bucket * 3;
      r += split[tone];
      g += split[tone + 1];
      b += split[tone + 2];

      if (grainAmount > 0) {
        const column = columnNoise[x];
        const strength = grainAmount * grainWeight[bucket];
        const grain = noise[noiseRow + column] * strength;
        r += grain;
        g += grain;
        b += grain;
        if (!mono) {
          // A touch of independent colour noise, like real emulsion.
          const colour = noise[chromaRow + column] * strength * 0.14;
          r += colour;
          b -= colour;
        }
      }

      if (vignette > 0) {
        const distance = columnDistance[x] + rowDistance;
        const shade = 1 - vignette * distance * distance;
        r *= shade;
        g *= shade;
        b *= shade;
      }

      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
    }

    if ((y + 1) % rowsPerChunk === 0 && y + 1 < height) {
      onProgress?.((y + 1) / height);
      await yieldToUi();
    }
  }
  onProgress?.(1);
}
