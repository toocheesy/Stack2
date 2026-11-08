import { useEffect, useState } from 'react';

// Timing helpers for the board's moments (YC1, TT1, the last cards landing).

export interface Point {
  x: number;
  y: number;
}

/** The centre of an element on the page, or null before it is in the page. */
export function centreOf(el: Element | null | undefined): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** How far a moment has run: 0 while it starts, then one more for each of
 *  `times` (milliseconds from the start) that has passed. A new `key` starts
 *  it again; a null key means no moment, and reads 0. */
export function useMomentPhase(key: number | null, times: readonly number[]): number {
  // The phase is kept with the key it belongs to, so a new key reads 0 until
  // its own first timer fires.
  const [cur, setCur] = useState<{ key: number | null; phase: number }>({ key, phase: 0 });
  useEffect(() => {
    if (key === null) return;
    const timers = times.map((t, i) => setTimeout(() => setCur({ key, phase: i + 1 }), t));
    return () => timers.forEach(clearTimeout);
    // The times are one moment's constants; the key alone starts it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key !== null && cur.key === key ? cur.phase : 0;
}
