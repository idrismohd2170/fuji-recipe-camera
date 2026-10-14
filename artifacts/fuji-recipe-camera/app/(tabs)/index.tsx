import React, { useMemo, useState } from 'react';
import { Image, ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';
import { recipes, type FilmRecipe } from '@/constants/recipes';
import { getRecipeImage } from '@/constants/recipe-images';
import { fonts, type } from '@/constants/typography';
import { useAppState } from '@/context/AppState';

/** Space reserved so content clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 104;

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const colors = useColors();
  const width = useSharedValue(0);
  const index = options.findIndex((option) => option.key === value);
  const x = useSharedValue(0);

  const thumb = useAnimatedStyle(() => ({
    width: width.value / options.length,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width - 4;
        x.value = (index * (event.nativeEvent.layout.width - 4)) / options.length;
      }}
      style={[styles.segmented, { backgroundColor: colors.muted }]}
    >
      <Animated.View style={[styles.segmentThumb, { backgroundColor: colors.card }, thumb]} />
      {options.map((option, i) => (
        <PressableScale
          key={option.key}
          testID={`segment-${option.key}`}
          accessibilityState={{ selected: option.key === value }}
          haptic={Haptics.ImpactFeedbackStyle.Light}
          pressedScale={0.97}
          onPress={() => {
            x.value = withSpring((i * width.value) / options.length, {
              damping: 20,
              stiffness: 320,
            });
            onChange(option.key);
          }}
          style={styles.segment}
        >
          <Text
            style={[
              styles.segmentText,
              { color: option.key === value ? colors.foreground : colors.mutedForeground },
            ]}
          >
            {option.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

function HeartButton({
  recipe,
  tint,
  glass = false,
}: {
  recipe: FilmRecipe;
  tint?: string;
  glass?: boolean;
}) {
  const colors = useColors();
  const { isFavorite, toggleFavorite } = useAppState();
  const saved = isFavorite(recipe.id);
  const icon = (
    <Ionicons
      name={saved ? 'heart' : 'heart-outline'}
      size={20}
      color={saved ? colors.primary : (tint ?? colors.mutedForeground)}
    />
  );
  return (
    <PressableScale
      testID={`favorite-${recipe.id}`}
      accessibilityLabel={saved ? 'Remove from saved recipes' : 'Save recipe'}
      pressedScale={0.85}
      haptic={Haptics.ImpactFeedbackStyle.Medium}
      onPress={() => toggleFavorite(recipe.id)}
      style={styles.heartHit}
    >
      {glass ? (
        <Glass forceDark radius={22} style={styles.heartGlass}>
          {icon}
        </Glass>
      ) : (
        icon
      )}
    </PressableScale>
  );
}

export default function RecipeLibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites } = useAppState();
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const savedOnly = filter === 'saved';
  const featured = recipes[0];
  const visibleRecipes = useMemo(
    () => (savedOnly ? recipes.filter((recipe) => favorites.includes(recipe.id)) : recipes),
    [favorites, savedOnly],
  );

  const openRecipe = (id: string) => router.push({ pathname: '/recipe/[id]', params: { id } });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
          paddingHorizontal: 20,
        }}
      >
        <Text style={[type.largeTitle, { color: colors.foreground }]}>Recipes</Text>
        <Text style={[type.subhead, styles.subtitle, { color: colors.mutedForeground }]}>
          Film simulation recipes for your S24 Ultra.
        </Text>

        <View style={styles.segmentWrap}>
          <Segmented
            options={[
              { key: 'all', label: 'All' },
              { key: 'saved', label: 'Saved' },
            ]}
            value={filter}
            onChange={(key) => setFilter(key as 'all' | 'saved')}
          />
        </View>

        {!savedOnly && (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <PressableScale
              testID="open-featured-recipe"
              accessibilityLabel={`Open ${featured.name}`}
              pressedScale={0.985}
              onPress={() => openRecipe(featured.id)}
              style={styles.featuredWrap}
            >
              <ImageBackground
                source={getRecipeImage(featured)}
                style={styles.featured}
                imageStyle={styles.featuredImage}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.82)']}
                  locations={[0.2, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.featuredTop}>
                  <Glass forceDark radius={15} style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>RECIPE OF THE WEEK</Text>
                  </Glass>
                  <HeartButton recipe={featured} tint="#fff" glass />
                </View>
                <View style={styles.featuredBody}>
                  <Text style={styles.featuredSim}>{featured.simulation}</Text>
                  <Text style={styles.featuredTitle}>{featured.name}</Text>
                  <Text style={styles.featuredDescription} numberOfLines={2}>
                    {featured.description}
                  </Text>
                </View>
              </ImageBackground>
            </PressableScale>
          </Animated.View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[type.title2, { color: colors.foreground }]}>
            {savedOnly ? 'Saved' : 'All recipes'}
          </Text>
          <Text style={[type.subhead, { color: colors.mutedForeground }]}>
            {visibleRecipes.length}
          </Text>
        </View>

        {visibleRecipes.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card }]}>
            <Ionicons name="heart-outline" size={30} color={colors.primary} />
            <Text style={[type.headline, styles.emptyTitle, { color: colors.foreground }]}>
              Nothing saved yet
            </Text>
            <Text style={[type.footnote, styles.emptyCopy, { color: colors.mutedForeground }]}>
              Tap the heart on a recipe to keep it here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleRecipes.map((recipe, i) => (
              <Animated.View
                key={recipe.id}
                entering={FadeInDown.delay(60 + i * 45).springify().damping(18)}
              >
                <PressableScale
                  testID={`open-recipe-${recipe.id}`}
                  accessibilityLabel={`Open ${recipe.name}`}
                  pressedScale={0.98}
                  onPress={() => openRecipe(recipe.id)}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Image source={getRecipeImage(recipe)} style={styles.cardImage} />
                  <View style={styles.cardBody}>
                    <Text
                      style={[type.overline, { color: colors.primary }]}
                      numberOfLines={1}
                    >
                      {recipe.simulation.toUpperCase()}
                    </Text>
                    <Text
                      style={[type.headline, { color: colors.foreground, marginTop: 2 }]}
                      numberOfLines={1}
                    >
                      {recipe.name}
                    </Text>
                    <Text
                      style={[type.footnote, { color: colors.mutedForeground, marginTop: 3 }]}
                      numberOfLines={2}
                    >
                      {recipe.description}
                    </Text>
                    <View style={styles.chips}>
                      {recipe.settings.slice(0, 2).map((setting) => (
                        <View
                          key={setting}
                          style={[styles.chip, { backgroundColor: colors.muted }]}
                        >
                          <Text
                            style={[styles.chipText, { color: colors.mutedForeground }]}
                            numberOfLines={1}
                          >
                            {setting}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <HeartButton recipe={recipe} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}

        <Text style={[type.caption, styles.disclaimer, { color: colors.mutedForeground }]}>
          Community-inspired settings. Not affiliated with or endorsed by FUJIFILM.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  subtitle: { marginTop: 4 },
  segmentWrap: { marginTop: 18, marginBottom: 20 },
  segmented: {
    height: 40,
    borderRadius: 14,
    padding: 2,
    flexDirection: 'row',
  },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    borderRadius: 12,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: fonts.semibold, fontSize: 14, letterSpacing: -0.15 },

  featuredWrap: { borderRadius: 28, overflow: 'hidden' },
  featured: { height: 400, justifyContent: 'space-between', padding: 16 },
  featuredImage: { borderRadius: 28 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredBadge: { height: 30, paddingHorizontal: 12, justifyContent: 'center' },
  featuredBadgeText: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, color: '#fff' },
  featuredBody: { gap: 4, paddingHorizontal: 4, paddingBottom: 4 },
  featuredSim: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.2, color: '#ffb86b' },
  featuredTitle: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.9, color: '#fff' },
  featuredDescription: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,0.8)' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 14,
  },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    paddingRight: 6,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardImage: { width: 96, height: 112, borderRadius: 16 },
  cardBody: { flex: 1, justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 6, marginTop: 9, flexWrap: 'nowrap' },
  chip: { borderRadius: 10, paddingHorizontal: 8, height: 22, justifyContent: 'center', flexShrink: 1 },
  chipText: { fontFamily: fonts.medium, fontSize: 11 },

  heartHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  heartGlass: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', padding: 32, borderRadius: 24 },
  emptyTitle: { marginTop: 12 },
  emptyCopy: { textAlign: 'center', marginTop: 4, maxWidth: 240 },
  disclaimer: { textAlign: 'center', marginTop: 28 },
});
