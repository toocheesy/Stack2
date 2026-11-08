/** STACKED v2 colour tokens, copied from design/system/tokens.json (D-007 release 1).
 *  One home for every colour: no other file under src holds a colour value
 *  (tests/config/oneColourHome.test.ts). The seven role tokens carry both
 *  themes, brand (Citrus Press) and classic (Emerald Noir); the rest are
 *  named colours. A token nothing uses yet is left out until the release
 *  that uses it. Use the roles by name, never by hex. */
export const C = {
  // Role tokens, one value per theme.
  ground:       { brand: '#FFF4B8', classic: '#064428' },
  surface:      { brand: '#1E2A44', classic: '#033019' },
  ink:          { brand: '#1E2A44', classic: '#F0FFF6' },
  inkOnSurface: { brand: '#FFF4B8', classic: '#F0FFF6' },
  muted:        { brand: '#4A5470', classic: '#B8F0D2' },
  accent:       { brand: '#1E5BD8', classic: '#FFC53A' },
  line:         { brand: '#6B7390', classic: '#B8F0D2' },

  // Classic's named colours. Gold is the player's and the board's; text on it is the table colour.
  classicGold: '#FFC53A',
  classicGoldDeep: '#A36A00',
  classicTable: '#033019',

  // Classic's round end sheet and game over card (RE1p, GO2; D-007 rulings 70
  // to 73): plum, with its own text, labels and lines, and the gold glow
  // above its gold edge.
  classicSheet: '#5B2470',
  classicSheetDeep: '#44195A',
  classicSheetInk: '#FBF1FF',
  classicSheetMuted: '#E6D3F2',
  classicSheetLine: '#C9A6DD',
  classicSheetGlow: '#FFC53A40',

  // The card, the same in every mode.
  cardFace: '#FFFAF6',
  cardRing: '#FFC53A',
  suitDark: '#0A1A12',
  suitRed: '#D9241C',

  // Bot colours. A bot's colour shows only on its own things; no bot owns one yet.
  botAzure: '#5CC2FF',
  botWisteria: '#BE96FF',
  // The wisteria bot's colour on the plum sheet only; everywhere else it stays botWisteria.
  botWisteriaOnSheet: '#D9C2FF',
} as const;

/** Drop shadows. cardFull is tokens.json's card-full shadow without its
 *  ring, which Card.tsx adds from cardRing at the size's ring width; cardHand
 *  and cardTable are the hand and table cards' shadows as GB2 draws them, and
 *  bubble is an opponent's speech bubble's (GB2, release 2). The capture-slot
 *  card has no shadow. */
export const SHADOWS = {
  cardFull: '0 18px 40px #033019e6',
  cardHand: '0 10px 18px #021F10E6',
  cardTable: '0 6px 12px #021F10D9',
  bubble: '0 6px 14px #021F10D9',
} as const;

/** A colour at an alpha, as an eight-digit hex: alpha(C.ink.classic, 0.5). */
export function alpha(hex: string, a: number): string {
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}
