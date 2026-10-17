import React, { useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';
import {
  CommonResolutions,
  useCameraDevice,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { SkiaCamera, type SkiaCameraProps } from 'react-native-vision-camera-skia';
import type { FilmLook } from '@/constants/recipes';
import {
  FILM_NOISE_SIZE,
  FILM_SHADER_SKSL,
  computeFilmShaderUniforms,
  createFilmNoiseBytes,
  flattenFilmShaderUniforms,
} from '@/lib/film-shader';

/**
 * Live preview with the real recipe: every camera frame goes through the film shader in
 * lib/film-shader.ts on the GPU (VisionCamera + Skia). Used by app/(tabs)/camera.tsx when
 * USE_VISION_CAMERA is on. [unverified on device]
 */

const effect = Skia.RuntimeEffect.Make(FILM_SHADER_SKSL);
const noiseImage = Skia.Image.MakeImage(
  {
    width: FILM_NOISE_SIZE,
    height: FILM_NOISE_SIZE,
    alphaType: AlphaType.Opaque,
    colorType: ColorType.RGBA_8888,
  },
  Skia.Data.fromBytes(createFilmNoiseBytes()),
  FILM_NOISE_SIZE * 4,
);
const paint = Skia.Paint();

/** False if the shader did not compile; the screen then falls back to expo-camera. */
export const FILM_SHADER_READY = effect != null && noiseImage != null;

/** Same shape as the part of expo-camera's `takePictureAsync` result the screen uses. */
export type FilmCameraHandle = {
  takePictureAsync(): Promise<{ uri: string; width: number; height: number }>;
};

type Props = {
  ref?: React.Ref<FilmCameraHandle>;
  facing: 'front' | 'back';
  flash: 'off' | 'on';
  /** Lens pill ratio (0.6, 1, 3, 5). Clamped to what the device reports. */
  lensRatio: number;
  /** Called when the camera starts, with the zoom ratios the device supports. */
  onZoomRange: (range: { min: number; max: number }) => void;
  look: FilmLook;
  onReady: () => void;
  onError: (message: string) => void;
};

export function FilmCamera({
  ref,
  facing,
  flash,
  lensRatio,
  onZoomRange,
  look,
  onReady,
  onError,
}: Props) {
  'use no memo'; // the frame callback below is a worklet; keep it out of React Compiler
  const photoOutput = usePhotoOutput();
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  // On Android the back camera is one logical multi-camera; CameraX zoom ratios are the
  // pill numbers (0.6 ultra-wide, 1 main, 3 and 5 telephoto) and the phone switches lenses
  // as the ratio crosses them. The filter prefers the device that has all three lenses. A
  // lens the phone does not expose simply falls back to zoom (or the pill stays disabled
  // if the ratio is outside the device's range).
  const device = useCameraDevice(facing, {
    physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
  });
  const target =
    device && device.maxZoom > 0
      ? Math.min(device.maxZoom, Math.max(device.minZoom, lensRatio))
      : 1;
  const zoom = useSharedValue(1);
  useEffect(() => {
    zoom.set(withTiming(target, { duration: 250 }));
  }, [target, zoom]);

  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync() {
        const photo = await photoOutput.capturePhoto(
          { flashMode: facing === 'back' ? flash : 'off' },
          {},
        );
        try {
          const path = await photo.saveToTemporaryFileAsync();
          // Width and height are the sensor's; the rotation is only an EXIF flag.
          const sideways = photo.orientation === 'left' || photo.orientation === 'right';
          return {
            uri: `file://${path}`,
            width: sideways ? photo.height : photo.width,
            height: sideways ? photo.width : photo.height,
          };
        } finally {
          photo.dispose();
        }
      },
    }),
    [photoOutput, facing, flash],
  );

  // shortcut: grain is the same pattern every frame (it sticks to the screen); animate it
  // later by changing the seed per frame.
  const onFrame = useCallback<SkiaCameraProps['onFrame']>(
    (frame, render) => {
      'worklet';
      render(({ canvas, frameTexture }) => {
        const uniforms = flattenFilmShaderUniforms(
          computeFilmShaderUniforms(look, frameTexture.width(), frameTexture.height()),
        );
        const source = frameTexture.makeShaderOptions(
          TileMode.Clamp,
          TileMode.Clamp,
          FilterMode.Linear,
          MipmapMode.None,
        );
        const noise = noiseImage!.makeShaderOptions(
          TileMode.Repeat,
          TileMode.Repeat,
          FilterMode.Nearest,
          MipmapMode.None,
        );
        paint.setShader(effect!.makeShaderWithChildren(uniforms, [source, noise]));
        canvas.drawImage(frameTexture, 0, 0, paint);
      });
      frame.dispose();
    },
    [look],
  );

  return (
    <SkiaCamera
      style={StyleSheet.absoluteFill}
      device={device ?? facing}
      isActive
      zoom={zoom}
      outputs={outputs}
      // The photo output defaults to 4:3, so the preview frames are 4:3 too.
      targetResolution={CommonResolutions.FHD_4_3}
      onFrame={onFrame}
      onStarted={() => {
        if (device) onZoomRange({ min: device.minZoom, max: device.maxZoom });
        onReady();
      }}
      onError={(error) => onError(error.message)}
    />
  );
}
