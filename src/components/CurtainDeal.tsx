import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { C } from '../config/colors';

// The move into Classic, DD2 Curtain Deal (D-007 rulings 40, 40a, 46; 880ms
// in all). The home screen leaves (HomeScreen's `leaving`: the card drops,
// the layers follow, the words fade) while a tangerine curtain drops from
// the top and covers it (160 to 420ms), a cobalt one drops over that (240 to
// 500ms) and Classic's green room over both (320 to 620ms). The green then
// fades out over the screen beneath (620 to 880ms, ease-out): Classic Setup
// or the game board, each on the same green, so it fades in on the green as
// DD2 draws it. The home and the two brand curtains go the moment the green
// has covered them. Under reduce-motion (phone B): two fades, 320ms in all,
// the home out over 160ms, then the green out over 180ms from 140ms. Only
// transform and opacity move. The layer takes every tap while it plays, and
// `onDone` fires when it ends.

export const CURTAIN_MS = 880;
export const CURTAIN_CALM_MS = 320;

// cubic-bezier(.3, .7, .2, 1): quick and settling.
const DROP: Transition = { duration: 0.26, ease: [0.3, 0.7, 0.2, 1] };
const FULL: CSSProperties = { position: 'absolute', inset: 0 };

export function CurtainDeal({ onDone, children }: { onDone: () => void; children: ReactNode }) {
  const calm = !!useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, calm ? CURTAIN_CALM_MS : CURTAIN_MS);
    return () => clearTimeout(timer);
  }, [calm, onDone]);

  if (calm) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
        <motion.div aria-hidden="true" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.14, duration: 0.18, ease: 'linear' }} style={{ ...FULL, background: C.ground.classic }} />
        <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.16, ease: 'linear' }} style={{ ...FULL, pointerEvents: 'none' }}>
          {children}
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, overflow: 'hidden' }}>
      <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.62, duration: 0 }} style={FULL}>
        <div style={{ ...FULL, pointerEvents: 'none' }}>{children}</div>
        <motion.div aria-hidden="true" initial={{ y: '-100%' }} animate={{ y: 0 }} transition={{ ...DROP, delay: 0.16 }} style={{ ...FULL, background: C.stackUpper }} />
        <motion.div aria-hidden="true" initial={{ y: '-100%' }} animate={{ y: 0 }} transition={{ ...DROP, delay: 0.24 }} style={{ ...FULL, background: C.stackLower }} />
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={{ y: '-100%', opacity: 1 }}
        animate={{ y: 0, opacity: 0 }}
        transition={{ y: { ...DROP, delay: 0.32, duration: 0.3 }, opacity: { delay: 0.62, duration: 0.26, ease: 'easeOut' } }}
        style={{ ...FULL, background: C.ground.classic }}
      />
    </div>
  );
}
