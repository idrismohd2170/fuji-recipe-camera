import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
import { ALBUM_NAME, reportSaveResult, savePhotosToAlbum, sharePhoto } from '@/lib/photo-export';
import { deletePhotoFiles } from '@/lib/photo-store';

const COLUMNS = 3;
const GAP = 2;
/** Space reserved so the grid clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 104;
/** Extra space at the bottom while the selection bar is showing. */
const SELECTION_BAR_CLEARANCE = 96;

type TileProps = {
  photo: SavedPhoto;
  size: number;
  selecting: boolean;
  selected: boolean;
  onOpen: (photo: SavedPhoto) => void;
  onToggle: (photo: SavedPhoto) => void;
  onLongPress: (photo: SavedPhoto) => void;
  cardColor: string;
  accentColor: string;
  accentForeground: string;
};

/**
 * One grid cell. Memoised so selecting a photo or opening the viewer re-renders only
 * the cells whose props actually changed, not the whole grid.
 */
const PhotoTile = memo(function PhotoTile({
  photo,
  size,
  selecting,
  selected,
  onOpen,
  onToggle,
  onLongPress,
  cardColor,
  accentColor,
  accentForeground,
}: TileProps) {
  const recipeName = getRecipe(photo.recipeId).name;
  return (
    <PressableScale
      testID={`open-photo-${photo.id}`}
      accessibilityLabel={`${selecting ? (selected ? 'Deselect' : 'Select') : 'View'} photo made with ${recipeName}`}
      accessibilityState={{ selected: selecting ? selected : undefined }}
      haptic={Haptics.ImpactFeedbackStyle.Light}
      pressedScale={0.97}
      onPress={() => (selecting ? onToggle(photo) : onOpen(photo))}
      onLongPress={() => onLongPress(photo)}
      delayLongPress={320}
      style={{ width: size, height: size, backgroundColor: cardColor }}
    >
      <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: photo.thumbUri ?? photo.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={120}
        />
      </Animated.View>
      {selecting && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, selected && styles.tileDim]}
        >
          <View
            style={[
              styles.check,
              selected
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : styles.checkEmpty,
            ]}
          >
            {selected && <Feather name="check" size={15} color={accentForeground} />}
          </View>
        </View>
      )}
    </PressableScale>
  );
});

export default function GalleryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { photos, removePhotos } = useAppState();
  const [openPhoto, setOpenPhoto] = useState<SavedPhoto | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const saveBusy = useRef(false);
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedSet.has(photo.id)),
    [photos, selectedSet],
  );

  const endSelecting = useCallback(() => {
    setSelecting(false);
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback((photo: SavedPhoto) => {
    setSelectedIds((current) =>
      current.includes(photo.id) ? current.filter((id) => id !== photo.id) : [...current, photo.id],
    );
  }, []);

  const startSelecting = useCallback((photo: SavedPhoto) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelecting(true);
    setSelectedIds((current) => (current.includes(photo.id) ? current : [...current, photo.id]));
  }, []);

  // Photos can disappear (removed in the viewer or in bulk); drop stale selected ids.
  const liveSelectedIds = useMemo(
    () => selectedIds.filter((id) => photos.some((photo) => photo.id === id)),
    [photos, selectedIds],
  );

  const saveToAlbum = async (targets: SavedPhoto[], afterSuccess?: () => void) => {
    if (targets.length === 0 || saving || saveBusy.current) return;
    saveBusy.current = true;
    setSaving(true);
    try {
      const result = await savePhotosToAlbum(targets.map((photo) => photo.uri));
      reportSaveResult(result);
      if (result.ok) afterSuccess?.();
    } finally {
      saveBusy.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = (targets: SavedPhoto[], afterDelete?: () => void) => {
    if (targets.length === 0) return;
    const many = targets.length > 1;
    Alert.alert(
      many ? `Remove ${targets.length} photos?` : 'Remove this photo?',
      'They will be removed from this app’s gallery. Copies saved to your phone gallery stay there.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await Promise.all(targets.map((photo) => deletePhotoFiles(photo)));
              } finally {
                removePhotos(targets.map((photo) => photo.id));
                afterDelete?.();
              }
            })();
          },
        },
      ],
    );
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[type.largeTitle, { color: colors.foreground }]}>Gallery</Text>
        <Text style={[type.subhead, { color: colors.mutedForeground, marginTop: 4 }]}>
          {selecting
            ? liveSelectedIds.length === 0
              ? 'Tap photos to select'
              : `${liveSelectedIds.length} selected`
            : photos.length === 0
              ? 'Recipe-graded photos appear here.'
              : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · stored on this device`}
        </Text>
      </View>
      {photos.length > 0 && (
        <PressableScale
          testID="toggle-select-mode"
          accessibilityLabel={selecting ? 'Done selecting' : 'Select photos'}
          onPress={() => (selecting ? endSelecting() : setSelecting(true))}
          style={[styles.selectButton, { backgroundColor: colors.card }]}
        >
          <Text style={[styles.selectText, { color: colors.primary }]}>
            {selecting ? 'Done' : 'Select'}
          </Text>
        </PressableScale>
      )}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedPhoto }) => (
      <PhotoTile
        photo={item}
        size={tile}
        selecting={selecting}
        selected={selectedSet.has(item.id)}
        onOpen={setOpenPhoto}
        onToggle={toggleSelected}
        onLongPress={startSelecting}
        cardColor={colors.card}
        accentColor={colors.primary}
        accentForeground={colors.primaryForeground}
      />
    ),
    [
      colors.card,
      colors.primary,
      colors.primaryForeground,
      selecting,
      selectedSet,
      startSelecting,
      tile,
      toggleSelected,
    ],
  );

  const separator = useCallback(() => <View style={{ height: GAP }} />, []);
  const hasSelection = liveSelectedIds.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={photos}
        extraData={selectedSet}
        keyExtractor={(photo) => photo.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={separator}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom:
            insets.bottom + TAB_BAR_CLEARANCE + (selecting ? SELECTION_BAR_CLEARANCE : 0),
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
        renderItem={renderItem}
      />

      {selecting && (
        <Glass
          radius={32}
          style={[styles.selectionBar, { bottom: insets.bottom + TAB_BAR_CLEARANCE - 8 }]}
        >
          <View style={styles.selectionRow}>
            <PressableScale
              testID="selection-share"
              accessibilityLabel="Share selected photo"
              disabled={liveSelectedIds.length !== 1}
              onPress={() => {
                const only = selectedPhotos[0];
                if (only) void sharePhoto(only.uri);
              }}
              style={[styles.selectionAction, liveSelectedIds.length !== 1 && styles.dimmed]}
            >
              <Feather name="share" size={19} color={colors.foreground} />
              <Text style={[styles.selectionText, { color: colors.foreground }]}>Share</Text>
            </PressableScale>
            <PressableScale
              testID="selection-save"
              accessibilityLabel={`Save selected photos to the ${ALBUM_NAME} album`}
              disabled={!hasSelection || saving}
              onPress={() => void saveToAlbum(selectedPhotos, endSelecting)}
              style={[styles.selectionAction, (!hasSelection || saving) && styles.dimmed]}
            >
              <Feather name="download" size={19} color={colors.foreground} />
              <Text style={[styles.selectionText, { color: colors.foreground }]}>Save</Text>
            </PressableScale>
            <PressableScale
              testID="selection-remove"
              accessibilityLabel="Remove selected photos"
              disabled={!hasSelection}
              onPress={() => confirmDelete(selectedPhotos, endSelecting)}
              style={[styles.selectionAction, !hasSelection && styles.dimmed]}
            >
              <Feather name="trash-2" size={19} color={colors.destructive} />
              <Text style={[styles.selectionText, { color: colors.destructive }]}>Remove</Text>
            </PressableScale>
          </View>
        </Glass>
      )}

      <Modal
        visible={!!openPhoto}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpenPhoto(null)}
      >
        {openPhoto && (
          <View style={styles.viewer}>
            <StatusBar style="light" />
            <Image
              source={{ uri: openPhoto.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
            <View style={[styles.viewerTop, { paddingTop: insets.top + 8 }]}>
              <PressableScale
                accessibilityLabel="Close photo"
                onPress={() => setOpenPhoto(null)}
                style={styles.roundHit}
              >
                <Glass forceDark radius={22} style={styles.roundGlass}>
                  <Feather name="x" size={20} color="#fff" />
                </Glass>
              </PressableScale>
              <Glass forceDark radius={16} style={styles.recipePill}>
                <Text style={styles.recipePillText}>{getRecipe(openPhoto.recipeId).name}</Text>
              </Glass>
              <PressableScale
                testID="share-gallery-photo"
                accessibilityLabel="Share photo"
                onPress={() => void sharePhoto(openPhoto.uri)}
                style={styles.roundHit}
              >
                <Glass forceDark radius={22} style={styles.roundGlass}>
                  <Feather name="share" size={19} color="#fff" />
                </Glass>
              </PressableScale>
            </View>
            <Glass
              forceDark
              radius={32}
              style={[styles.viewerBottom, { marginBottom: Math.max(insets.bottom, 12) + 8 }]}
            >
              <Text style={styles.viewerMeta}>
                {openPhoto.width} × {openPhoto.height} ·{' '}
                {new Date(openPhoto.createdAt).toLocaleString()}
              </Text>
              <View style={styles.viewerActions}>
                <PressableScale
                  testID="remove-gallery-photo"
                  haptic={Haptics.ImpactFeedbackStyle.Medium}
                  onPress={() => confirmDelete([openPhoto], () => setOpenPhoto(null))}
                  style={styles.removeButton}
                >
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                  <Text style={[styles.removeText, { color: colors.destructive }]}>Remove</Text>
                </PressableScale>
                <PressableScale
                  testID="save-gallery-photo-to-phone"
                  onPress={() => void saveToAlbum([openPhoto])}
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
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: { flexShrink: 1 },
  selectButton: {
    minWidth: 84,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
  tileDim: { backgroundColor: 'rgba(0,0,0,0.32)' },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmpty: { borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.25)' },
  selectionBar: { position: 'absolute', left: 12, right: 12, padding: 6 },
  selectionRow: { flexDirection: 'row' },
  selectionAction: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  selectionText: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.2 },
  dimmed: { opacity: 0.4 },
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
