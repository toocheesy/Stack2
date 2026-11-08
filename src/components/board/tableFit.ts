import { TABLE_CARD_W } from '../Card';

// The table's layout numbers (GB2): cards at 54 x 76 with an 8px gap across
// and 10px between rows, inside 12px side padding, 50px above (the deck
// pill's row) and 10px below.
export const TABLE_CARD_H = 76;
export const TABLE_GAP_X = 8;
export const TABLE_GAP_Y = 10;
export const TABLE_PAD_TOP = 50;
export const TABLE_PAD_X = 12;
export const TABLE_PAD_BOTTOM = 10;
const MIN_SCALE = 0.55;

/** The largest scale, 1 at most, at which `n` table cards wrap into rows that
 *  fit a zone `w` wide and `h` tall (today's behaviour kept: rows wrap, the
 *  scale never goes above 1, and never below today's floor). */
export function tableFit(n: number, w: number, h: number): number {
  if (n === 0 || w <= 0 || h <= 0) return 1;
  for (let s = 1; s >= MIN_SCALE - 1e-9; s -= 0.05) {
    const cw = TABLE_CARD_W * s;
    const ch = TABLE_CARD_H * s;
    const cols = Math.max(1, Math.floor((w + TABLE_GAP_X) / (cw + TABLE_GAP_X)));
    const rows = Math.ceil(n / cols);
    if (rows * ch + (rows - 1) * TABLE_GAP_Y <= h) return Math.round(s * 100) / 100;
  }
  return MIN_SCALE;
}
