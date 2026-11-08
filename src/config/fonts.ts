/** STACKED v2 type families (design/system/tokens.json, type.families).
 *  Their other home is index.css's font variables; no other file spells a
 *  font name. Abril Fatface: the wordmark, screen and overlay titles and
 *  the card's letters, always at 400. Josefin Sans: everything else, at
 *  400, 600 or 700. */
export const FONTS = {
  display: '"Abril Fatface", Georgia, serif',
  sans: '"Josefin Sans", system-ui, sans-serif',
} as const;
