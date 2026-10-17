# NOTES: handoff file for the next Claude session

## Roadmap (live checklist, update after every step)

**How to resume:** read this list, do the first unchecked step, then commit and push before starting the next one (small steps, so a usage cutoff loses at most one). After each step: check its box, add a short "Step N" entry in the log at the bottom (what changed, files, what is unverified on device), add any new TODOs here. Verify with `pnpm --filter @workspace/fuji-recipe-camera run typecheck` and `npx expo export --platform android` (from `artifacts/fuji-recipe-camera`). Nothing can be run on a device from the cloud session, so never mark anything verified on device; the owner tests on the S24 Ultra.

**Heads up:** `.github/workflows/android-apk.yml` builds an APK on every push to `main` (a newer push cancels the build in progress). Do not edit the workflow without asking the owner. Native-module changes (steps 4+) must prebuild cleanly or the APK build fails.

- [x] 1. Roadmap checklist in NOTES.md (this list)
- [x] 2. Liquid glass, core: upgrade `components/Glass.tsx` (real blur if expo-blur supports it on Android, specular top edge, inner glow, gradient hairline, soft shadow)
- [x] 3. Liquid glass, motion and reach: press brightness lift, apply glass consistently (tab bar, camera top bar, lens pills, selection bar, review/viewer panels), tap targets >= 48px
- [x] 4. (owner approved the extra packages 2026-10-16; CI build result recorded in the Step 4 log) Native camera groundwork: react-native-vision-camera, @shopify/react-native-skia, worklets setup, config plugins and CAMERA permission in app.json; confirm the APK workflow still prebuilds
- [x] 5. Shader module: Skia runtime-effect port of `lib/film-grade.ts`, plus a Node script comparing a reference pixel evaluation with `gradePixels` (max difference 1 level; SkSL compiles and runs in CanvasKit on CPU; not yet run on the phone's GPU)
- [x] 6. VisionCamera screen with the live shader, behind `USE_VISION_CAMERA` (expo-camera path kept as fallback); bundles, but never run on a device
- [x] 7. Real lens selection (0.6 / 1 / 3 / 5) from VisionCamera's device list; `ASSUMED_MAX_ZOOM_RATIO` is no longer used by the VisionCamera path but stays for the expo-camera fallback (see Step 7); never run on a device
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

### Step 3 (liquid glass, motion and reach): done
- `PressableScale` now exposes a `PressContext` (0..1 press amount, UI thread) and a `lift` prop (peak white overlay opacity, follows the style's borderRadius). Any `Glass` inside a `PressableScale` brightens by up to 16% while pressed, automatically; non-glass pills use `lift` (lens pills, tab bar items, gallery selection actions).
- Glass is used consistently: tab bar, camera top bar and buttons, lens bar, review and viewer panels, gallery selection bar. All tap targets were already >= 48 px and were left unchanged.
- Real blur is wired in the **gallery only**: `GlassScope` > `GlassBackdrop` (the photo grid) with the selection bar as a sibling. The viewer Modal is wrapped in `GlassNoBlur` (a Modal is a separate window). The tab bar and camera screen keep the tinted fill: expo-router renders the tab bar outside the scene, and the camera preview is a native surface that cannot be blurred.
- Checks: typecheck 0 errors, Android export bundles. [unverified on device: real blur in the gallery selection bar (set `REAL_BLUR = false` in `Glass.tsx` if it looks wrong), press-lift look, per-side border colours]
- TODO (optional, later): real blur on the tab bar would need a custom wrapper around the tab scenes.

### Step 4 (native camera groundwork): BLOCKED on a dependency decision, nothing installed yet
Findings from the package source and npm metadata (checked 2026-10-16):
- `react-native-vision-camera` is **5.2.3**, a Nitro-based rewrite with a new API (`useCameraDevice`, `usePreviewOutput`, `usePhotoOutput`, `useFrameOutput`, `Camera`), not the 4.x API most online examples use. It has **no Expo config plugin**: permissions go in `app.json` (`android.permission.CAMERA` is already there) and native code is autolinked. Required peers: `react-native-nitro-modules` and `react-native-nitro-image` (pre-approved as required peers).
- Frame processing is **not in core**. `useFrameOutput` needs `react-native-vision-camera-worklets` (peers: nitro-modules, vision-camera, `react-native-worklets`; worklets 0.10.1 is already installed). Drawing frames with Skia needs `react-native-vision-camera-skia` (peers: vision-camera, vision-camera-worklets, `@shopify/react-native-skia` 2.14.0, worklets, reanimated 4.5.1; both already installed).
- So steps 5 to 8 need these packages on top of the brief's list: **react-native-vision-camera-worklets** and **react-native-vision-camera-skia**. The brief says to stop and ask before adding anything not named, so none of them were installed.
- Verification available: `gh run list --repo idrismohd2170/fuji-recipe-camera` works from the cloud session, so each push's APK workflow result (native compile included) can be checked even though nothing can be run on the phone. A successful build takes about 8 to 12 minutes; a newer push cancels the build in progress.
- Risk to weigh: steps 6 to 8 replace the camera screen and capture path with a brand-new API, written without a device. The expo-camera path stays behind `USE_VISION_CAMERA` as the fallback.
- Packages that would be added if approved: react-native-vision-camera, react-native-vision-camera-worklets, react-native-vision-camera-skia, react-native-nitro-modules, react-native-nitro-image, @shopify/react-native-skia (all pinned to the versions above).

**Step 4 update (2026-10-16): owner approved; packages installed.** Added (exact versions): react-native-vision-camera 5.2.3, react-native-vision-camera-worklets 5.2.3, react-native-vision-camera-skia 5.2.3, react-native-nitro-modules 0.37.1, react-native-nitro-image 0.15.2, @shopify/react-native-skia 2.14.0. No Expo config plugin exists for VisionCamera 5, and `app.json` already had `android.permission.CAMERA`, so `app.json` is unchanged. `expo prebuild --platform android --no-install` completes locally (it appends `expo`, `react` and `react-native` to `dependencies` in package.json; that was reverted because they are already devDependencies, and CI does the same on its own checkout). No Android SDK in the cloud container, so the native compile is verified only by the APK workflow (see below). Nothing imports the new packages yet.

### Step 4 CI result (recorded in step 5)
The APK workflow run for the Step 4 commit (`eea662c`, run 38897633649) finished **success** in 19m20s, so the VisionCamera 5, worklets, skia and nitro packages prebuild and compile in CI. The earlier runs for steps 1 to 3 and the findings commit were cancelled by the newer pushes, as expected. [unverified on device: nothing imports the new packages yet.]

### Step 5 (shader module): done
- New `lib/film-shader.ts` (no React Native or Skia imports, so Node can load it): the SkSL source `FILM_SHADER_SKSL`, `computeFilmShaderUniforms(look, width, height, grainSeed)`, `flattenFilmShaderUniforms()` (37 floats, declaration order), `createFilmNoiseBytes()` (the 256 x 256 grain tile as RGBA8) and `evaluateFilmPixelReference()` (the same maths in plain TypeScript for one pixel). The shader has two children in this order: `image` (the frame) then `noise` (the tile, tiled with Repeat and Nearest sampling). Step 6 builds the effect with `Skia.RuntimeEffect.Make(FILM_SHADER_SKSL)` and `makeShaderWithChildren(flat, [imageShader, noiseShader])`.
- Maths ported: exposure and white balance in linear light, filmic S-curve with highlight roll-off, shadow lift and fade (analytic per channel; `gradePixels` bakes the same formula into a LUT), colour matrix or mono channel mix, vibrance saturation, split tone, luminance-weighted grain plus colour noise, vignette. The grain tile is the same xorshift tile as the private one in `film-grade.ts`, regenerated in the new file, so `film-grade.ts` exports are untouched.
- New `scripts/compare-film-shader.mjs` (run from the app folder: `node --no-warnings scripts/compare-film-shader.mjs`, Node 22.18+). It grades a 96 x 64 test image (grey and colour ramps plus random pixels) with `gradePixels` for every recipe plus one extreme "stress" look, with grain on and off, and compares in 8-bit levels.
- **Result: reference vs `gradePixels` max difference is 1 level (mean about 0.03 with grain, about 0.004 without), which is 8-bit rounding.** The script also compiles the real SkSL with `canvaskit-wasm` (already in the tree as a Skia dependency, not added to package.json) and renders it on a CPU surface: it compiles, expects the same 37 uniform floats we pass, differs from the reference by at most 0.56 level, and from `gradePixels` by at most 1 level.
- Deliberate sub-level differences: luminance is continuous in the shader (rounded to 0..255 in `gradePixels` before the split-tone and grain-weight lookups), and the grain tile is stored as an 8-bit texture.
- Grain note for step 6: grain cell size and the vignette centre follow the size passed to `computeFilmShaderUniforms`, so for the live preview pass the preview's pixel size.
- Checks: typecheck 0 errors; `pnpm exec expo export --platform android` bundles. The app does not import `film-shader.ts` yet, so the bundle is unchanged. [unverified on device: the shader on the phone's GPU (precision, texture sampling of the grain tile, speed per frame).]

### Step 6 (VisionCamera screen with the live shader): done, unverified on device
- New `components/FilmCamera.tsx`: `SkiaCamera` (react-native-vision-camera-skia) draws every frame through `FILM_SHADER_SKSL` with the active recipe's uniforms (`computeFilmShaderUniforms` is called per frame with the frame texture size, so the vignette centre and grain size match). It also owns a `usePhotoOutput()` and exposes `takePictureAsync()` returning `{ uri, width, height }`, so `takeShot` in `camera.tsx` barely changed. Photo width and height are swapped for `left`/`right` orientation because VisionCamera reports sensor dimensions and applies rotation only as an EXIF flag.
- `app/(tabs)/camera.tsx`: `USE_VISION_CAMERA = true` at the top. The component is `require`d lazily so the expo-camera fallback never loads the native modules. `useVision` is also false if the shader fails to compile (`FILM_SHADER_READY`), which falls back to expo-camera by itself. With VisionCamera on, `LivePreviewOverlay` is not drawn (the shader already does it) and the hint text changes. Kept as they were: permission screens (still `expo-camera`'s `useCameraPermissions`, the CAMERA permission is the same system permission), flash, grid, flip, screen focus/blur mount gating, the capture and save single-fire guards, the 4:3 frame, lens pills.
- `lib/film-shader.ts`: added `'worklet'` to `clamp`, `bump`, `rawTone`, `computeFilmShaderUniforms` and `flattenFilmShaderUniforms` so the frame callback can call them. `FilmCamera` has `'use no memo'` because the project has React Compiler on.
- Checks: typecheck 0 errors; `expo export --platform android` bundles, and the non-bytecode bundle shows worklet metadata on the frame callback and on the shader functions. Not checked: the APK build with these imports (see the Actions run for this commit).
- **Unverified on device (add to the device checklist in step 9):**
  - the SkSL compiles in native Skia (it only compiled in CanvasKit here); if it does not, the screen should silently use expo-camera, check the log for the compile error
  - preview is 4:3 and not stretched (`targetResolution` is `FHD_4_3`, the negotiated size is not reported to JS), frame rate and heat with the shader at 1440 x 1920
  - live grade matches the developed photo (compare the preview with the review screen)
  - capture: the saved JPEG's rotation and the review screen caption size; whether `expo-image-manipulator` honours the EXIF rotation of the VisionCamera JPEG (if photos come out sideways or stretched, rotate in `FilmCamera.takePictureAsync`); front camera photos may not be mirrored like the preview
  - flash on capture (back camera only; front camera sends flash off), flip, the single-fire guards, leaving and returning to the Camera tab
  - zoom: `zoom` is now a VisionCamera zoom factor (`ratio`, via the old `ASSUMED_MAX_ZOOM_RATIO` conversion) and 1 might not be the main lens on the S24 Ultra; step 7 replaces this with the device list
  - grain is the same pattern on every frame (marked `shortcut:` in `FilmCamera.tsx`)

### Step 7 (real lens selection): done, unverified on device
- What VisionCamera 5.2.3 actually offers on Android (from its Kotlin source): `cameraDevices` is CameraX's `availableCameraInfos`; the back camera is one logical multi-camera whose `physicalDevices` are read-only info (not selectable as inputs), `zoom` is a true CameraX zoom ratio (`setZoomRatio`), and **`zoomLensSwitchFactors` is hard-coded empty** (a TODO in the library). So you cannot pick a physical lens directly; the pills set the zoom ratio and the phone's camera stack switches lenses as the ratio crosses 0.6 / 1 / 3 / 5.
- `components/FilmCamera.tsx`: picks the device with `useCameraDevice(facing, { physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'] })` (prefers the device with all three lenses), animates `zoom` with a reanimated `withTiming` shared value (250 ms) to the pill's ratio clamped to the device's `minZoom`/`maxZoom`, and reports that range to the screen from `onStarted` (new props `lensRatio`, `onZoomRange`; the old `zoom` prop is gone).
- `app/(tabs)/camera.tsx`: with VisionCamera a pill is enabled when its ratio lies inside the reported range (so 0.6 enables only if the device reports `minZoom <= 0.6`), and still only on the back camera. A lens the phone does not expose therefore falls back to plain zoom at that ratio, or stays disabled if out of range. `selectLens` no longer runs the old JS zoom glide on this path.
- **`ASSUMED_MAX_ZOOM_RATIO` was not removed**: the expo-camera fallback (`USE_VISION_CAMERA = false`, or a shader compile failure) still needs it. Delete it together with the fallback when you drop expo-camera.
- Checks: typecheck 0 errors; `expo export --platform android` bundles.
- **Unverified on device:**
  - the S24 Ultra reports `minZoom` about 0.6 and a `maxZoom` of at least 5 for the back device; if every pill is greyed out, `minZoom`/`maxZoom` came back 0 (CameraX zoom state not ready yet when `onStarted` fires), so read the range from the controller instead
  - the 3 and 5 pills really land on the telephoto lenses (watch for a visible lens switch and a change in field of view), and what the 0.6 pill shows
  - the 250 ms zoom animation is smooth and survives flipping to the front camera and back
  - the photo is taken at the selected zoom
