// Compares the film shader maths in lib/film-shader.ts with gradePixels
// (lib/film-grade.ts) on a test image, for every recipe.
//
// Run from artifacts/fuji-recipe-camera (Node 22.18+ strips TypeScript types):
//   node --no-warnings scripts/compare-film-shader.mjs
//
// Part 1 (always): plain-TypeScript reference evaluation vs gradePixels.
// Part 2 (only if canvaskit-wasm is in node_modules, it comes with
// @shopify/react-native-skia): compiles the real SkSL and runs it on a CPU
// surface, then compares that against the reference and gradePixels too.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { gradePixels } from '../lib/film-grade.ts';
import { recipes } from '../constants/recipes.ts';
import {
  FILM_NOISE_SIZE,
  FILM_SHADER_SKSL,
  computeFilmShaderUniforms,
  createFilmNoiseBytes,
  evaluateFilmPixelReference,
  flattenFilmShaderUniforms,
} from '../lib/film-shader.ts';

const WIDTH = 96;
const HEIGHT = 64;
const here = path.dirname(fileURLToPath(import.meta.url));

function makeTestPixels() {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const i = (y * WIDTH + x) * 4;
      const ramp = Math.round((x / (WIDTH - 1)) * 255);
      let rgb;
      if (y === 0) rgb = [ramp, ramp, ramp];
      else if (y === 1) rgb = [ramp, 0, 0];
      else if (y === 2) rgb = [0, ramp, 0];
      else if (y === 3) rgb = [0, 0, ramp];
      else if (y === 4) rgb = [255 - ramp, ramp, 128];
      else rgb = [random() * 256, random() * 256, random() * 256].map(Math.floor);
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  return data;
}

const looks = [
  ...recipes.map((recipe) => ({ name: recipe.id, look: recipe.look })),
  {
    name: 'stress (extreme values)',
    look: {
      ...recipes[0].look,
      exposure: 1,
      contrast: 1.6,
      highlights: 0.8,
      shadows: 0.8,
      fade: 0.1,
      saturation: 1.5,
      warmth: -0.8,
      tint: 0.9,
      grain: 1,
      grainSize: 2,
      vignette: 0.6,
    },
  },
  {
    name: 'stress (hue bands + curves)',
    look: {
      ...recipes[0].look,
      saturation: 1.2,
      channelGamma: [1.25, 1, 0.8],
      hueBands: [20, 0.5, -0.05, -30, 0.3, 0.05, 25, -0.4, 0.03, 10, 0.6, -0.04, -15, 0.7, 0.06, 35, 0.4, -0.02],
    },
  },
];

function toLevels(rgb) {
  return Uint8ClampedArray.of(rgb[0], rgb[1], rgb[2]); // rounds like gradePixels
}

async function gradeCopy(source, look, grainSeed) {
  const copy = new Uint8Array(source);
  await gradePixels(copy, WIDTH, HEIGHT, look, { grainSeed, yieldToUi: async () => {} });
  return copy;
}

function stats() {
  return { max: 0, sum: 0, count: 0, at: '' };
}
function add(s, diff, label) {
  if (diff > s.max) {
    s.max = diff;
    s.at = label;
  }
  s.sum += diff;
  s.count += 1;
}
const fmt = (s) => `max ${s.max.toFixed(0).padStart(2)}  mean ${(s.sum / s.count).toFixed(3)}`;

const source = makeTestPixels();
let overall = 0;
let overallNoGrain = 0;

console.log(`Part 1: reference (lib/film-shader.ts) vs gradePixels, ${WIDTH}x${HEIGHT} test image`);
console.log('Differences are in 8-bit levels (0..255), over R, G and B of every pixel.\n');

for (const { name, look } of looks) {
  for (const [variant, variantLook] of [
    ['grain on ', look],
    ['grain off', { ...look, grain: 0 }],
  ]) {
    const grainSeed = 7;
    const graded = await gradeCopy(source, variantLook, grainSeed);
    const uniforms = computeFilmShaderUniforms(variantLook, WIDTH, HEIGHT, grainSeed);
    const s = stats();
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const i = (y * WIDTH + x) * 4;
        const out = toLevels(
          evaluateFilmPixelReference(uniforms, [source[i], source[i + 1], source[i + 2]], x, y),
        );
        for (let c = 0; c < 3; c += 1) {
          add(s, Math.abs(out[c] - graded[i + c]), `x${x} y${y} c${c}`);
        }
      }
    }
    if (variant.includes('on')) overall = Math.max(overall, s.max);
    else overallNoGrain = Math.max(overallNoGrain, s.max);
    console.log(`${name.padEnd(26)} ${variant}  ${fmt(s)}  (worst at ${s.at})`);
  }
}
console.log(`\nPart 1 overall max difference: ${overall} levels with grain, ${overallNoGrain} levels without grain.\n`);

// 1 level is 8-bit rounding; a bigger gap means the preview shader and the photo grade drifted apart.
const MAX_DIFF = 2;
if (overall > MAX_DIFF || overallNoGrain > MAX_DIFF) {
  console.error(`FAILED: reference differs from gradePixels by more than ${MAX_DIFF} levels.`);
  process.exit(1);
}

// ---------------------------------------------------------------- Part 2
function findCanvasKit() {
  const candidates = [path.join(here, '..', 'node_modules', 'canvaskit-wasm')];
  const store = path.join(here, '..', '..', '..', 'node_modules', '.pnpm');
  if (fs.existsSync(store)) {
    for (const entry of fs.readdirSync(store)) {
      if (entry.startsWith('canvaskit-wasm@')) {
        candidates.push(path.join(store, entry, 'node_modules', 'canvaskit-wasm'));
      }
    }
  }
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'bin', 'canvaskit.js')));
}

const canvasKitDir = findCanvasKit();
if (!canvasKitDir) {
  console.log('Part 2 skipped: canvaskit-wasm not found (install dependencies first).');
  process.exit(process.env.CI ? 1 : 0); // CI must not silently skip the SkSL compile check
}

const require = createRequire(path.join(canvasKitDir, 'package.json'));
const CanvasKitInit = require(path.join(canvasKitDir, 'bin', 'canvaskit.js'));
const ck = await CanvasKitInit({ locateFile: (file) => path.join(canvasKitDir, 'bin', file) });

console.log(`Part 2: real SkSL in CanvasKit (CPU surface) from ${path.relative(process.cwd(), canvasKitDir)}`);
const effect = ck.RuntimeEffect.Make(FILM_SHADER_SKSL, (error) => console.log('SkSL compile error:', error));
if (!effect) {
  console.log('FAILED: the SkSL did not compile.');
  process.exit(1);
}
const floatCount = effect.getUniformFloatCount();
const flatLength = flattenFilmShaderUniforms(computeFilmShaderUniforms(looks[0].look, WIDTH, HEIGHT)).length;
console.log(`SkSL compiled. Uniform floats expected by the effect: ${floatCount}; passed by flattenFilmShaderUniforms: ${flatLength}.`);
if (floatCount !== flatLength) {
  console.log('FAILED: uniform layout mismatch.');
  process.exit(1);
}

const imageInfo = (w, h) => ({
  width: w,
  height: h,
  alphaType: ck.AlphaType.Unpremul,
  colorType: ck.ColorType.RGBA_8888,
  colorSpace: ck.ColorSpace.SRGB,
});
const sourceImage = ck.MakeImage(imageInfo(WIDTH, HEIGHT), source, WIDTH * 4);
const noiseImage = ck.MakeImage(
  imageInfo(FILM_NOISE_SIZE, FILM_NOISE_SIZE),
  createFilmNoiseBytes(),
  FILM_NOISE_SIZE * 4,
);
const sampling = [ck.TileMode.Repeat, ck.TileMode.Repeat, ck.FilterMode.Nearest, ck.MipmapMode.None];
const sourceShader = sourceImage.makeShaderOptions(
  ck.TileMode.Clamp, ck.TileMode.Clamp, ck.FilterMode.Nearest, ck.MipmapMode.None,
);
const noiseShader = noiseImage.makeShaderOptions(...sampling);

let shaderVsRef = 0;
let shaderVsGrade = 0;
let shaderVsGradeNoGrain = 0;
for (const { name, look } of looks) {
  for (const grainOn of [true, false]) {
    const variantLook = grainOn ? look : { ...look, grain: 0 };
    const grainSeed = 7;
    const uniforms = computeFilmShaderUniforms(variantLook, WIDTH, HEIGHT, grainSeed);
    const shader = effect.makeShaderWithChildren(flattenFilmShaderUniforms(uniforms), [
      sourceShader,
      noiseShader,
    ]);
    const surface = ck.MakeSurface(WIDTH, HEIGHT);
    const canvas = surface.getCanvas();
    const paint = new ck.Paint();
    paint.setShader(shader);
    canvas.drawRect(ck.LTRBRect(0, 0, WIDTH, HEIGHT), paint);
    const rendered = canvas.readPixels(0, 0, imageInfo(WIDTH, HEIGHT));
    const graded = await gradeCopy(source, variantLook, grainSeed);

    const vsRef = stats();
    const vsGrade = stats();
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const i = (y * WIDTH + x) * 4;
        const ref = evaluateFilmPixelReference(uniforms, [source[i], source[i + 1], source[i + 2]], x, y);
        for (let c = 0; c < 3; c += 1) {
          add(vsRef, Math.abs(rendered[i + c] - ref[c]), `x${x} y${y} c${c}`);
          add(vsGrade, Math.abs(rendered[i + c] - graded[i + c]), `x${x} y${y} c${c}`);
        }
      }
    }
    shaderVsRef = Math.max(shaderVsRef, vsRef.max);
    if (grainOn) shaderVsGrade = Math.max(shaderVsGrade, vsGrade.max);
    else shaderVsGradeNoGrain = Math.max(shaderVsGradeNoGrain, vsGrade.max);
    console.log(
      `${name.padEnd(26)} grain ${grainOn ? 'on ' : 'off'}  SkSL vs reference ${fmt(vsRef)} | SkSL vs gradePixels ${fmt(vsGrade)}`,
    );
    paint.delete();
    shader.delete();
    surface.delete();
  }
}
console.log(
  `\nPart 2 overall max difference: SkSL vs reference ${shaderVsRef} levels; SkSL vs gradePixels ${shaderVsGrade} levels with grain, ${shaderVsGradeNoGrain} without grain.`,
);
if (shaderVsRef > 1 || shaderVsGrade > MAX_DIFF || shaderVsGradeNoGrain > MAX_DIFF) {
  console.error('FAILED: the SkSL output differs from the reference or from gradePixels.');
  process.exit(1);
}

// ---------------------------------------------------------------- Part 3
// The glass lighting and aurora shaders must compile and take exactly the uniforms we pass.
const { GLASS_LIGHT_DIR, GLASS_SKSL, flattenGlassUniforms } = await import('../lib/glass-shader.ts');
const { AURORA_COLORS, AURORA_SKSL, flattenAuroraUniforms } = await import('../lib/aurora-shader.ts');
console.log('\nPart 3: glass and aurora SkSL compile');
const extras = [
  ['glass', GLASS_SKSL, flattenGlassUniforms({ size: [200, 60], radius: 28, lightDir: GLASS_LIGHT_DIR, press: 0, dark: 1, strength: 1 })],
  ['aurora', AURORA_SKSL, flattenAuroraUniforms({ res: [100, 200], time: 1, ...AURORA_COLORS, intensity: 0.8 })],
];
for (const [name, sksl, flat] of extras) {
  const fx = ck.RuntimeEffect.Make(sksl, (error) => console.log(`${name} SkSL compile error:`, error));
  if (!fx) {
    console.error(`FAILED: the ${name} SkSL did not compile.`);
    process.exit(1);
  }
  const count = fx.getUniformFloatCount();
  console.log(`${name}: compiled, ${count} uniform floats expected, ${flat.length} passed.`);
  if (count !== flat.length) {
    console.error(`FAILED: ${name} uniform layout mismatch.`);
    process.exit(1);
  }
}
