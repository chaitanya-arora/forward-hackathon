"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** useLayoutEffect warns during SSR; fall back to useEffect on the server. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Animates a number, with correctness prioritised over the effect:
 *
 * - Initial state is the real `value`, so the server-rendered HTML always
 *   contains the true number. If JS never runs, the correct score still shows —
 *   a report that renders "0/100" because a bundle failed would be far worse
 *   than one that simply doesn't animate.
 * - A setTimeout guarantees the exact final value lands even if
 *   requestAnimationFrame is paused, which happens in backgrounded tabs.
 * - Live updates continue from the number currently on screen rather than
 *   restarting at zero.
 */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const mounted = useRef(false);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useIsoLayoutEffect(() => {
    // First client pass counts up from zero; later passes continue from
    // wherever the number got to.
    const from = mounted.current ? shownRef.current : 0;
    mounted.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || from === value) {
      setShown(value);
      return;
    }

    setShown(from);
    const start = performance.now();
    const delta = value - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — quick off the mark, settles gently on the final number.
      setShown(Math.round(from + delta * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    const settle = setTimeout(() => setShown(value), duration + 120);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      clearTimeout(settle);
    };
  }, [value, duration]);

  return <>{shown}</>;
}
