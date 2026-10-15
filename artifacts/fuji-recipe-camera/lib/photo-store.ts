import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import type { SavedPhoto } from '@/context/AppState';

/** Long edge of grid thumbnails. About 120 px per tile on a 3-column S24 Ultra grid at 3x. */
const THUMB_WIDTH = 480;

/**
 * Makes a small JPEG next to the photo for the gallery grid. Returns undefined on any
 * failure: a missing thumbnail only means the grid falls back to the full photo.
 */
export async function makeThumbnail(
  photoUri: string,
  id: string,
  photoWidth: number,
  photoHeight: number,
): Promise<string | undefined> {
  try {
    const documents = FileSystem.documentDirectory;
    if (!documents) return undefined;
    const folder = `${documents}film-photos/thumbs/`;
    const info = await FileSystem.getInfoAsync(folder);
    if (!info.exists) await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const resize =
      photoWidth >= photoHeight ? { width: THUMB_WIDTH } : { height: THUMB_WIDTH };
    const made = await ImageManipulator.manipulateAsync(photoUri, [{ resize }], {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.7,
    });
    const target = `${folder}${id}.jpg`;
    await FileSystem.moveAsync({ from: made.uri, to: target });
    return target;
  } catch {
    return undefined;
  }
}

/** Deletes a photo's files (full image and thumbnail). Never throws. */
export async function deletePhotoFiles(photo: SavedPhoto): Promise<void> {
  const targets = [photo.uri, photo.thumbUri].filter((uri): uri is string => !!uri);
  await Promise.all(
    targets.map((uri) =>
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined),
    ),
  );
}
