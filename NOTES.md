# NOTES: handoff file for the next Claude session

## Roadmap (live checklist, update after every step)

**How to resume:** read this list, do the first unchecked step, then commit and push before starting the next one (small steps, so a usage cutoff loses at most one). After each step: check its box, add a short "Step N" entry in the log at the bottom (what changed, files, what is unverified on device), add any new TODOs here. Verify with `pnpm --filter @workspace/fuji-recipe-camera run typecheck` and `npx expo export --platform android` (from `artifacts/fuji-recipe-camera`). Nothing can be run on a device from the cloud session, so never mark anything verified on device; the owner tests on the S24 Ultra.

**Heads up:** `.github/workflows/android-apk.yml` builds an APK on every push to `main` (a newer push cancels the build in progress). Do not edit the workflow without asking the owner. Native-module changes (steps 4+) must prebuild cleanly or the APK build fails.

- [x] 1. Roadmap checklist in NOTES.md (this list)
- [x] 2. Liquid glass, core: upgrade `components/Glass.tsx` (real blur if expo-blur supports it on Android, specular top edge, inner glow, gradient hairline, soft shadow)
- [ ] 3. Liquid glass, motion and reach: press brightness lift, apply glass consistently (tab bar, camera top bar, lens pills, selection bar, review/viewer panels), tap targets >= 48px
- [ ] 4. Native camera groundwork: react-native-vision-camera, @shopify/react-native-skia, worklets setup, config plugins and CAMERA permission in app.json; confirm the APK workflow still prebuilds
- [ ] 5. Shader module: Skia runtime-effect port of `lib/film-grade.ts`, plus a Node script comparing a reference pixel evaluation with `gradePixels`
- [ ] 6. VisionCamera screen with the live shader, behind `USE_VISION_CAMERA` (expo-camera path kept as fallback)
- [ ] 7. Real lens selection (0.6 / 1 / 3 / 5) from VisionCamera's device list; remove `ASSUMED_MAX_ZOOM_RATIO`
- [ ] 8. Full-resolution capture with the shader through Skia (jpeg-js path kept as fallback)
- [ ] 9. Wrap-up: NOTES update, device checklist for every new feature, remaining TODOs


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
- **Replit leftovers: removed in session 4** (the files listed here before, plus the `build` and `serve` scripts that ran them). Still mentioning Replit, deliberately untouched because they were not on the approved list: `pnpm-workspace.yaml` (catalog and release-age entries) and `artifacts/mockup-sandbox`.
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

## Session 4 (NEXT STEPS 2 to 7, done without a device)

Nothing here was run on the S24 Ultra. Every step was checked only with `pnpm --filter @workspace/fuji-recipe-camera run typecheck` (0 errors) and `npx expo export --platform android` (bundles), both after the last change. Anything that needs the phone is marked **unverified on device**.

### Step 2: lens pills and zoom
- `camera.tsx`: the 1×, 3 and 5 pills now set `zoom` on `CameraView`, gliding there in 8 small steps. 0.6 stays disabled. Pills are disabled on the front camera.
- **Finding (from reading expo-camera 57.0.6 source):** on Android `selectedLens` is iOS-only, so third-party code cannot pick a physical lens through expo-camera. The `zoom` prop maps 0..1 to a CameraX zoom ratio of 1..maxZoomRatio and clamps below 1×, so the 0.6× ultrawide is unreachable. 3× and 5× can only work if the phone's logical back camera switches to the telephoto lenses as the ratio rises. [unverified on device whether it does, and at what ratio]
- expo-camera does not tell JS the maximum zoom ratio, so `ASSUMED_MAX_ZOOM_RATIO = 10` in `camera.tsx` converts a ratio to the 0..1 prop. If the real maximum differs, 3× and 5× land at the wrong ratio; fix that one constant.
- To get true lens choice (0.6× and real 3×/5×) VisionCamera is needed (see step 3).

### Step 3: live preview (decision: keep expo-camera, improve the overlay)
| | expo-camera + overlay | VisionCamera + Skia shader |
|---|---|---|
| New dependencies | none | react-native-vision-camera, @shopify/react-native-skia, a worklets setup |
| Needs dev build | already planned | yes, and Expo Go stops working |
| Preview matches final photo | approximately (tint, faded blacks, vignette) | closely (tone curve, matrix, grain) |
| Lens choice | zoom only (see step 2) | proper physical-lens selection |
| Risk without a device | low | high: replaces the camera component, and capture, flash and permissions all change |

I chose expo-camera because the shader route cannot be tested here and would rewrite the camera screen blind. New `components/LivePreviewOverlay.tsx` draws the recipe's colour cast (`previewTint`), a faded-blacks veil scaled by `look.fade`, and a four-edge vignette scaled by `look.vignette`. It cannot show the tone curve, colour matrix, saturation or grain; those still appear only after capture. **The "live view shows the real recipe" goal is therefore not met yet.** Do the VisionCamera + Skia port as its own task after the step 1 device run, porting `lib/film-grade.ts` (tone LUT, matrix, saturation, split tone, grain, vignette) to a shader.

### Step 4: capture
- `takePictureAsync` returns the sensor's 4:3 picture; its exact size on the S24 Ultra is unverified. `renderFilmLook` still limits the long edge to 2560 px (about 5 MP), because `jpeg-js` grades pixels in plain JavaScript. **Full resolution was not changed**: raising the cap risks running out of memory and long waits, and cannot be tested here. Moving the grade off the JS thread needs a native or worklet-based pipeline and belongs with the step 3 shader work.
- Provable fixes in `lib/film-look.ts`: the temp JPEG written by `manipulateAsync` is now deleted (it leaked into the cache on every shot), the base64 string is released before grading, and the encoded bytes are no longer copied before base64 encoding. The exports are unchanged.

### Step 5: share, multi-select, album
- New `lib/photo-export.ts`: `savePhotosToAlbum` (expo-media-library 57 object API: `Album.get`, `Asset.create(uri, album)`, `Album.create`) saves into an album named **Fuji Recipe**; `sharePhoto` uses the share sheet. The camera review's Save to phone now uses it too.
- Gallery: Select button or long-press a tile starts selection; bottom bar has Share (exactly one photo, because expo-sharing shares one file at a time), Save (any number, to the album) and Remove (any number). The viewer has a share button and Save to phone goes to the album.
- New dependency, approved in the brief: `expo-sharing ~57.0.23` (installed with pnpm because `expo install` could not reach its API from this environment).

### Step 6: performance
- New `lib/photo-store.ts`: a 480 px thumbnail is made after each capture and stored in `film-photos/thumbs/`. `SavedPhoto` gained an optional `thumbUri` (storage keys unchanged; old photos without one fall back to the full image). Removing a photo deletes both files. `AppState` gained `removePhotos(ids)`.
- Grid cells are a memoised `PhotoTile`, the FlatList has tuned `initialNumToRender`, `windowSize` and `removeClippedSubviews`, and the separator is stable. [unverified on device: scroll smoothness at 120 Hz, capture latency]

### Step 7: cleanup
Removed with `git rm`: `.replit`, `.replitignore`, `replit.md`, `artifacts/fuji-recipe-camera/.replit-artifact/`, `scripts/build.js`, `server/` (serve.js and the landing page). Also removed the app's `build` and `serve` scripts, the `create-launch` devDependency, and the root `@replit/connectors-sdk` dependency, and refreshed the lockfile. See Known issues for what still mentions Replit.

### Extra device checks (add to the checklist above) [all unverified until run]
12. **Lens and zoom:** tap 1×, 3 and 5. The preview should glide, the selected pill highlights, and on the front camera the pills are greyed out. Note the real zoom ratio you see at 3 and 5 and whether the lens switches; adjust `ASSUMED_MAX_ZOOM_RATIO` if not.
13. **Live preview:** switch recipes and check the tint, faded look and darker corners change. Compare with the developed photo: expect the photo to look stronger.
14. **Full-res capture:** note the photo size shown in the review caption (expected about 2560 px long edge). Take 10 shots in a row and watch for slowdowns or crashes.
15. **Share:** open a photo and tap share; the system share sheet should show the photo. In select mode, Share is only enabled with exactly one photo selected.
16. **Multi-select:** long-press a tile, select several, tap Save, and check a "Fuji Recipe" album appears in the phone gallery with all of them. Then select several and Remove; the files and thumbnails are gone.
17. **Thumbnails:** take a photo and open the Gallery; the grid should load quickly. Older photos should still show.

### Session 4 follow-up: first device run, capture crash fixed
- **Bug (seen on the S24 Ultra):** every capture ended with "Could not finish this shot: Property 'Buffer' doesn't exist". Cause: `jpeg-js`'s encoder calls `Buffer.from(...)` and Hermes has no global `Buffer`. The decoder was fine (`useTArray: true`). This crash was present since session 1; it was never hit because nothing had run on a device.
- **Fix:** `encodeJpeg()` in `lib/film-look.ts` provides a minimal `Buffer` (`from`, `alloc`) only for the duration of the synchronous encode, then removes it, so no other library sees a fake global. No new dependency.
- Checks: typecheck 0 errors, `npx expo export --platform android` bundles. [unverified on device until the next capture: re-test a shot, then the review screen, Gallery, thumbnail and Save to phone.]

### Step 2 (liquid glass, core): done
- `components/Glass.tsx` rebuilt: blur, tinted body, specular sheen from the top edge, faint inner glow from the bottom, a thin top rim-light line, a bevelled hairline (brighter on top, dimmer on the bottom) and a soft depth shadow (`depth` prop, default on). Props `forceDark`, `radius`, `intensity`, `style` unchanged.
- Real Android blur is opt-in: `GlassScope` + `GlassBackdrop` (new exports) wrap the content to blur, with `Glass` panels as siblings (BlurView must not be inside the target). Without a scope, or over the camera preview (a native surface that cannot be captured), Glass uses the tinted fill. `REAL_BLUR` at the top of the file turns real blur off everywhere if it misbehaves.
- Nothing uses `GlassScope` yet; step 3 wires it into the gallery (and tab bar if the layout allows).
- Checks: typecheck 0 errors, Android export bundles. [unverified on device: how it looks, shadow under translucent fill on Android, per-side border colours on rounded corners]
