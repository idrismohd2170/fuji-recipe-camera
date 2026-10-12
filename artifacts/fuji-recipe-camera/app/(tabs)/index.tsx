import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { recipes } from '@/constants/recipes';
import { useAppState } from '@/context/AppState';

const recipeImages = [
  require('@/assets/images/recipe-coast.jpg'),
  require('@/assets/images/recipe-autumn.jpg'),
];

export default function RecipeLibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites, isFavorite, setActiveRecipeId, toggleFavorite } = useAppState();
  const [savedOnly, setSavedOnly] = useState(false);
  const featured = recipes[0];
  const visibleRecipes = useMemo(
    () => (savedOnly ? recipes.filter((recipe) => favorites.includes(recipe.id)) : recipes),
    [favorites, savedOnly],
  );

  const openCamera = (recipeId: string) => {
    setActiveRecipeId(recipeId);
    router.navigate('/camera');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'web' ? 67 : insets.top + 8,
            paddingBottom: Platform.OS === 'web' ? 104 : 26,
          },
        ]}
      >
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={[styles.brandMark, { borderColor: colors.primary }]}>
              <Feather name="aperture" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>FIELD NOTES</Text>
              <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>
                RECIPE CAMERA
              </Text>
            </View>
          </View>
          <Pressable
            testID="toggle-saved-recipes"
            accessibilityRole="button"
            accessibilityLabel={savedOnly ? 'Show all recipes' : 'Show saved recipes'}
            onPress={() => setSavedOnly((value) => !value)}
            style={[
              styles.savedToggle,
              { borderColor: savedOnly ? colors.primary : colors.border },
            ]}
          >
            <Feather
              name={savedOnly ? 'heart' : 'bookmark'}
              size={16}
              color={savedOnly ? colors.primary : colors.foreground}
            />
          </Pressable>
        </View>

        <View style={styles.headingBlock}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {savedOnly ? 'YOUR COLLECTION' : 'FILM, IN YOUR POCKET'}
          </Text>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            {savedOnly ? 'Saved recipes.' : 'Find your film.'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Fuji-inspired recipes, ready for the S24 Ultra.
          </Text>
        </View>

        {!savedOnly && (
          <View style={styles.featuredWrap}>
            <ImageBackground
              source={recipeImages[featured.image]}
              imageStyle={styles.featuredImage}
              style={styles.featured}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(16, 20, 17, 0.03)', 'rgba(16, 20, 17, 0.28)', 'rgba(16, 20, 17, 0.94)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.featuredTopRow}>
                <View style={styles.featuredLabel}>
                  <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.featuredLabelText}>RECIPE OF THE WEEK</Text>
                </View>
                <Pressable
                  testID={`favorite-${featured.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite(featured.id) ? 'Remove from saved recipes' : 'Save recipe'}
                  onPress={() => toggleFavorite(featured.id)}
                  style={styles.imageIconButton}
                >
                  <Feather
                    name={isFavorite(featured.id) ? 'heart' : 'heart'}
                    size={17}
                    color={isFavorite(featured.id) ? colors.primary : '#fff'}
                  />
                </Pressable>
              </View>
              <View style={styles.featuredDetails}>
                <Text style={styles.featuredSimulation}>{featured.simulation.toUpperCase()}</Text>
                <Text style={styles.featuredTitle}>{featured.name}</Text>
                <Text style={styles.featuredDescription}>{featured.description}</Text>
                <View style={styles.featuredBottomRow}>
                  <Text style={styles.featuredSettings}>{featured.settings[0]}  ·  WB Daylight</Text>
                  <Pressable
                    testID="use-featured-recipe"
                    accessibilityRole="button"
                    onPress={() => openCamera(featured.id)}
                    style={[styles.useButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.useButtonText, { color: colors.primaryForeground }]}>
                      Try recipe
                    </Text>
                    <Feather name="arrow-up-right" size={15} color={colors.primaryForeground} />
                  </Pressable>
                </View>
              </View>
            </ImageBackground>
          </View>
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {savedOnly ? 'Saved for later' : 'Recipe shelf'}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              {savedOnly ? `${visibleRecipes.length} saved` : 'Settings for your next frame'}
            </Text>
          </View>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {String(visibleRecipes.length).padStart(2, '0')}
          </Text>
        </View>

        {visibleRecipes.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="heart" size={23} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing saved yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              Tap the heart on a recipe to keep it here.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSavedOnly(false)}
              style={[styles.emptyAction, { backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.emptyActionText, { color: colors.foreground }]}>Browse recipes</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recipeList}>
            {visibleRecipes.map((recipe, index) => (
              <View
                key={recipe.id}
                style={[
                  styles.recipeCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  index === 0 && !savedOnly ? styles.firstRecipeCard : null,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${recipe.name}`}
                  testID={`open-recipe-${recipe.id}`}
                  onPress={() => openCamera(recipe.id)}
                  style={styles.recipeImagePressable}
                >
                  <Image source={recipeImages[recipe.image]} style={styles.recipeImage} />
                  <View style={[styles.recipeIndex, { backgroundColor: 'rgba(20,24,20,0.72)' }]}>
                    <Text style={styles.recipeIndexText}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.useIcon}>
                    <Feather name="arrow-up-right" size={17} color="#f2eee2" />
                  </View>
                </Pressable>
                <View style={styles.recipeInfo}>
                  <View style={styles.recipeTitleRow}>
                    <View style={styles.recipeTitleCopy}>
                      <Text style={[styles.recipeSimulation, { color: colors.accent }]}>
                        {recipe.simulation.toUpperCase()}
                      </Text>
                      <Text style={[styles.recipeName, { color: colors.foreground }]} numberOfLines={1}>
                        {recipe.name}
                      </Text>
                    </View>
                    <Pressable
                      testID={`favorite-${recipe.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={isFavorite(recipe.id) ? 'Remove from saved recipes' : 'Save recipe'}
                      onPress={() => toggleFavorite(recipe.id)}
                      style={styles.favoriteButton}
                    >
                      <Feather
                        name={isFavorite(recipe.id) ? 'heart' : 'heart'}
                        size={17}
                        color={isFavorite(recipe.id) ? colors.primary : colors.mutedForeground}
                      />
                    </Pressable>
                  </View>
                  <Text style={[styles.recipeDescription, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {recipe.description}
                  </Text>
                  <Text style={[styles.recipeSettings, { color: colors.foreground }]} numberOfLines={1}>
                    {recipe.settings.slice(0, 2).join('  ·  ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          Community-inspired settings. Not affiliated with or endorsed by FUJIFILM.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  brandCaption: { fontSize: 8, fontWeight: '600', letterSpacing: 2, marginTop: 3 },
  savedToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingBlock: { marginTop: 27, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  pageTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -1.4, marginTop: 4 },
  subtitle: { fontSize: 14, marginTop: 5 },
  featuredWrap: { borderRadius: 22, overflow: 'hidden', marginBottom: 25 },
  featured: { height: 370, justifyContent: 'space-between', padding: 17 },
  featuredImage: { borderRadius: 22 },
  featuredTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredLabel: {
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(20, 24, 20, 0.74)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  featuredLabelText: { color: '#f2eee2', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  imageIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 24, 20, 0.65)',
  },
  featuredDetails: { gap: 6 },
  featuredSimulation: { color: '#e3a984', fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
  featuredTitle: { color: '#fffaf0', fontSize: 29, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
  featuredDescription: { color: 'rgba(255, 250, 240, 0.82)', fontSize: 12, lineHeight: 18, maxWidth: 260 },
  featuredBottomRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  featuredSettings: { color: '#f2eee2', fontSize: 9, fontWeight: '600', flex: 1 },
  useButton: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 19,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  useButtonText: { fontSize: 11, fontWeight: '700' },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  sectionSubtitle: { marginTop: 3, fontSize: 11 },
  count: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  recipeList: { gap: 12 },
  recipeCard: {
    flexDirection: 'row',
    minHeight: 144,
    borderWidth: 1,
    borderRadius: 18,
    padding: 9,
    gap: 13,
  },
  firstRecipeCard: { marginTop: 0 },
  recipeImagePressable: { width: 106, minHeight: 126, borderRadius: 12, overflow: 'hidden' },
  recipeImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  recipeIndex: {
    position: 'absolute',
    top: 8,
    left: 8,
    minWidth: 25,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  recipeIndexText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  useIcon: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 24, 20, 0.7)',
  },
  recipeInfo: { flex: 1, justifyContent: 'center', paddingVertical: 5, paddingRight: 3 },
  recipeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recipeTitleCopy: { flex: 1 },
  recipeSimulation: { fontSize: 9, fontWeight: '700', letterSpacing: 1.15 },
  recipeName: { fontSize: 16, fontWeight: '700', marginTop: 3, letterSpacing: -0.2 },
  favoriteButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  recipeDescription: { fontSize: 10, lineHeight: 15, marginTop: 5 },
  recipeSettings: { fontSize: 9, fontWeight: '600', marginTop: 7 },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderRadius: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyCopy: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 230 },
  emptyAction: { borderRadius: 18, paddingHorizontal: 15, paddingVertical: 10, marginTop: 15 },
  emptyActionText: { fontSize: 11, fontWeight: '700' },
  disclaimer: { fontSize: 9, textAlign: 'center', lineHeight: 14, marginTop: 22, marginBottom: 2 },
});
