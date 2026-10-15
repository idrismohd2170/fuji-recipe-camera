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
  /** Small JPEG for the gallery grid. Missing on photos taken before thumbnails existed. */
  thumbUri?: string;
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
  removePhotos: (ids: string[]) => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [activeRecipeId, setActiveRecipeIdState] = useState(recipes[0].id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Each stored value is parsed on its own, so one corrupt entry can never
    // cause the others to be dropped (and then overwritten by the save effect).
    const parse = <T,>(raw: string | null): T | null => {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    };
    AsyncStorage.multiGet([FAVORITES_KEY, PHOTOS_KEY, ACTIVE_RECIPE_KEY])
      .then(([favoriteEntry, photoEntry, recipeEntry]) => {
        if (!mounted) return;
        const storedFavorites = parse<unknown>(favoriteEntry[1]);
        if (Array.isArray(storedFavorites)) {
          setFavorites(storedFavorites.filter((id): id is string => typeof id === 'string'));
        }
        const storedPhotos = parse<unknown>(photoEntry[1]);
        if (Array.isArray(storedPhotos)) {
          const valid = storedPhotos.filter(
            (photo): photo is SavedPhoto =>
              !!photo &&
              typeof photo === 'object' &&
              typeof (photo as SavedPhoto).id === 'string' &&
              typeof (photo as SavedPhoto).uri === 'string' &&
              typeof (photo as SavedPhoto).recipeId === 'string',
          );
          // Merge, so a photo added before loading finished is not lost.
          setPhotos((current) => [
            ...current,
            ...valid.filter((photo) => !current.some((item) => item.id === photo.id)),
          ]);
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

  const removePhotos = useCallback((ids: string[]) => {
    const drop = new Set(ids);
    setPhotos((current) => current.filter((photo) => !drop.has(photo.id)));
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
      removePhotos,
    }),
    [
      activeRecipeId,
      addPhoto,
      favorites,
      photos,
      removePhoto,
      removePhotos,
      setActiveRecipeId,
      toggleFavorite,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider.');
  return context;
}
