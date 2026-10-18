import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  AlphaType,
  ColorType,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';
import {
  CommonResolutions,
  useCameraDevice,
  usePhotoOutput,
  type Photo,
} from 'react-native-vision-camera';
import {
  SkiaCamera,
  type SkiaCameraProps,
  type SkiaCameraRef,
} from 'react-native-vision-camera-skia';
import type { FilmLook } from '@/constants/recipes';
import { classifyCameraError } from '@/lib/camera-errors';
import {
  FILM_NOISE_SIZE,
  FILM_SHADER_SKSL,
  computeFilmShaderUniforms,
  createFilmNoiseBytes,
  flattenFilmShaderUniforms,
} from '@/lib/film-shader';
import { OUTPUT_QUALITY } from '@/lib/film-look';

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

/** The lens-pill zoom glide: 8 small steps, about 240 ms. */
const ZOOM_GLIDE_STEPS = 8;
const ZOOM_GLIDE_STEP_MS = 30;
/**
 * After a rejected zoom call (CameraX: "Camera is not active" while the camera is still
 * opening), retry this many times, this far apart: about 9 s in total, far longer than a
 * camera takes to open, then give up quietly (the preview just stays at the current zoom).
 */
const ZOOM_MAX_RETRIES = 30;
const ZOOM_RETRY_MS = 300;

/** False if the shader did not compile; the screen then falls back to expo-camera. */
export const FILM_SHADER_READY = effect != null && noiseImage != null;

/**
 * Same shape as the part of expo-camera's `takePictureAsync` result the screen uses, plus
 * `graded`: the finished JPEG (base64) when the GPU grade worked. Without it the screen
 * grades `uri` with the jpeg-js path (lib/film-look.ts), as it does for expo-camera.
 */
export type FilmCameraHandle = {
  takePictureAsync(): Promise<{
    uri: string;
    width: number;
    height: number;
    graded?: { base64: string; width: number; height: number };
  }>;
};

/** Grades the full photo with the film shader on an offscreen Skia surface. */
async function gradeOnGpu(photo: Photo, look: FilmLook) {
  // toImage() applies the EXIF rotation and mirroring, so pixels are upright.
  const image = await photo.toImageAsync();
  try {
    const { buffer, width, height, pixelFormat } = await image.toRawPixelDataAsync();
    if (pixelFormat !== 'RGBA' && pixelFormat !== 'RGBX') {
      throw new Error(`Unsupported pixel format ${pixelFormat}`);
    }
    const source = Skia.Image.MakeImage(
      { width, height, alphaType: AlphaType.Opaque, colorType: ColorType.RGBA_8888 },
      Skia.Data.fromBytes(new Uint8Array(buffer)),
      width * 4,
    );
    const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
    if (!source || !surface || !effect || !noiseImage) throw new Error('Skia setup failed');
    const uniforms = flattenFilmShaderUniforms(
      computeFilmShaderUniforms(look, width, height, Date.now() & 0xffff),
    );
    const paint = Skia.Paint();
    paint.setShader(
      effect.makeShaderWithChildren(uniforms, [
        source.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Nearest, MipmapMode.None),
        noiseImage.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Nearest, MipmapMode.None),
      ]),
    );
    // shortcut: the draw and the JPEG encode below have no async version in Skia, so they
    // block the JS thread for the length of one shot; move to a worklet if that stutters.
    surface.getCanvas().drawRect({ x: 0, y: 0, width, height }, paint);
    surface.flush();
    const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, OUTPUT_QUALITY);
    return { base64, width, height };
  } finally {
    image.dispose();
  }
}

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
  // shortcut: default 12 MP (UHD_4_3) capture; full-sensor 50 MP means ~200 MB of raw pixels in JS, raise only after testing memory on the phone.
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

  // Errors: CameraX rejects calls that race with the camera starting, stopping or switching
  // ("Camera is not active"). Those are ignored here (see lib/camera-errors.ts); anything else
  // is reported to the screen once, which then switches to the fallback camera.
  //
  // The screen passes inline arrows for onError / onReady / onZoomRange, so they are read
  // through a ref: every handler below keeps one stable identity. Otherwise each parent render
  // would recreate `applyZoom` and its effect would restart the zoom glide and reset the retry
  // count every time.
  const callbacks = useRef({ onError, onReady, onZoomRange });
  callbacks.current = { onError, onReady, onZoomRange };
  const reportedFatal = useRef(false);
  const handleError = useCallback((error: Error) => {
    if (classifyCameraError(error.message) === 'transient') {
      console.warn('Camera: ignored a transient error:', error.message);
      return;
    }
    if (reportedFatal.current) return;
    reportedFatal.current = true;
    callbacks.current.onError(error.message);
  }, []);

  // Zoom is NOT given to SkiaCamera as a prop. As a prop, VisionCamera calls setZoom as soon as
  // the controller exists (before the session has started) and on every animation frame, and
  // CameraX rejects those calls while the camera is not active, which used to end in a
  // "Camera unavailable" alert. Instead zoom is applied here, only while the camera is started,
  // as a short glide of small steps. A rejected step stops the glide and retries a bounded number
  // of times, and the latest target is also re-applied on every start and every reconfiguration
  // (camera flip), so the camera always converges on the selected lens whichever callback fires.
  const camera = useRef<SkiaCameraRef>(null);
  const started = useRef(false);
  const targetRef = useRef(target);
  targetRef.current = target;
  const glide = useRef<ReturnType<typeof setInterval> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const stopGlide = useCallback(() => {
    if (glide.current) clearInterval(glide.current);
    glide.current = null;
    if (retry.current) clearTimeout(retry.current);
    retry.current = null;
  }, []);
  const applyZoom = useCallback(() => {
    stopGlide();
    const to = targetRef.current;
    const controller = started.current ? camera.current?.controller : undefined;
    if (!controller) return; // not started yet: onStarted applies it
    let from = to;
    try {
      from = controller.zoom;
    } catch {
      // controller already gone; a retry or the next start re-applies the zoom
    }
    const retryLater = () => {
      stopGlide();
      if (retries.current >= ZOOM_MAX_RETRIES) return;
      retries.current += 1;
      retry.current = setTimeout(applyZoom, ZOOM_RETRY_MS);
    };
    let step = 0;
    glide.current = setInterval(() => {
      step += 1;
      const t = Math.min(1, step / ZOOM_GLIDE_STEPS);
      const value = from + (to - from) * (1 - (1 - t) * (1 - t));
      const live = started.current ? camera.current?.controller : undefined;
      if (!live) {
        retryLater();
        return;
      }
      live
        .setZoom(t === 1 ? to : value)
        .then(() => {
          if (t === 1) retries.current = 0;
        })
        .catch((error: Error) => {
          handleError(error);
          if (classifyCameraError(error.message) === 'transient') retryLater();
        });
      if (t === 1 && glide.current) {
        clearInterval(glide.current);
        glide.current = null;
      }
    }, ZOOM_GLIDE_STEP_MS);
  }, [handleError, stopGlide]);
  useEffect(() => {
    retries.current = 0;
    applyZoom();
  }, [target, applyZoom]);
  useEffect(() => stopGlide, [stopGlide]);
  const handleStarted = useCallback(() => {
    started.current = true;
    retries.current = 0;
    applyZoom();
    callbacks.current.onReady();
  }, [applyZoom]);
  const handleStopped = useCallback(() => {
    started.current = false;
    stopGlide();
  }, [stopGlide]);

  // Report the zoom range after any render once the device knows it: on Android it reads 0
  // until CameraX's zoom state is ready, so reading it only at start can miss it.
  const reportedRange = useRef({ min: 0, max: 0 });
  useEffect(() => {
    if (!device || device.maxZoom <= 0) return;
    const range = { min: device.minZoom, max: device.maxZoom };
    if (range.min === reportedRange.current.min && range.max === reportedRange.current.max) return;
    reportedRange.current = range;
    callbacks.current.onZoomRange(range);
  });

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
          let graded;
          try {
            graded = await gradeOnGpu(photo, look);
          } catch (error) {
            console.warn('GPU grade failed, using the jpeg-js path:', error);
          }
          return {
            uri: `file://${path}`,
            width: sideways ? photo.height : photo.width,
            height: sideways ? photo.width : photo.height,
            graded,
          };
        } finally {
          photo.dispose();
        }
      },
    }),
    [photoOutput, facing, flash, look],
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
      ref={camera}
      style={StyleSheet.absoluteFill}
      device={device ?? facing}
      isActive
      outputs={outputs}
      // The photo output defaults to 4:3, so the preview frames are 4:3 too.
      targetResolution={CommonResolutions.FHD_4_3}
      // SkiaCamera defaults to 'native' on Android = PRIVATE, which CameraX's ImageAnalysis
      // rejects at 1440x1080 on the S24 Ultra ("PRIVATE format ... not supported"). RGBA is
      // always supported there. shortcut: 'yuv' is lighter but untested with Skia on Android.
      pixelFormat="rgb"
      onFrame={onFrame}
      onStarted={handleStarted}
      onStopped={handleStopped}
      onConfigured={applyZoom}
      onError={handleError}
    />
  );
}
