"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `onFire` after `delayMs` when `enabled` is true, but guarantees
 * at most one in-flight timer is executing at a time.
 *
 * Useful for AI turns where we want a small delay but must prevent
 * double-triggering when React re-renders/state changes quickly.
 */
export function useDelayedSingleFlight({
  enabled,
  delayMs,
  onFire,
}: {
  enabled: boolean;
  delayMs: number;
  onFire: () => void;
}) {
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    const t = setTimeout(() => {
      try {
        onFireRef.current();
      } finally {
        inFlightRef.current = false;
      }
    }, delayMs);

    return () => {
      clearTimeout(t);
      inFlightRef.current = false;
    };
  }, [enabled, delayMs]);
}

