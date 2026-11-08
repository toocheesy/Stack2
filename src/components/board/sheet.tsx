import type { Difficulty, GameState, PlayerIndex } from '../../engine/types';
import { C, alpha } from '../../config/colors';

// What the plum sheets share (RE1p's round end, GO2's game over; D-007
// rulings 70 to 73): the dim over the table, the gold edge's glow, and each
// player's colour on plum.

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
