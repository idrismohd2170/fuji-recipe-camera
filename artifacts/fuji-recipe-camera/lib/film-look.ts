import { fromByteArray, toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import type { FilmRecipe } from '@/constants/recipes';
import { gradePixels } from '@/lib/film-grade';

/**
 * jpeg-js decodes and encodes in plain JavaScript, so cost grows with pixel
 * count. 2560px on the long edge (about 5 MP) is plenty for phone viewing and
 * social sharing while keeping a shot to seconds instead of minutes.
 */
const MAX_LONG_EDGE = 2560;
const OUTPUT_QUALITY = 92;

export type RenderProgress = (label: string, fraction: number) => void;

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function decodePrepared(base64: string) {
  return jpeg.decode(toByteArray(base64), {
    useTArray: true,
    maxMemoryUsageInMB: 1024,
  });
}

export async function renderFilmLook(
  sourceUri: string,
  recipe: FilmRecipe,
  sourceWidth: number,
  sourceHeight: number,
  onProgress?: RenderProgress,
): Promise<{ base64: string; width: number; height: number }> {
  onProgress?.('Preparing photo', 0);
  const resize =
    Math.max(sourceWidth, sourceHeight) > MAX_LONG_EDGE
      ? sourceWidth >= sourceHeight
        ? [{ resize: { width: MAX_LONG_EDGE } }]
        : [{ resize: { height: MAX_LONG_EDGE } }]
      : [];
  const prepared = await ImageManipulator.manipulateAsync(sourceUri, resize, {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.94,
    base64: true,
  });
  // The manipulator writes its result to the cache; it is only needed for the base64 below.
  const preparedUri = prepared.uri;
  const preparedBase64 = prepared.base64;
  if (preparedUri && preparedUri !== sourceUri) {
    void FileSystem.deleteAsync(preparedUri, { idempotent: true }).catch(() => {});
  }
  if (!preparedBase64) throw new Error('The camera image could not be prepared.');

  onProgress?.('Preparing photo', 0.1);
  await nextTick();
  // Decode in a helper so the (large) base64 string and the byte copy of it are
  // unreachable before grading starts, which lowers peak memory.
  const decoded = decodePrepared(preparedBase64);
  onProgress?.('Applying film look', 0.25);
  await nextTick();

  await gradePixels(decoded.data, decoded.width, decoded.height, recipe.look, {
    grainSeed: Date.now() & 0xffff,
    onProgress: (fraction) => onProgress?.('Applying film look', 0.25 + fraction * 0.55),
  });

  onProgress?.('Saving photo', 0.82);
  await nextTick();
  const encoded = jpeg.encode(
    { data: decoded.data, width: decoded.width, height: decoded.height },
    OUTPUT_QUALITY,
  );
  onProgress?.('Saving photo', 1);
  return {
    // encoded.data is already a Uint8Array (Buffer); no extra copy needed.
    base64: fromByteArray(encoded.data),
    width: decoded.width,
    height: decoded.height,
  };
}
