# NOTES: handoff file for the next Claude session

Read this first. Update it at the end of every session. App lives in `artifacts/fuji-recipe-camera` (Expo). Ignore `artifacts/api-server`, `artifacts/mockup-sandbox` and `lib/*`; the app does not use them.

## Project goal

A Fujifilm X Weekly-style film recipe app with live camera view, for **one user on one device: a Samsung Galaxy S24 Ultra**, used locally (no store release, no iOS/web support needed). Browse recipes, pick one, shoot with it, keep the photos.

Visual direction: modern, Apple-like (true-black OLED dark theme, glass surfaces, large type, spring motion).

## Current state

### Done (session 1: UI only)
- New design system: `constants/colors.ts` (true-black dark + iOS-style light, same tokens), `constants/typography.ts` (Inter-based type scale; Android needs a family per weight), `hooks/useColors.ts` (dark default).
- Shared components: `components/Glass.tsx` (blur + tint + hairline edge), `components/PressableScale.tsx` (reanimated spring press + haptic, UI thread).
- Floating glass tab bar (`app/(tabs)/_layout.tsx`), hidden on the Camera tab.
- Recipes screen (`app/(tabs)/index.tsx`): large title, All/Saved segmented control, featured card, recipe cards, heart to save.
- Recipe detail (`app/recipe/[id].tsx`, modal route): hero image, "Camera settings" table, "Look" values table, "Shoot with this recipe" button. Row labels come from `lib/recipe-display.ts`.
- Camera screen (`app/(tabs)/camera.tsx`): same capture logic as before, new UI: 4:3 viewfinder, glass top bar (back, live pill, flash, grid), lens pills, horizontal recipe carousel, shutter row, restyled review screen with hold-to-compare.
- Gallery (`app/(tabs)/gallery.tsx`): 3-column edge-to-edge grid (FlatList + expo-image), full-screen viewer with remove / save to phone.
- Local run: `dev` script no longer needs `REPLIT_*` env vars; added `start` and `android` scripts; `app.json` now has `userInterfaceStyle: automatic` and `android.package`.

### Not done
- Lens pills are **UI only** (only 1× enabled). No lens switching or zoom yet.
- Live view shows only a colour tint (`look.previewTint`); the full recipe is applied after capture by `lib/film-look.ts` / `lib/film-grade.ts` (unchanged this session).
- Nothing has been run on a device. Only checks done: `pnpm --filter @workspace/fuji-recipe-camera run typecheck` (0 errors) and `npx expo export --platform android` (bundles successfully).
- Light mode is styled but only checked by reading the code, never seen on screen.

## Decisions locked
- Stack unchanged: Expo ~57, React Native 0.86, expo-router, reanimated 4, expo-camera, expo-blur.
- Data shape of `constants/recipes.ts` and exports of `lib/film-look.ts` / `lib/film-grade.ts` are untouched. Keep them unless a reason is recorded here.
- Viewfinder stays **4:3** (the sensor's capture ratio) so what you see is what is saved. The rest of the tall S24 Ultra screen holds the controls, in the lower third for one-handed use.
- Dark is the primary theme; the Camera and photo viewers are always dark.
- Android only. No new dependencies were added in session 1 (ask before adding any).
- Replit files were **left in place** (see Known issues) because deleting needs the owner's approval.

## How to run locally on the S24 Ultra

From `artifacts/fuji-recipe-camera` after `pnpm install` at the repo root (Node 22+ works here; `replit.md` says Node 24 [unverified whether required]):

1. Quick UI iteration: `pnpm dev` (runs `expo start`), then open the project in **Expo Go** on the phone over the same Wi-Fi. [unverified: camera works in Expo Go, but saving to the phone gallery may be limited there.]
2. Proper dev build: connect the phone by USB with USB debugging on, then run `pnpm android` (`expo run:android`). Needs the Android SDK and JDK installed on the computer. First build is slow. [unverified on this machine]
3. Standalone APK for daily use: an EAS build or a local Gradle release build after `npx expo prebuild`. [unverified]

The Android package id is `com.idrismohd.fujirecipecamera` (set in `app.json`); change it before the first build if you prefer another.

## Known issues
- **Android glass is not a real blur.** `expo-blur` on Android defaults to a semi-transparent fill unless a `BlurTargetView` and `blurMethod` are used. `Glass.tsx` relies on the tinted fill so it looks right either way. [unverified how real blur looks over the camera preview]
- **Replit leftovers still in the repo** (none block local running): `.replit`, `.replitignore`, `replit.md` (still the empty template), `artifacts/fuji-recipe-camera/.replit-artifact/`, `scripts/build.js`, `server/serve.js`, `server/templates/landing-page.html`, `create-launch` devDependency, root `@replit/connectors-sdk`. Ask the owner before deleting.
- `expo-file-system/legacy` is used in several files; it may need migrating later.
- Gallery tiles load full-resolution JPEGs through expo-image; fine for now but check memory/scroll smoothness with many photos.
- Camera tab: the `useFocusEffect` unmount logic is preserved to stop the camera running on other tabs; re-test after any navigation change.

## NEXT STEPS (ordered)

1. **Run it on the phone and review the UI.** Follow "How to run locally", then check every screen in dark and light mode, the tab bar over the gesture bar, the recipe modal, and the review screen. Fix visual bugs before building features. Record what was actually verified here.
2. **Lens selection and zoom** (enable the lens pills in `camera.tsx`). Start with `expo-camera`'s `zoom` prop (0 to 1) for smooth zoom. Then find out whether `expo-camera` can choose the S24 Ultra's physical back lenses (0.6x ultrawide, 1x main, 3x, 5x). If it cannot, record that and move to step 3's library. [unverified which lenses are exposed to third-party apps]
3. **Real live-view recipe preview.** Compare and decide, writing the tradeoffs in this file:
   - Keep `expo-camera` + colour tint overlay: simplest, no real grading in live view.
   - VisionCamera + Skia shader (GPU, per-frame grade): closest to the final photo and lowest latency, but needs new dependencies and a dev build, and may change how lenses are chosen.
   Port the maths in `lib/film-grade.ts` to a shader (tone curve, colour matrix, grain, vignette) so preview and capture match.
4. **Capture at full resolution with the recipe applied.** Check what `takePictureAsync` returns on the S24 Ultra (4:3, resolution) and that `renderFilmLook` keeps full quality without running out of memory; move heavy work off the JS thread if it stutters.
5. **Gallery save and share.** Add share sheet, multi-select, and saving to a named album through `expo-media-library`.
6. **Performance tuning for the S24 Ultra.** Profile the 120Hz scroll and animations, image sizes, and capture latency; add thumbnails so the gallery grid does not decode full-size JPEGs.
7. **Cleanup (needs owner approval).** Remove the Replit files listed under Known issues, and fill in `replit.md` or delete it.

## Session 2 (UI audit against the Apple-style checklist)

Audited by reading code (nothing run on a device). Items 1, 2 and 7 passed (true-black dark tokens, no old-palette colours, consistent icons). Items 3, 4, 5, 6 and 8 had failures, now fixed:

- **Fonts (3):** `ErrorFallback.tsx` and `+not-found.tsx` used bare `fontWeight` on the default font. Both now use the Inter type scale.
- **Shapes and borders (4):** error screen buttons/sheet had 8-16px radii and a 1px border; segmented control and chips were not pills; camera swatch had a 1px border. All now use 20px+ radii, pills and hairlines.
- **Tap targets and press feel (5):** the error screen used plain `Pressable` with 44px targets; the segmented control (36px), lens pills (40px) and recipe chips (44px) were under 48px. All are now `PressableScale` and at least 48px tall.
- **Glass (6):** the photo review and gallery viewer bottom panels were flat scrims; they are now floating `Glass` panels.
- **Status bar and modals (8):** photo review, gallery viewer and the error-details modal now set `statusBarTranslucent` and `navigationBarTranslucent` so the safe-area padding lines up on Android; the recipe detail screen forces a light status bar over its dark hero image.
- `+not-found.tsx` now has a styled "Back to recipes" button instead of a bare link.

Checks after the fixes: typecheck 0 errors; `npx expo export --platform android` bundles successfully.

Still unverified: how any of this looks on the S24 Ultra, light mode on screen, whether `statusBarTranslucent` / `navigationBarTranslucent` behave as expected on the device, and the Android glass look (still a tinted fill, not a real blur). NEXT STEPS above are unchanged; step 1 (run it on the phone) is still the first thing to do.

## Session 3 (functionality review: navigation, camera lifecycle, capture, gallery, state)

Judged by reading code only; nothing was run on a device. No styling, copy, dependencies, image maths, recipe data or AsyncStorage keys were changed.

**Result: 2 of 8 flows passed as written, 6 had real problems, all now fixed.**

- **1 Recipes: PASS.** Segmented thumb is positioned from the measured width and the selected index; favorites and the Saved empty state work.
- **2 Detail modal: FAIL, fixed.** A quick double tap could stack two modals; an unknown id silently showed the first recipe; closing with no history had no fallback. Now: taps are single-fire (`hooks/useSingleFire.ts`), an unknown id redirects to Recipes, close falls back to `replace('/')`.
- **3 Shoot with this recipe: FAIL, fixed.** Could fire twice on a double tap (now single-fire). Also see item 4: the selected recipe could be hidden off-screen.
- **4 Camera: FAIL (one problem), fixed.** Permission paths, focus/blur, flash/grid/flip and back behaviour read correctly (Android back from Camera or Gallery goes to Recipes: expo-router's tab default is `firstRoute`, so there is no dead end). The bug: the recipe carousel did not scroll to the selected recipe, so choosing one from the detail screen could leave nothing visibly selected. It now scrolls the selected chip into view.
- **5 Capture: FAIL, fixed.** The shutter guard used React state, which can be stale between two very fast taps; it now also uses a ref. A shot that failed after the camera wrote its temp file left that file behind; it is now deleted. "Save to phone" had the same state-only guard and now has a ref guard. "Gallery" in the review screen is single-fire.
- **6 Gallery: FAIL (minor), fixed.** "Save to phone" had the same state-only guard, now a ref guard. Grid last-row layout is fine: tiles have a fixed width, so a last row of 1 or 2 stays left-aligned. Remove deletes the file and state and closes the viewer.
- **7 State: FAIL, fixed.** One corrupt stored value made hydration drop all three, and the save effect then overwrote the good data. Each key is now parsed on its own, malformed photo entries are filtered out, and loaded photos are merged with any added before loading finished.
- **8 Tab bar and PressableScale: PASS.** The tab bar is a direct child of the full-screen container, so it overlays content and stays tappable. It is hidden on Camera via `tabBarStyle.display`. `PressableScale` passes `disabled`, `onPressIn` and `onPressOut` through, so hold-to-compare works.

Files changed: `app/(tabs)/{index,camera,gallery}.tsx`, `app/recipe/[id].tsx`, `context/AppState.tsx`, new `hooks/useSingleFire.ts`.

Checks: typecheck 0 errors; `npx expo export --platform android` bundles successfully.

Known, not changed: a photo whose file was deleted outside the app still shows as a blank tile (no crash; open it and tap Remove). Pruning missing files at startup would be a data-model decision, so it is left for the owner.

### Manual device test checklist (S24 Ultra) [all unverified until run]
1. **Recipes:** tap Saved with nothing saved (empty state), tap All, tap Saved again; the thumb must sit under the selected label each time. Heart two recipes, force-stop the app, reopen: both still saved.
2. **Detail modal:** double-tap a recipe card quickly; one modal opens. Press the Android back button: it closes. Open again, tap the chevron: it closes. Repeat from the featured card.
3. **Shoot with this recipe:** open Red Forest or Silver 160 (the last chips), tap "Shoot with this recipe". Camera opens once, with that chip selected and scrolled into view, and the preview tint changes.
4. **Camera permissions:** deny once (prompt returns), deny with "don't ask again" (button becomes "Open settings"), then grant. Switch to Gallery and back: the preview restarts and is not frozen.
5. **Camera back:** on the Camera tab press the chevron, then the Android back button: both end up on Recipes.
6. **Controls:** flash, grid and flip each toggle and show their state; tapping each carousel chip changes the preview tint.
7. **Capture:** double-tap the shutter; only one photo is saved and the review opens with the developed photo.
8. **Compare:** hold the eye button: original shows; release: developed shows again. Close the review with the Android back button, then check no temp file remains (optional).
9. **Save to phone:** from review and from the gallery viewer, with photo permission granted, denied, and denied with "don't ask again" (offers Settings). Double-tap the button: one save.
10. **Gallery:** with 0, 1, 2, 3, 4 and many photos the grid is left-aligned with no stretched tiles; tap a tile opens that photo; Remove deletes it and closes the viewer; the empty state button opens Camera.
11. **Tab bar:** correct highlight on each tab, hidden on Camera, back when leaving, clear of the gesture bar.
