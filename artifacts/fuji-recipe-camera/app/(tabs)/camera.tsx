import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType, FlashMode } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';
import { recipes } from '@/constants/recipes';
import { fonts, type } from '@/constants/typography';
import { useAppState, type SavedPhoto } from '@/context/AppState';
import { renderFilmLook } from '@/lib/film-look';

/**
 * Lens pills. Only the main camera is wired up right now; the others are shown so the
 * layout is final, and are disabled until lens switching is built (see NOTES.md).
 */
const LENSES = [
  { label: '0.6', enabled: false },
  { label: '1×', enabled: true },
  { label: '3', enabled: false },
  { label: '5', enabled: false },
] as const;

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
      <View style={[styles.permissionLens, { backgroundColor: colors.card }]}>
        <Feather name="camera" size={30} color={colors.primary} />
      </View>
      <Text style={[type.title1, styles.permissionTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[type.callout, styles.permissionCopy, { color: colors.mutedForeground }]}>{copy}</Text>
      <PressableScale
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
      </PressableScale>
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
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<SavedPhoto | null>(null);
  const [isSavingToPhone, setIsSavingToPhone] = useState(false);
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const { width: screenWidth } = useWindowDimensions();

  // Tabs keep screens mounted, so without this the camera keeps running (and
  // draining battery) while another tab is open, and can come back frozen.
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setIsReady(false);
      };
    }, []),
  );

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
        title="Allow camera access"
        copy="Frame a shot and preview your chosen film recipe in live view."
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

  // The sensor captures 4:3, so the preview is a 4:3 frame too. What you see is
  // exactly what is saved, instead of a cropped full-screen view.
  const previewHeight = Math.round((screenWidth * 4) / 3);
  const previewTop = insets.top + 62;

  const discardOriginal = (uri: string | null) => {
    if (uri) void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  };

  const closeReview = () => {
    discardOriginal(originalUri);
    setOriginalUri(null);
    setShowOriginal(false);
    setCapturedPhoto(null);
  };

  const takeShot = async () => {
    if (!cameraRef.current || !isReady || isCapturing) return;
    setIsCapturing(true);
    setProgress({ label: 'Capturing', percent: 0 });
    try {
      const source = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: false,
      });
      if (!source?.uri) throw new Error('The camera did not return an image.');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const rendered = await renderFilmLook(
        source.uri,
        activeRecipe,
        source.width,
        source.height,
        (label, fraction) => setProgress({ label, percent: Math.round(fraction * 100) }),
      );
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
      // Keep the untouched frame so "hold to compare" can show before/after.
      setOriginalUri(source.uri);
      setShowOriginal(false);
      setCapturedPhoto(photo);
    } catch (error) {
      Alert.alert(
        'Could not finish this shot',
        error instanceof Error ? error.message : 'Try taking the photo again.',
      );
    } finally {
      setIsCapturing(false);
      setProgress(null);
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
      {isFocused && <StatusBar style="light" />}

      <View
        style={[
          styles.previewFrame,
          { top: previewTop, height: previewHeight },
        ]}
      >
        {isFocused && (
          <CameraView
            ref={cameraRef}
            facing={facing}
            flash={flash}
            ratio="4:3"
            style={StyleSheet.absoluteFill}
            onCameraReady={() => setIsReady(true)}
            onMountError={(event) => Alert.alert('Camera unavailable', event.message)}
          />
        )}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: activeRecipe.look.previewTint }]}
        />
        {showGrid && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.gridLine, styles.gridV, { left: '33.33%' }]} />
            <View style={[styles.gridLine, styles.gridV, { left: '66.66%' }]} />
            <View style={[styles.gridLine, styles.gridH, { top: '33.33%' }]} />
            <View style={[styles.gridLine, styles.gridH, { top: '66.66%' }]} />
          </View>
        )}

        {/* Lens pills float at the bottom of the viewfinder, like the stock camera. */}
        <View pointerEvents="box-none" style={styles.lensWrap}>
          <Glass forceDark radius={24} style={styles.lensBar}>
            <View style={styles.lensRow}>
              {LENSES.map((lens) => (
                <PressableScale
                  key={lens.label}
                  disabled={!lens.enabled}
                  accessibilityLabel={`${lens.label} lens${lens.enabled ? '' : ', not available yet'}`}
                  accessibilityState={{ disabled: !lens.enabled, selected: lens.enabled }}
                  haptic={false}
                  style={[
                    styles.lensPill,
                    lens.enabled && { backgroundColor: 'rgba(255,255,255,0.22)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.lensText,
                      { color: lens.enabled ? colors.primary : 'rgba(255,255,255,0.38)' },
                    ]}
                  >
                    {lens.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </Glass>
        </View>
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale
          accessibilityLabel="Back to recipes"
          onPress={() => router.navigate('/')}
          style={styles.roundHit}
        >
          <Glass forceDark radius={22} style={styles.roundGlass}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </Glass>
        </PressableScale>

        <Glass forceDark radius={16} style={styles.livePill}>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.liveText}>Live view</Text>
          </View>
        </Glass>

        <View style={styles.topRight}>
          <PressableScale
            testID="toggle-flash"
            accessibilityLabel={`Flash ${flash === 'off' ? 'off' : 'on'}`}
            onPress={() => setFlash((value) => (value === 'off' ? 'on' : 'off'))}
            style={styles.roundHit}
          >
            <Glass forceDark radius={22} style={styles.roundGlass}>
              <Feather
                name={flash === 'off' ? 'zap-off' : 'zap'}
                size={18}
                color={flash === 'off' ? '#fff' : colors.primary}
              />
            </Glass>
          </PressableScale>
          <PressableScale
            testID="toggle-grid"
            accessibilityLabel={showGrid ? 'Hide framing grid' : 'Show framing grid'}
            onPress={() => setShowGrid((value) => !value)}
            style={styles.roundHit}
          >
            <Glass forceDark radius={22} style={styles.roundGlass}>
              <Feather name="grid" size={18} color={showGrid ? colors.primary : '#fff'} />
            </Glass>
          </PressableScale>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
        {/* Recipe carousel: one swipe and tap to change the look. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {recipes.map((recipe) => {
            const selected = recipe.id === activeRecipeId;
            return (
              <PressableScale
                key={recipe.id}
                testID={`select-${recipe.id}`}
                accessibilityLabel={`${recipe.name}${selected ? ', selected' : ''}`}
                accessibilityState={{ selected }}
                haptic={Haptics.ImpactFeedbackStyle.Light}
                pressedScale={0.94}
                onPress={() => setActiveRecipeId(recipe.id)}
                style={[
                  styles.recipeChip,
                  selected
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: 'rgba(255,255,255,0.12)' },
                ]}
              >
                <View
                  style={[
                    styles.recipeSwatch,
                    {
                      backgroundColor: recipe.look.previewTint,
                      borderColor: selected ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.recipeChipText,
                    { color: selected ? colors.primaryForeground : '#fff' },
                  ]}
                  numberOfLines={1}
                >
                  {recipe.name}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        <View style={styles.shutterRow}>
          <PressableScale
            accessibilityLabel={`Open ${activeRecipe.name} details`}
            onPress={() =>
              router.push({ pathname: '/recipe/[id]', params: { id: activeRecipeId } })
            }
            style={styles.sideButton}
          >
            <Glass forceDark radius={28} style={styles.sideGlass}>
              <Feather name="sliders" size={22} color="#fff" />
            </Glass>
          </PressableScale>

          <PressableScale
            testID="take-photo"
            accessibilityLabel="Take photo"
            onPress={() => void takeShot()}
            disabled={!isReady || isCapturing}
            haptic={false}
            pressedScale={0.92}
            style={[
              styles.shutterOuter,
              { opacity: !isReady || isCapturing ? 0.55 : 1 },
            ]}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#111" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </PressableScale>

          <PressableScale
            testID="flip-camera"
            accessibilityLabel="Switch camera"
            onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
            style={styles.sideButton}
          >
            <Glass forceDark radius={28} style={styles.sideGlass}>
              <Feather name="refresh-cw" size={22} color="#fff" />
            </Glass>
          </PressableScale>
        </View>

        <Text style={styles.hint}>
          {progress
            ? `${progress.label}…  ${progress.percent}%`
            : 'Live view shows a tint · full recipe applied on capture'}
        </Text>
      </View>

      {!isReady && !isCapturing && (
        <View
          pointerEvents="none"
          style={[styles.loadingCamera, { top: previewTop, height: previewHeight }]}
        >
          <ActivityIndicator color="#fff" />
        </View>
      )}

      <Modal
        visible={!!capturedPhoto}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeReview}
      >
        {capturedPhoto && (
          <View style={styles.reviewScreen}>
            <StatusBar style="light" />
            <Image
              source={{ uri: showOriginal && originalUri ? originalUri : capturedPhoto.uri }}
              style={styles.reviewImage}
              resizeMode="contain"
            />
            <View style={[styles.reviewTop, { paddingTop: insets.top + 8 }]}>
              <PressableScale
                accessibilityLabel="Close photo preview"
                onPress={closeReview}
                style={styles.roundHit}
              >
                <Glass forceDark radius={22} style={styles.roundGlass}>
                  <Feather name="x" size={20} color="#fff" />
                </Glass>
              </PressableScale>
              <Glass forceDark radius={16} style={styles.livePill}>
                <Text style={styles.liveText}>{showOriginal ? 'Original' : 'Developed'}</Text>
              </Glass>
              {originalUri ? (
                <PressableScale
                  testID="compare-original"
                  accessibilityLabel="Hold to compare with the original"
                  haptic={false}
                  onPressIn={() => setShowOriginal(true)}
                  onPressOut={() => setShowOriginal(false)}
                  style={styles.roundHit}
                >
                  <Glass forceDark radius={22} style={styles.roundGlass}>
                    <Feather name="eye" size={19} color="#fff" />
                  </Glass>
                </PressableScale>
              ) : (
                <View style={styles.roundHit} />
              )}
            </View>
            <Glass
              forceDark
              radius={32}
              style={[styles.reviewBottom, { marginBottom: Math.max(insets.bottom, 12) + 8 }]}
            >
              <Text style={styles.reviewRecipe}>{activeRecipe.name}</Text>
              <Text style={styles.reviewCaption}>
                {capturedPhoto.width} × {capturedPhoto.height} · Hold the eye to compare
              </Text>
              <View style={styles.reviewActions}>
                <PressableScale
                  onPress={() => {
                    closeReview();
                    router.navigate('/gallery');
                  }}
                  style={styles.reviewSecondary}
                >
                  <Feather name="image" size={18} color="#fff" />
                  <Text style={styles.reviewSecondaryText}>Gallery</Text>
                </PressableScale>
                <PressableScale
                  testID="save-photo-to-phone"
                  onPress={() => void saveToPhone()}
                  disabled={isSavingToPhone}
                  style={[styles.reviewPrimary, { backgroundColor: colors.primary }]}
                >
                  {isSavingToPhone ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Feather name="download" size={18} color={colors.primaryForeground} />
                      <Text style={[styles.reviewPrimaryText, { color: colors.primaryForeground }]}>
                        Save to phone
                      </Text>
                    </>
                  )}
                </PressableScale>
              </View>
            </Glass>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  previewFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: '#0b0b0c',
    borderRadius: 28,
  },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.3)' },
  gridV: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  gridH: { left: 0, right: 0, height: StyleSheet.hairlineWidth },

  lensWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  lensBar: { padding: 4 },
  lensRow: { flexDirection: 'row', gap: 2 },
  lensPill: { minWidth: 52, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  lensText: { fontFamily: fonts.semibold, fontSize: 14, letterSpacing: -0.2 },

  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: { flexDirection: 'row' },
  roundHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  roundGlass: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  livePill: { height: 32, paddingHorizontal: 14, justifyContent: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff', letterSpacing: -0.1 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  carousel: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  recipeChip: {
    height: 48,
    borderRadius: 24,
    paddingLeft: 8,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth },
  recipeChipText: { fontFamily: fonts.semibold, fontSize: 14, letterSpacing: -0.2, maxWidth: 150 },

  shutterRow: {
    marginTop: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  sideGlass: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  hint: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 14,
  },
  loadingCamera: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  permissionPage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  permissionLens: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: { textAlign: 'center' },
  permissionCopy: { textAlign: 'center', marginTop: 8, maxWidth: 300 },
  permissionButton: {
    minWidth: 190,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    paddingHorizontal: 22,
    marginTop: 26,
  },
  permissionButtonText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },

  reviewScreen: { flex: 1, justifyContent: 'space-between', backgroundColor: '#000' },
  reviewImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  reviewTop: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewBottom: { marginHorizontal: 12, padding: 20 },
  reviewRecipe: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5, color: '#fff' },
  reviewCaption: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  reviewActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  reviewSecondary: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reviewSecondaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff', letterSpacing: -0.2 },
  reviewPrimary: {
    flex: 1.3,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reviewPrimaryText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
});
