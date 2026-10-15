import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { FilmLook } from '@/constants/recipes';

/**
 * Cheap live-view approximation of a recipe, built only from plain views and linear
 * gradients on top of the camera preview (no frame access, no new native code):
 *
 *   - colour cast   : `look.previewTint` (white balance / simulation character)
 *   - faded blacks  : a light veil scaled by `look.fade`
 *   - vignette      : four edge gradients scaled by `look.vignette`
 *
 * It cannot do the tone curve, colour matrix, saturation or grain. Those are only applied
 * to the captured photo by lib/film-grade.ts. See NOTES.md, "Session 4", for why.
 */

const FADE_VEIL_GAIN = 6; // fade is 0..0.1, so 0.1 -> 0.6 veil alpha before the cap
const FADE_VEIL_MAX = 0.28;
const VIGNETTE_GAIN = 0.55;
const EDGE_DEPTH = '38%';

function edge(alpha: number) {
  return [`rgba(0,0,0,${alpha.toFixed(3)})`, 'rgba(0,0,0,0)'] as const;
}

export function LivePreviewOverlay({ look }: { look: FilmLook }) {
  const veil = Math.min(FADE_VEIL_MAX, Math.max(0, look.fade * FADE_VEIL_GAIN));
  const vignetteAlpha = Math.min(0.6, Math.max(0, look.vignette * VIGNETTE_GAIN));
  const colors = edge(vignetteAlpha);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: look.previewTint }]} />
      {veil > 0 && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(200,200,205,${veil.toFixed(3)})` }]}
        />
      )}
      {vignetteAlpha > 0 && (
        <>
          <LinearGradient
            colors={colors}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.edge, { top: 0, left: 0, right: 0, height: EDGE_DEPTH }]}
          />
          <LinearGradient
            colors={colors}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={[styles.edge, { bottom: 0, left: 0, right: 0, height: EDGE_DEPTH }]}
          />
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.edge, { top: 0, bottom: 0, left: 0, width: EDGE_DEPTH }]}
          />
          <LinearGradient
            colors={colors}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={[styles.edge, { top: 0, bottom: 0, right: 0, width: EDGE_DEPTH }]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute' },
});
