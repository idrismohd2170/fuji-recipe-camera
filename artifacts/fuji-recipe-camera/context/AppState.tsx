import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getRecipe, recipes } from '@/constants/recipes';

const FAVORITES_KEY = 'film-recipe-favorites-v1';
const PHOTOS_KEY = 'film-recipe-photos-v1';
const ACTIVE_RECIPE_KEY = 'film-recipe-active-v1';

export type SavedPhoto = {
  id: string;
  uri: string;
  recipeId: string;
  createdAt: string;
  width: number;
  height: number;
};

type AppStateValue = {
  activeRecipeId: string;
  activeRecipe: ReturnType<typeof getRecipe>;
  favorites: string[];
  photos: SavedPhoto[];
  isFavorite: (id: string) => boolean;
  setActiveRecipeId: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addPhoto: (photo: SavedPhoto) => void;
  removePhoto: (id: string) => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activeRecipeId, setActiveRecipeIdState] = useState(recipes[0].id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.multiGet([FAVORITES_KEY, PHOTOS_KEY, ACTIVE_RECIPE_KEY])
      .then(([favoriteEntry, photoEntry, recipeEntry]) => {
        if (!mounted) return;
        if (favoriteEntry[1]) {
          const parsed = JSON.parse(favoriteEntry[1]) as string[];
          setFavorites(Array.isArray(parsed) ? parsed : []);
        }
        if (photoEntry[1]) {
          const parsed = JSON.parse(photoEntry[1]) as SavedPhoto[];
          setPhotos(Array.isArray(parsed) ? parsed : []);
        }
        if (recipeEntry[1] && recipes.some((recipe) => recipe.id === recipeEntry[1])) {
          setActiveRecipeIdState(recipeEntry[1]);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.multiSet([
      [FAVORITES_KEY, JSON.stringify(favorites)],
      [PHOTOS_KEY, JSON.stringify(photos)],
      [ACTIVE_RECIPE_KEY, activeRecipeId],
    ]);
  }, [activeRecipeId, favorites, hydrated, photos]);

  const setActiveRecipeId = useCallback((id: string) => {
    if (recipes.some((recipe) => recipe.id === id)) setActiveRecipeIdState(id);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const addPhoto = useCallback((photo: SavedPhoto) => {
    setPhotos((current) => [photo, ...current]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      activeRecipeId,
      activeRecipe: getRecipe(activeRecipeId),
      favorites,
      photos,
      isFavorite: (id) => favorites.includes(id),
      setActiveRecipeId,
      toggleFavorite,
      addPhoto,
      removePhoto,
    }),
    [activeRecipeId, addPhoto, favorites, photos, removePhoto, setActiveRecipeId, toggleFavorite],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider.');
  return context;
}
