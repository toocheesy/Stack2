import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { C, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';
import { cardMotion } from './board/sheet';

// Start a new game?, QD1 Way Back phone B (D-007 rulings 80, 104): QUICK
// MATCH with a saved Classic game asks first. Over the home screen dimmed
// navy at 78%, a lemon card with a navy edge: the cobalt QUICK MATCH label,
// "Start a new game?", "Your saved game will end.", Keep playing (navy,
// closes it and stays home) and New game (outlined, ends the saved game and
// starts the Quick Match with DD2). The dim takes every tap and does nothing
// with it. Opens and closes with ST3's card timings; calm fades only.

// The home dimmed by navy at 78% (QD1 phone B; HomeSettingsSheet has the same).
const HOME_DIM = alpha(C.surface.brand, 0.78);

interface Props {
  open: boolean;
  onKeepPlaying: () => void;
  onNewGame: () => void;
}

export function NewGameSheet({ open, onKeepPlaying, onNewGame }: Props) {
  const calm = !!useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="new-game"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          style={{ position: 'fixed', inset: 0, background: HOME_DIM, zIndex: 250 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-game-title"
            {...cardMotion(calm)}
            style={{
              // QD1 puts the card 268px down a 844px phone; a shorter phone keeps the same share of its height.
              position: 'absolute', left: 30, right: 30, top: 'min(268px, 31.8%)', boxSizing: 'border-box', padding: '26px 22px 22px',
              background: C.ground.brand, border: `1.5px solid ${C.ink.brand}`, borderRadius: 22, boxShadow: `0 18px 40px ${alpha(C.ink.brand, 0.8)}`,
              display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONTS.sans,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: C.accent.brand }}>QUICK MATCH</div>
            <h2 id="new-game-title" style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 32, lineHeight: 1.1, color: C.ink.brand }}>
              Start a new game?
            </h2>
            <p style={{ margin: '0 0 10px', fontSize: 16, lineHeight: 1.45, color: C.muted.brand }}>Your saved game will end.</p>
            <button type="button" onClick={onKeepPlaying} style={{
              width: '100%', height: 52, borderRadius: 8, border: 'none', background: C.surface.brand, fontFamily: FONTS.sans,
              fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: C.inkOnSurface.brand, cursor: 'pointer',
            }}>
              Keep playing
            </button>
            <button type="button" onClick={onNewGame} style={{
              width: '100%', height: 48, borderRadius: 8, border: `1.5px solid ${C.ink.brand}`, background: 'transparent', fontFamily: FONTS.sans,
              fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: C.ink.brand, cursor: 'pointer',
            }}>
              New game
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
