import type { ImageSourcePropType } from 'react-native';
import type { FilmRecipe } from '@/constants/recipes';

/** Cover images, indexed by `FilmRecipe.image`. */
const recipeImages: ImageSourcePropType[] = [
  require('@/assets/images/recipe-coast.jpg'),
  require('@/assets/images/recipe-autumn.jpg'),
];

export function getRecipeImage(recipe: FilmRecipe): ImageSourcePropType {
  return recipeImages[recipe.image] ?? recipeImages[0];
}
