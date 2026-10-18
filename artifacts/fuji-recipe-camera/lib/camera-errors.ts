/**
 * Which VisionCamera / CameraX errors are harmless lifecycle noise and which mean the camera
 * cannot work. No React Native imports, so Node can load it (scripts/compare-film-shader.mjs
 * asserts the cases below).
 *
 * A transient error is CameraX saying "that call raced with the camera starting, stopping or
 * switching": the operation was cancelled and the next one, once the camera is up, will work.
 * It must never reach the user. Everything else is treated as fatal, so a NEW kind of failure
 * is shown (and triggers the fallback camera) rather than silently swallowed.
 */
export type CameraErrorKind = 'transient' | 'fatal';

const TRANSIENT_PATTERNS: readonly RegExp[] = [
  /camera is not active/i, // CameraControl.OperationCanceledException from ZoomControl and friends
  /OperationCanceledException/i,
  /camera (is )?(closed|closing)/i,
  /(session|camera) (was )?(stopped|cancell?ed)/i,
  /cancell?ed because/i,
];

export function classifyCameraError(message: string | undefined | null): CameraErrorKind {
  const text = message ?? '';
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(text)) ? 'transient' : 'fatal';
}
