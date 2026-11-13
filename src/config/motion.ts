import type { Transition } from 'motion/react';

const presets = {
  /** Card selection, button press, turn indicator, active-state confirmations */
  snappy: { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 },
} satisfies Record<string, Transition>;

// ─── Reduced motion support ─────────────────────────

const prefersReduced =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const instant: Transition = { duration: 0 };

/**
 * Returns the named transition preset, or an instant transition
 * when the user prefers reduced motion.
 */
export function getTransition(preset: keyof typeof presets): Transition {
  if (prefersReduced) return instant;
  return presets[preset];
}
