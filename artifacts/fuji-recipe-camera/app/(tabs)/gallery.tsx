import React, { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';
import { getRecipe } from '@/constants/recipes';
import { fonts, type } from '@/constants/typography';
import { useAppState, type SavedPhoto } from '@/context/AppState';

const COLUMNS = 3;
const GAP = 2;
/** Space reserved so the grid clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 104;

export default function GalleryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { photos, removePhoto } = useAppState();
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const saveBusy = useRef(false);
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const saveToPhone = async () => {
    if (!selectedPhoto || saving || saveBusy.current) return;
    saveBusy.current = true;
    setSaving(true);
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Use your phone', 'Saving to the phone gallery is available in the Android app.');
        return;
      }
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
      await mediaLibrary.Asset.create(selectedPhoto.uri);
      Alert.alert('Saved to your gallery', 'The recipe-look photo is now in your phone gallery.');
    } catch (error) {
      Alert.alert(
        'Could not save photo',
        error instanceof Error ? error.message : 'Try saving again.',
      );
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = (photo: SavedPhoto) => {
    Alert.alert('Remove this photo?', 'It will be removed from this app’s gallery.', [
      { text: 'Keep photo', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await FileSystem.deleteAsync(photo.uri, { idempotent: true });
            } finally {
              removePhoto(photo.id);
              setSelectedPhoto(null);
            }
          })();
        },
      },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <Text style={[type.largeTitle, { color: colors.foreground }]}>Gallery</Text>
      <Text style={[type.subhead, { color: colors.mutedForeground, marginTop: 4 }]}>
        {photos.length === 0
          ? 'Recipe-graded photos appear here.'
          : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · stored on this device`}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={photos}
        keyExtractor={(photo) => photo.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
              <Feather name="image" size={30} color={colors.primary} />
            </View>
            <Text style={[type.title3, { color: colors.foreground, marginTop: 18 }]}>
              No photos yet
            </Text>
            <Text style={[type.callout, styles.emptyCopy, { color: colors.mutedForeground }]}>
              Shoot with a film recipe and your frames will show up here.
            </Text>
            <PressableScale
              testID="open-camera-from-gallery"
              onPress={() => router.navigate('/camera')}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            >
              <Feather name="camera" size={18} color={colors.primaryForeground} />
              <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>
                Open camera
              </Text>
            </PressableScale>
          </View>
        }
        renderItem={({ item: photo }) => {
          const recipe = getRecipe(photo.recipeId);
          return (
            <PressableScale
              testID={`open-photo-${photo.id}`}
              accessibilityLabel={`View photo made with ${recipe.name}`}
              haptic={Haptics.ImpactFeedbackStyle.Light}
              pressedScale={0.97}
              onPress={() => setSelectedPhoto(photo)}
              style={{ width: tile, height: tile, backgroundColor: colors.card }}
            >
              <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: photo.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  recyclingKey={photo.id}
                  transition={120}
                />
              </Animated.View>
            </PressableScale>
          );
        }}
      />

      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSelectedPhoto(null)}
      >
        {selectedPhoto && (
          <View style={styles.viewer}>
            <StatusBar style="light" />
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
            <View style={[styles.viewerTop, { paddingTop: insets.top + 8 }]}>
              <PressableScale
                accessibilityLabel="Close photo"
                onPress={() => setSelectedPhoto(null)}
                style={styles.roundHit}
              >
                <Glass forceDark radius={22} style={styles.roundGlass}>
                  <Feather name="x" size={20} color="#fff" />
                </Glass>
              </PressableScale>
              <Glass forceDark radius={16} style={styles.recipePill}>
                <Text style={styles.recipePillText}>{getRecipe(selectedPhoto.recipeId).name}</Text>
              </Glass>
              <View style={styles.roundHit} />
            </View>
            <Glass
              forceDark
              radius={32}
              style={[styles.viewerBottom, { marginBottom: Math.max(insets.bottom, 12) + 8 }]}
            >
              <Text style={styles.viewerMeta}>
                {selectedPhoto.width} × {selectedPhoto.height} ·{' '}
                {new Date(selectedPhoto.createdAt).toLocaleString()}
              </Text>
              <View style={styles.viewerActions}>
                <PressableScale
                  testID="remove-gallery-photo"
                  haptic={Haptics.ImpactFeedbackStyle.Medium}
                  onPress={() => confirmDelete(selectedPhoto)}
                  style={styles.removeButton}
                >
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                  <Text style={[styles.removeText, { color: colors.destructive }]}>Remove</Text>
                </PressableScale>
                <PressableScale
                  testID="save-gallery-photo-to-phone"
                  onPress={() => void saveToPhone()}
                  disabled={saving}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                >
                  <Feather name="download" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
                    Save to phone
                  </Text>
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
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 80 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { textAlign: 'center', marginTop: 6, maxWidth: 280 },
  emptyButton: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 24,
  },
  emptyButtonText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },

  viewer: { flex: 1, justifyContent: 'space-between', backgroundColor: '#000' },
  viewerTop: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  roundGlass: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  recipePill: { height: 32, paddingHorizontal: 14, justifyContent: 'center' },
  recipePillText: { fontFamily: fonts.semibold, fontSize: 13, color: '#fff', letterSpacing: -0.1 },
  viewerBottom: { marginHorizontal: 12, padding: 20 },
  viewerMeta: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  viewerActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  removeButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  removeText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
  saveButton: {
    flex: 1.3,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
});
