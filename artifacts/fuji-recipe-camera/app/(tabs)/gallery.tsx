import React, { useState } from 'react';
import {
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
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getRecipe } from '@/constants/recipes';
import { useAppState, type SavedPhoto } from '@/context/AppState';

export default function GalleryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { photos, removePhoto } = useAppState();
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
  const [saving, setSaving] = useState(false);

  const saveToPhone = async () => {
    if (!selectedPhoto || saving) return;
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Platform.OS === 'web' ? 67 : insets.top + 9,
          paddingBottom: Platform.OS === 'web' ? 104 : Math.max(insets.bottom, 16) + 14,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR CAMERA ROLL</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Developed.</Text>
          </View>
          <View style={[styles.totalBadge, { borderColor: colors.border }]}>
            <Text style={[styles.totalText, { color: colors.foreground }]}>
              {String(photos.length).padStart(2, '0')}
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Recipe-graded photos saved on this device.
        </Text>

        {photos.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="aperture" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your frames go here</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              Take a photo with a film recipe and it will appear in this private, on-device gallery.
            </Text>
            <Pressable
              testID="open-camera-from-gallery"
              accessibilityRole="button"
              onPress={() => router.navigate('/camera')}
              style={[styles.captureButton, { backgroundColor: colors.primary }]}
            >
              <Feather name="camera" size={15} color={colors.primaryForeground} />
              <Text style={[styles.captureText, { color: colors.primaryForeground }]}>
                Open camera
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => {
              const recipe = getRecipe(photo.recipeId);
              return (
                <Pressable
                  key={photo.id}
                  testID={`open-photo-${photo.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo made with ${recipe.name}`}
                  onPress={() => setSelectedPhoto(photo)}
                  style={[
                    styles.photoTile,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    index % 2 === 1 ? styles.secondTile : null,
                  ]}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <View style={styles.photoCaption}>
                    <Text style={styles.photoRecipe} numberOfLines={1}>{recipe.name}</Text>
                    <Text style={styles.photoDate}>
                      {new Date(photo.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.privateNote}>
          <Feather name="lock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.privateCopy, { color: colors.mutedForeground }]}>
            Stored on this device until you remove them.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        {selectedPhoto && (
          <View style={[styles.detailScreen, { backgroundColor: colors.background }]}>
            <Image source={{ uri: selectedPhoto.uri }} style={styles.detailImage} resizeMode="contain" />
            <View style={[styles.detailTop, { paddingTop: insets.top + 8 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close photo"
                onPress={() => setSelectedPhoto(null)}
                style={styles.detailIcon}
              >
                <Feather name="x" size={19} color="#fff" />
              </Pressable>
              <Text style={styles.detailTopTitle}>YOUR FRAME</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={[styles.detailBottom, { paddingBottom: Math.max(insets.bottom, 18) + 16 }]}>
              <Text style={[styles.detailRecipe, { color: colors.primary }]}>
                {getRecipe(selectedPhoto.recipeId).name.toUpperCase()}
              </Text>
              <Text style={styles.detailMeta}>
                {selectedPhoto.width} × {selectedPhoto.height} ·{' '}
                {new Date(selectedPhoto.createdAt).toLocaleString()}
              </Text>
              <View style={styles.detailActions}>
                <Pressable
                  testID="remove-gallery-photo"
                  accessibilityRole="button"
                  onPress={() => confirmDelete(selectedPhoto)}
                  style={styles.removeButton}
                >
                  <Feather name="trash-2" size={16} color="#fff" />
                  <Text style={styles.actionText}>Remove</Text>
                </Pressable>
                <Pressable
                  testID="save-gallery-photo-to-phone"
                  accessibilityRole="button"
                  onPress={() => void saveToPhone()}
                  disabled={saving}
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                >
                  <Feather name="download" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
                    Save to phone
                  </Text>
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
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1.2, marginTop: 4 },
  totalBadge: {
    minWidth: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalText: { fontSize: 12, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 5, marginBottom: 22 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    paddingHorizontal: 23,
    paddingVertical: 30,
    marginTop: 8,
  },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyCopy: { fontSize: 12, lineHeight: 19, maxWidth: 255, textAlign: 'center', marginTop: 6 },
  captureButton: {
    borderRadius: 21,
    paddingVertical: 12,
    paddingHorizontal: 17,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    marginTop: 18,
  },
  captureText: { fontSize: 12, fontWeight: '700' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoTile: { width: '48.5%', borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  secondTile: {},
  photoImage: { width: '100%', aspectRatio: 0.77, backgroundColor: '#252923' },
  photoCaption: { paddingHorizontal: 9, paddingVertical: 9 },
  photoRecipe: { color: '#f2eee2', fontSize: 11, fontWeight: '700' },
  photoDate: { color: '#b5b3a8', fontSize: 9, marginTop: 4 },
  privateNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  privateCopy: { fontSize: 10 },
  detailScreen: { flex: 1, justifyContent: 'space-between' },
  detailImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined, backgroundColor: '#121512' },
  detailTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,17,14,0.58)',
  },
  detailTopTitle: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1.6 },
  detailBottom: { paddingHorizontal: 20, paddingTop: 40, backgroundColor: 'rgba(15,18,15,0.8)' },
  detailRecipe: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  detailMeta: { color: '#f2eee2', fontSize: 11, marginTop: 6 },
  detailActions: { flexDirection: 'row', gap: 9, marginTop: 17 },
  removeButton: {
    flex: 1,
    height: 47,
    borderRadius: 24,
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  saveButton: {
    flex: 1,
    height: 47,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  saveText: { fontSize: 11, fontWeight: '700' },
});
