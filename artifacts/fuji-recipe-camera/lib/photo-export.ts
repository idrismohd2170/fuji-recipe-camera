import { Alert, Linking, Platform } from 'react-native';

/** Name of the album that saved photos go into on the phone. */
export const ALBUM_NAME = 'Fuji Recipe';

type ExportResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'web' | 'denied' | 'error'; canAskAgain?: boolean; message?: string };

/**
 * Copies photos from app storage into the phone's media library, inside the named album
 * (created on first use). Uses the object API of expo-media-library 57: Album.get,
 * Album.create and Asset.create.
 */
export async function savePhotosToAlbum(uris: string[]): Promise<ExportResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  if (uris.length === 0) return { ok: true, count: 0 };
  try {
    const mediaLibrary = await import('expo-media-library');
    const permission = await mediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) {
      return { ok: false, reason: 'denied', canAskAgain: permission.canAskAgain };
    }
    let album = await mediaLibrary.Album.get(ALBUM_NAME);
    let saved = 0;
    for (const uri of uris) {
      if (!album) {
        // Album.create needs at least one asset, so the first photo creates the album.
        const first = await mediaLibrary.Asset.create(uri);
        album = await mediaLibrary.Album.create(ALBUM_NAME, [first]);
      } else {
        await mediaLibrary.Asset.create(uri, album);
      }
      saved += 1;
    }
    return { ok: true, count: saved };
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}

/** Shows the right alert for a savePhotosToAlbum result. */
export function reportSaveResult(result: ExportResult) {
  if (result.ok) {
    Alert.alert(
      result.count === 1 ? 'Saved to your gallery' : `Saved ${result.count} photos`,
      `Find ${result.count === 1 ? 'it' : 'them'} in the “${ALBUM_NAME}” album on your phone.`,
    );
    return;
  }
  if (result.reason === 'web') {
    Alert.alert('Use your phone', 'Saving to the phone gallery is available in the Android app.');
    return;
  }
  if (result.reason === 'denied') {
    Alert.alert(
      'Photo access is needed',
      result.canAskAgain
        ? 'Allow photo access to copy shots to your phone gallery.'
        : 'Enable photo access in Android settings to save shots to your gallery.',
      result.canAskAgain
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => void Linking.openSettings() },
          ],
    );
    return;
  }
  Alert.alert('Could not save photo', result.message ?? 'Try saving again.');
}

/** Opens the system share sheet for one photo file. */
export async function sharePhoto(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('Use your phone', 'Sharing is available in the Android app.');
    return;
  }
  try {
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'This device cannot open the share sheet.');
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share photo' });
  } catch (error) {
    Alert.alert(
      'Could not share photo',
      error instanceof Error ? error.message : 'Try sharing again.',
    );
  }
}
