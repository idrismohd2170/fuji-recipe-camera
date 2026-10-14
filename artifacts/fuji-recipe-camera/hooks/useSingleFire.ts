import { useCallback, useRef } from 'react';

/**
 * Wraps an action so rapid repeat taps run it only once per `windowMs`.
 * Used for navigation (a double tap must not push two modals or navigate twice).
 */
export function useSingleFire(windowMs = 700) {
  const last = useRef(0);
  return useCallback(
    (action: () => void) => {
      const now = Date.now();
      if (now - last.current < windowMs) return;
      last.current = now;
      action();
    },
    [windowMs],
  );
}
