import type { Transition } from 'motion/react';

// ─── Spring presets ─────────────────────────────────

export const spring = {
  /** Card selection, button press, turn indicator, active-state confirmations */
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 },
  /** Card dealing, card placement into slot, score number scale pulse */
  soft: { type: 'spring' as const, stiffness: 260, damping: 24, mass: 1 },
  /** Jackpot celebration pulses, score bar bounce — visible overshoot for big moments */
  wobble: { type: 'spring' as const, stiffness: 200, damping: 14, mass: 1 },
} as const;

// ─── Tween presets ──────────────────────────────────

export const tween = {
  /** Hover, focus feedback */
  micro: { duration: 0.15, ease: 'easeOut' as const },
  /** Color changes, border transitions */
  default: { duration: 0.2, ease: 'easeOut' as const },
  /** Turn swap, screen transitions */
  state: { duration: 0.3, ease: 'easeOut' as const },
} as const;

// ─── Reduced motion support ─────────────────────────

const prefersReduced =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const instant: Transition = { duration: 0 };

type PresetKey = keyof typeof spring | keyof typeof tween;

const presetMap: Record<PresetKey, Transition> = {
  snappy: spring.snappy,
  soft: spring.soft,
  wobble: spring.wobble,
  micro: tween.micro,
  default: tween.default,
  state: tween.state,
};

/**
 * Returns the named transition preset, or an instant transition
 * when the user prefers reduced motion.
 */
export function getTransition(preset: PresetKey): Transition {
  if (prefersReduced) return instant;
  return presetMap[preset];
}
