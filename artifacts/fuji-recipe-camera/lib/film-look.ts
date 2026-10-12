import { fromByteArray, toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';
import * as ImageManipulator from 'expo-image-manipulator';
import type { FilmRecipe } from '@/constants/recipes';

const MAX_LONG_EDGE = 3840;

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function grainAt(index: number) {
  let value = index + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967295 - 0.5;
}

export async function renderFilmLook(
  sourceUri: string,
  recipe: FilmRecipe,
  sourceWidth: number,
  sourceHeight: number,
): Promise<{ base64: string; width: number; height: number }> {
  const resize =
    Math.max(sourceWidth, sourceHeight) > MAX_LONG_EDGE
      ? sourceWidth >= sourceHeight
        ? [{ resize: { width: MAX_LONG_EDGE } }]
        : [{ resize: { height: MAX_LONG_EDGE } }]
      : [];
  const prepared = await ImageManipulator.manipulateAsync(sourceUri, resize, {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.96,
    base64: true,
  });
  if (!prepared.base64) throw new Error('The camera image could not be prepared.');

  const decoded = jpeg.decode(toByteArray(prepared.base64), { useTArray: true });
  const pixels = decoded.data;
  const { contrast, exposure, grain, saturation, warmth } = recipe.look;

  for (let index = 0; index < pixels.length; index += 4) {
    const originalRed = pixels[index];
    const originalGreen = pixels[index + 1];
    const originalBlue = pixels[index + 2];
    const luminance =
      originalRed * 0.2126 + originalGreen * 0.7152 + originalBlue * 0.0722;
    const texture = grainAt(index) * grain;
    let red = luminance + (originalRed - luminance) * saturation;
    let green = luminance + (originalGreen - luminance) * saturation;
    let blue = luminance + (originalBlue - luminance) * saturation;
    const highlightWeight = luminance / 255;

    red = (red - 128) * contrast + 128 + exposure + warmth * (0.2 + highlightWeight * 0.8);
    green =
      (green - 128) * contrast +
      128 +
      exposure -
      Math.abs(warmth) * 0.025 +
      texture;
    blue = (blue - 128) * contrast + 128 + exposure - warmth * (0.12 + highlightWeight * 0.55);
    pixels[index] = clamp(red + texture);
    pixels[index + 1] = clamp(green);
    pixels[index + 2] = clamp(blue + texture * 0.6);
  }

  const encoded = jpeg.encode(
    { data: pixels, width: decoded.width, height: decoded.height },
    94,
  );
  return {
    base64: fromByteArray(new Uint8Array(encoded.data)),
    width: decoded.width,
    height: decoded.height,
  };
}
