---
name: Android film-look fidelity
description: Product constraint for matching live camera previews with processed recipe photos.
---

Keep the Expo Go version's live recipe preview clearly described as an approximation; recipe grading is applied to the captured JPEG on-device. A translucent overlay is not a true film simulation.

**Why:** `expo-camera` preview frames are rendered separately from React Native overlays, so overlays cannot reproduce film curves, color separation, or grain.

**How to apply:** If live preview parity is required, plan a native Android camera/GPU pipeline and test it on an S24 Ultra before claiming the preview matches the saved image.
