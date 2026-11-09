import type { TargetAndTransition, Transition } from 'motion/react';
import type { Difficulty, GameState, PlayerIndex } from '../../engine/types';
import { C, alpha } from '../../config/colors';

// What the plum sheets share (RE1p's round end, GO2's game over, and the
// pauses: QD1's leave sheet, ST3's in-game Settings, TU2's tutorial; D-007
// rulings 70 to 73, 78 to 82, 88): the dim over the table, the gold edge's
// glow, each player's colour on plum, and how a centred card opens and closes.

/** A player's colour on the sheets: gold for you, azure for Nina, pale
 *  wisteria for Rex (bot-wisteria-on-sheet), the line colour for Calvin and
 *  Jett for now (ruling 94). */
export function sheetColourOf(player: PlayerIndex, state: GameState): string {
  if (player === 0) return C.classicGold;
  const d: Difficulty = player === 1 ? state.settings.bot1Personality : state.settings.bot2Personality;
  if (d === 'intermediate') return C.botAzure;
  if (d === 'advanced') return C.botWisteriaOnSheet;
  return C.line.classic;
}

/** The table under a sheet, dimmed by the table colour at 85%. */
export const SHEET_DIM = alpha(C.classicTable, 0.85);

/** Above the sheet's 2px gold edge: a 6px ring of gold at 20% and the glow. */
export const SHEET_GLOW = `0 0 0 6px ${alpha(C.classicGold, 0.2)}, 0 -12px 40px ${C.classicSheetGlow}`;

/** Around a centred plum card and the tutorial's sheet (QD1, ST3, TU2): the
 *  same 6px ring of gold at 20%, with the glow all round. */
export const CARD_GLOW = `0 0 0 6px ${alpha(C.classicGold, 0.2)}, 0 0 40px ${C.classicSheetGlow}`;

/** How a centred plum card opens and closes (ST3's notes; QD1's card follows
 *  them): it fades in over 200 ms as it settles from 94%, 260 ms on
 *  cubic-bezier(0.34, 1.25, 0.64, 1); it closes with a 160 ms fade and shrink.
 *  Under reduce-motion it only fades, 200 ms. */
export function cardMotion(calm: boolean): {
  initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition;
} {
  if (calm) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.2, ease: 'linear' } },
      transition: { duration: 0.2, ease: 'linear' },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94, transition: { duration: 0.16, ease: 'easeIn' } },
    transition: { opacity: { duration: 0.2, ease: 'linear' }, scale: { duration: 0.26, ease: [0.34, 1.25, 0.64, 1] } },
  };
}
