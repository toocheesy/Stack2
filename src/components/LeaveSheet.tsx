import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { CARD_GLOW, SHEET_DIM, cardMotion } from './board/sheet';

// Leaving a Classic game, QD1 Way Back phone A (D-007 rulings 78 and 80): the
// top bar's back arrow opens a plum card over the game dimmed by the table
// colour at 85%. Keep playing closes it; Leave game keeps the save and goes
// home. The game is paused while it is open (useGameController's pause).
// The dim takes every tap and does nothing with it.

interface Props {
  open: boolean;
  onKeepPlaying: () => void;
  onLeave: () => void;
}

export function LeaveSheet({ open, onKeepPlaying, onLeave }: Props) {
  const calm = !!useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="leave"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          style={{ position: 'fixed', inset: 0, background: SHEET_DIM, zIndex: 250 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-game-title"
            {...cardMotion(calm)}
            style={{
              // QD1 puts the card 250px down a 844px phone; a shorter phone keeps the same share of its height.
              position: 'absolute', left: 24, right: 24, top: 'min(250px, 29.6%)', boxSizing: 'border-box', padding: '26px 22px 22px',
              background: C.classicSheet, border: `2px solid ${C.classicGold}`, borderRadius: 18, boxShadow: CARD_GLOW,
              display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONTS.sans,
            }}
          >
            <h2 id="leave-game-title" style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 32, lineHeight: 1.1, color: C.classicSheetInk }}>
              Leave this game?
            </h2>
            <p style={{ margin: '0 0 10px', fontSize: 16, lineHeight: 1.45, color: C.classicSheetMuted }}>
              Your game is saved. Tap CONTINUE on the home screen to pick it up right where you left off.
            </p>
            <button type="button" onClick={onKeepPlaying} style={{
              width: '100%', height: 52, borderRadius: 8, border: 'none', background: C.classicGold, fontFamily: FONTS.sans,
              fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: C.classicTable, cursor: 'pointer',
            }}>
              Keep playing
            </button>
            <button type="button" onClick={onLeave} style={{
              width: '100%', height: 48, borderRadius: 8, border: `1.5px solid ${C.classicSheetInk}`, background: 'transparent', fontFamily: FONTS.sans,
              fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: C.classicSheetInk, cursor: 'pointer',
            }}>
              Leave game
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
