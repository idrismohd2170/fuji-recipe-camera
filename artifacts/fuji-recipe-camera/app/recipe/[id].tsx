import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';
import { getRecipe } from '@/constants/recipes';
import { getRecipeImage } from '@/constants/recipe-images';
import { fonts, type } from '@/constants/typography';
import { lookValues, menuSettings, type SettingRow } from '@/lib/recipe-display';
import { useAppState } from '@/context/AppState';

function Group({ title, rows }: { title: string; rows: SettingRow[] }) {
  const colors = useColors();
  return (
    <View style={styles.group}>
      <Text style={[type.overline, styles.groupTitle, { color: colors.mutedForeground }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
        {rows.map((row, i) => (
          <View
            key={`${row.label}-${i}`}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
            ]}
          >
            <Text style={[type.callout, { color: colors.foreground }]}>{row.label}</Text>
            <Text
              style={[type.callout, styles.rowValue, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipe(String(id));
  const { isFavorite, toggleFavorite, setActiveRecipeId } = useAppState();
  const saved = isFavorite(recipe.id);

  const useInCamera = () => {
    setActiveRecipeId(recipe.id);
    router.dismissAll();
    router.navigate('/camera');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <ImageBackground source={getRecipeImage(recipe)} style={styles.hero}>
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', colors.background]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTop, { paddingTop: insets.top + 10 }]}>
            <PressableScale
              testID="close-recipe"
              accessibilityLabel="Close"
              onPress={() => router.back()}
              style={styles.roundHit}
            >
              <Glass forceDark radius={22} style={styles.roundGlass}>
                <Feather name="chevron-down" size={22} color="#fff" />
              </Glass>
            </PressableScale>
            <PressableScale
              testID={`favorite-${recipe.id}`}
              accessibilityLabel={saved ? 'Remove from saved recipes' : 'Save recipe'}
              haptic={Haptics.ImpactFeedbackStyle.Medium}
              onPress={() => toggleFavorite(recipe.id)}
              style={styles.roundHit}
            >
              <Glass forceDark radius={22} style={styles.roundGlass}>
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={20}
                  color={saved ? colors.primary : '#fff'}
                />
              </Glass>
            </PressableScale>
          </View>
        </ImageBackground>

        <View style={styles.body}>
          <Text style={[type.overline, { color: colors.primary }]}>
            {recipe.simulation.toUpperCase()}
          </Text>
          <Text style={[type.largeTitle, { color: colors.foreground, marginTop: 4 }]}>
            {recipe.name}
          </Text>
          <Text style={[type.body, { color: colors.mutedForeground, marginTop: 8 }]}>
            {recipe.description}
          </Text>

          <Group title="Camera settings" rows={menuSettings(recipe)} />
          <Group title="Look" rows={lookValues(recipe)} />
        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}
      >
        <PressableScale
          testID="use-recipe-in-camera"
          accessibilityLabel={`Shoot with ${recipe.name}`}
          haptic={Haptics.ImpactFeedbackStyle.Medium}
          pressedScale={0.97}
          onPress={useInCamera}
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Feather name="camera" size={19} color={colors.primaryForeground} />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Shoot with this recipe</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: 380, justifyContent: 'flex-start' },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  roundHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  roundGlass: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, marginTop: -28 },
  group: { marginTop: 28 },
  groupTitle: { marginLeft: 16, marginBottom: 8 },
  groupCard: { borderRadius: 22, overflow: 'hidden' },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  ctaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  cta: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3 },
});
