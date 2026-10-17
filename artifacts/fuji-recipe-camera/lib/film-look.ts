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
export const OUTPUT_QUALITY = 92;

export type RenderProgress = (label: string, fraction: number) => void;

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * jpeg-js's encoder ends with `Buffer.from(bytes)`, and React Native's Hermes engine has no
 * global `Buffer` ("Property 'Buffer' doesn't exist"). The decoder is fine because we pass
 * `useTArray`. The shim exists only while the synchronous encode runs, so no other library
 * ever sees a fake global Buffer.
 */
function encodeJpeg(
  image: { data: Uint8Array; width: number; height: number },
  quality: number,
): Uint8Array {
  const scope = globalThis as unknown as { Buffer?: unknown };
  const hadBuffer = typeof scope.Buffer !== 'undefined';
  if (!hadBuffer) {
    scope.Buffer = {
      from: (bytes: ArrayLike<number>) => Uint8Array.from(bytes),
      alloc: (size: number) => new Uint8Array(size),
    };
  }
  try {
    return new Uint8Array(jpeg.encode(image, quality).data);
  } finally {
    if (!hadBuffer) delete scope.Buffer;
  }
}

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
  const encoded = encodeJpeg(
    { data: decoded.data, width: decoded.width, height: decoded.height },
    OUTPUT_QUALITY,
  );
  onProgress?.('Saving photo', 1);
  return {
    base64: fromByteArray(encoded),
    width: decoded.width,
    height: decoded.height,
  };
}
