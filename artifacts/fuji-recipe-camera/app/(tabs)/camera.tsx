import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType, FlashMode } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { recipes } from '@/constants/recipes';
import { useAppState, type SavedPhoto } from '@/context/AppState';
import { renderFilmLook } from '@/lib/film-look';

function PermissionPanel({
  title,
  copy,
  button,
  onPress,
  colors,
  busy = false,
}: {
  title: string;
  copy: string;
  button: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  busy?: boolean;
}) {
  return (
    <View style={[styles.permissionPage, { backgroundColor: colors.background }]}>
      <View style={[styles.permissionLens, { borderColor: colors.border }]}>
        <Feather name="camera" size={27} color={colors.primary} />
      </View>
      <Text style={[styles.permissionTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.permissionCopy, { color: colors.mutedForeground }]}>{copy}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={busy}
        style={[styles.permissionButton, { backgroundColor: colors.primary }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.permissionButtonText, { color: colors.primaryForeground }]}>
            {button}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export default function CameraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { activeRecipe, activeRecipeId, addPhoto, setActiveRecipeId } = useAppState();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [showGrid, setShowGrid] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<SavedPhoto | null>(null);
  const [isSavingToPhone, setIsSavingToPhone] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <PermissionPanel
        title="Take it to your phone"
        copy="Live camera capture is available in the mobile app. Open this project on your Android phone to use the S24 Ultra camera."
        button="Back to recipes"
        onPress={() => router.navigate('/')}
        colors={colors}
      />
    );
  }

  if (!cameraPermission) {
    return (
      <View style={[styles.permissionPage, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    const permanentlyDenied =
      cameraPermission.status === 'denied' && !cameraPermission.canAskAgain;
    return (
      <PermissionPanel
        title="Give the camera room"
        copy="Allow camera access to frame a shot and preview your chosen film recipe."
        button={permanentlyDenied ? 'Open settings' : 'Allow camera'}
        onPress={() => {
          if (permanentlyDenied) {
            void Linking.openSettings();
          } else {
            void requestCameraPermission();
          }
        }}
        colors={colors}
      />
    );
  }

  const takeShot = async () => {
    if (!cameraRef.current || !isReady || isCapturing) return;
    setIsCapturing(true);
    try {
      const source = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: false,
      });
      if (!source?.uri) throw new Error('The camera did not return an image.');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const rendered = await renderFilmLook(source.uri, activeRecipe, source.width, source.height);
      const documents = FileSystem.documentDirectory;
      if (!documents) throw new Error('Photo storage is unavailable on this device.');
      const folder = `${documents}film-photos/`;
      const folderInfo = await FileSystem.getInfoAsync(folder);
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      }
      const id = `${Date.now()}`;
      const uri = `${folder}${id}-${activeRecipeId}.jpg`;
      await FileSystem.writeAsStringAsync(uri, rendered.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const photo: SavedPhoto = {
        id,
        uri,
        recipeId: activeRecipeId,
        createdAt: new Date().toISOString(),
        width: rendered.width,
        height: rendered.height,
      };
      addPhoto(photo);
      setCapturedPhoto(photo);
    } catch (error) {
      Alert.alert(
        'Could not finish this shot',
        error instanceof Error ? error.message : 'Try taking the photo again.',
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const saveToPhone = async () => {
    if (!capturedPhoto || isSavingToPhone) return;
    setIsSavingToPhone(true);
    try {
      const mediaLibrary = await import('expo-media-library');
      const permission = await mediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert(
          'Photo access is needed',
          permission.canAskAgain
            ? 'Allow photo access to copy this shot to your phone gallery.'
            : 'Enable photo access in Android settings to save this shot to your gallery.',
          permission.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open settings', onPress: () => void Linking.openSettings() },
              ],
        );
        return;
      }
      await mediaLibrary.Asset.create(capturedPhoto.uri);
      Alert.alert('Saved to your gallery', 'The recipe-look photo is now in your phone gallery.');
    } catch (error) {
      Alert.alert(
        'Could not save photo',
        error instanceof Error ? error.message : 'Try saving again.',
      );
    } finally {
      setIsSavingToPhone(false);
    }
  };

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        ref={cameraRef}
        facing={facing}
        flash={flash}
        style={StyleSheet.absoluteFill}
        onCameraReady={() => setIsReady(true)}
        onMountError={(event) => Alert.alert('Camera unavailable', event.message)}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: activeRecipe.look.previewTint }]}
        />
        {showGrid && (
          <View pointerEvents="none" style={styles.grid}>
            <View style={styles.gridVerticalOne} />
            <View style={styles.gridVerticalTwo} />
            <View style={styles.gridHorizontalOne} />
            <View style={styles.gridHorizontalTwo} />
          </View>
        )}
      </CameraView>

      <View style={[styles.cameraTopBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to recipes"
          onPress={() => router.navigate('/')}
          style={styles.cameraIconButton}
        >
          <Feather name="chevron-left" size={22} color="#fff" />
        </Pressable>
        <View style={styles.previewBadge}>
          <View style={[styles.previewDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.previewBadgeText}>LIVE PREVIEW</Text>
        </View>
        <Pressable
          testID="toggle-grid"
          accessibilityRole="button"
          accessibilityLabel={showGrid ? 'Hide framing grid' : 'Show framing grid'}
          onPress={() => setShowGrid((value) => !value)}
          style={styles.cameraIconButton}
        >
          <Feather name="grid" size={17} color={showGrid ? colors.primary : '#fff'} />
        </Pressable>
      </View>

      <View
        style={[
          styles.cameraBottom,
          { paddingBottom: Math.max(insets.bottom, 10) + 18 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowRecipes(true)}
          style={styles.recipePicker}
        >
          <View style={styles.recipePickerText}>
            <Text style={styles.recipePickerLabel}>FILM RECIPE</Text>
            <Text style={styles.recipePickerName} numberOfLines={1}>{activeRecipe.name}</Text>
          </View>
          <Feather name="chevron-up" size={17} color="#f2eee2" />
        </Pressable>

        <View style={styles.shutterRow}>
          <Pressable
            testID="toggle-flash"
            accessibilityRole="button"
            accessibilityLabel={`Flash ${flash === 'off' ? 'off' : 'on'}`}
            onPress={() => setFlash((value) => (value === 'off' ? 'on' : 'off'))}
            style={styles.cameraControl}
          >
            <Feather name={flash === 'off' ? 'zap-off' : 'zap'} size={19} color="#f2eee2" />
            <Text style={styles.cameraControlLabel}>{flash === 'off' ? 'OFF' : 'ON'}</Text>
          </Pressable>

          <Pressable
            testID="take-photo"
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={() => void takeShot()}
            disabled={!isReady || isCapturing}
            style={({ pressed }) => [
              styles.shutterOuter,
              { opacity: !isReady || isCapturing ? 0.55 : pressed ? 0.7 : 1 },
            ]}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#171a16" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>

          <Pressable
            testID="flip-camera"
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
            style={styles.cameraControl}
          >
            <Feather name="refresh-cw" size={19} color="#f2eee2" />
            <Text style={styles.cameraControlLabel}>FLIP</Text>
          </Pressable>
        </View>
        <Text style={styles.cameraHint}>
          {isCapturing ? 'Applying recipe to your photo…' : 'TAP TO CAPTURE  ·  SAVED WITH LOOK'}
        </Text>
      </View>

      {!isReady && !isCapturing && (
        <View pointerEvents="none" style={styles.loadingCamera}>
          <ActivityIndicator color="#f2eee2" />
        </View>
      )}

      <Modal
        visible={showRecipes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecipes(false)}
      >
        <View style={styles.modalShade}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRecipes(false)} />
          <View
            style={[
              styles.recipeSheet,
              { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 18) + 12 },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View>
                <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>CHOOSE A LOOK</Text>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Film recipes</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close recipe selector"
                onPress={() => setShowRecipes(false)}
                style={styles.sheetClose}
              >
                <Feather name="x" size={19} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {recipes.map((recipe) => {
                const selected = recipe.id === activeRecipeId;
                return (
                  <Pressable
                    key={recipe.id}
                    testID={`select-${recipe.id}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setActiveRecipeId(recipe.id);
                      setShowRecipes(false);
                    }}
                    style={[
                      styles.sheetRecipeRow,
                      { borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    <View style={[styles.recipeSwatch, { backgroundColor: recipe.look.previewTint }]} />
                    <View style={styles.sheetRecipeCopy}>
                      <Text style={[styles.sheetRecipeName, { color: colors.foreground }]}>
                        {recipe.name}
                      </Text>
                      <Text style={[styles.sheetRecipeMeta, { color: colors.mutedForeground }]}>
                        {recipe.simulation}  ·  {recipe.settings[0]}
                      </Text>
                    </View>
                    {selected && <Feather name="check" size={17} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={[styles.sheetNote, { color: colors.mutedForeground }]}>
              Preview is an approximation. The finished photo gets the full recipe grade.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!capturedPhoto}
        animationType="fade"
        onRequestClose={() => setCapturedPhoto(null)}
      >
        {capturedPhoto && (
          <View style={[styles.reviewScreen, { backgroundColor: colors.background }]}>
            <Image source={{ uri: capturedPhoto.uri }} style={styles.reviewImage} resizeMode="contain" />
            <View style={[styles.reviewTop, { paddingTop: insets.top + 8 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close photo preview"
                onPress={() => setCapturedPhoto(null)}
                style={styles.cameraIconButton}
              >
                <Feather name="x" size={19} color="#fff" />
              </Pressable>
              <Text style={styles.reviewTitle}>SHOT DEVELOPED</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={[styles.reviewBottom, { paddingBottom: Math.max(insets.bottom, 18) + 16 }]}>
              <Text style={styles.reviewRecipe}>{activeRecipe.name.toUpperCase()}</Text>
              <Text style={styles.reviewCaption}>
                {capturedPhoto.width} × {capturedPhoto.height} · Recipe look applied
              </Text>
              <View style={styles.reviewActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCapturedPhoto(null);
                    router.navigate('/gallery');
                  }}
                  style={[styles.reviewSecondary, { borderColor: 'rgba(255,255,255,0.42)' }]}
                >
                  <Feather name="image" size={16} color="#fff" />
                  <Text style={styles.reviewSecondaryText}>Open gallery</Text>
                </Pressable>
                <Pressable
                  testID="save-photo-to-phone"
                  accessibilityRole="button"
                  onPress={() => void saveToPhone()}
                  disabled={isSavingToPhone}
                  style={[styles.reviewPrimary, { backgroundColor: colors.primary }]}
                >
                  {isSavingToPhone ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Feather name="download" size={16} color={colors.primaryForeground} />
                      <Text style={[styles.reviewPrimaryText, { color: colors.primaryForeground }]}>
                        Save to phone
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraScreen: { flex: 1, backgroundColor: '#111510', overflow: 'hidden' },
  cameraTopBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(14,17,14,0.58)',
  },
  previewBadge: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(14,17,14,0.58)',
  },
  previewDot: { width: 6, height: 6, borderRadius: 3 },
  previewBadgeText: { color: '#f2eee2', fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
  grid: { ...StyleSheet.absoluteFill, justifyContent: 'space-evenly' },
  gridVerticalOne: {
    position: 'absolute',
    left: '33.3%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  gridVerticalTwo: {
    position: 'absolute',
    left: '66.6%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  gridHorizontalOne: {
    position: 'absolute',
    top: '33.3%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  gridHorizontalTwo: {
    position: 'absolute',
    top: '66.6%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  cameraBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 27,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(16,19,16,0.72)',
  },
  recipePicker: {
    alignSelf: 'center',
    marginTop: 13,
    marginBottom: 9,
    minWidth: 210,
    maxWidth: '88%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.21)',
    backgroundColor: 'rgba(32,37,31,0.85)',
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  recipePickerText: { flex: 1 },
  recipePickerLabel: { color: '#bfbdaf', fontSize: 8, fontWeight: '700', letterSpacing: 1.2 },
  recipePickerName: { color: '#f2eee2', fontSize: 13, fontWeight: '700', marginTop: 3 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraControl: { width: 54, alignItems: 'center', gap: 5 },
  cameraControlLabel: { color: '#e1ddce', fontSize: 8, fontWeight: '700', letterSpacing: 0.9 },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#f7f1e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#f7f1e4' },
  cameraHint: {
    color: '#bab9ae',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.3,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 2,
  },
  loadingCamera: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionPage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 35 },
  permissionLens: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 21,
  },
  permissionTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  permissionCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, maxWidth: 290 },
  permissionButton: {
    minWidth: 170,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 20,
  },
  permissionButtonText: { fontSize: 13, fontWeight: '700' },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.52)' },
  recipeSheet: { maxHeight: '82%', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 20 },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(242,238,226,0.32)',
    marginTop: 10,
    marginBottom: 17,
  },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sheetEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  sheetTitle: { fontSize: 22, fontWeight: '700', marginTop: 3 },
  sheetClose: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetRecipeRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 11,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  recipeSwatch: { width: 34, height: 34, borderRadius: 11 },
  sheetRecipeCopy: { flex: 1 },
  sheetRecipeName: { fontSize: 13, fontWeight: '700' },
  sheetRecipeMeta: { fontSize: 10, marginTop: 4 },
  sheetNote: { fontSize: 10, lineHeight: 15, marginTop: 3, marginBottom: 11 },
  reviewScreen: { flex: 1, justifyContent: 'space-between' },
  reviewImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined, backgroundColor: '#121512' },
  reviewTop: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewTitle: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1.6 },
  reviewBottom: { paddingHorizontal: 20, paddingTop: 42, backgroundColor: 'rgba(15,18,15,0.78)' },
  reviewRecipe: { color: '#e4ad8d', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  reviewCaption: { color: '#f2eee2', fontSize: 12, marginTop: 5 },
  reviewActions: { flexDirection: 'row', gap: 9, marginTop: 17 },
  reviewSecondary: {
    flex: 1,
    height: 47,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  reviewSecondaryText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reviewPrimary: {
    flex: 1,
    height: 47,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  reviewPrimaryText: { fontSize: 11, fontWeight: '700' },
});
