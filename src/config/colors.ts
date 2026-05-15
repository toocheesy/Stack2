/** Central color tokens — single source of truth.
 *  Every component references these, never raw hex. */
export const C = {
  // Brand palette (locked May 1, 2026)
  jade: '#065F46',
  tan: '#E8C577',
  brown: '#72571C',
  bgNearBlack: '#0A0A0A',

  slateBg: '#1E1E2E',
  board: '#252538',
  card: '#FFFFFF',
  // indigo / indigoHover — DEPRECATED. Phaser-era leftovers. Bundle A swaps
  // overlay CTA usage to brand jade/tan; tokens kept temporarily for any
  // residual reference. Schedule for removal.
  indigo: '#4F46E5',
  indigoHover: '#6366F1',
  amber: '#F59E0B',
  textPrimary: '#F1F1F3',
  textSecondary: '#8B8BA3',
  success: '#10B981',
  error: '#EF4444',
  divider: '#3A3A50',
  slotEmpty: '#4A4A5A',
  disabled: '#2A2A3D',
  disabledText: '#5A5A70',
  ruleText: '#C0C0D0',

  // Bot personality colors — locked palette per visual paint brief Section 7.
  // Re-aligned May 14: botNina #A78BFA → #DBEAFE (resolved Game Over drift),
  // botJett #FBBF24 → #8B5CF6 (Stacy May 6 inconsistency closed; teal #0D9488
  // and golden #FBBF24 both retired). Calvin / Rex updated to locked palette.
  botCalvin: '#3B82F6',
  botTalia: '#F472B6',
  botNina: '#DBEAFE',
  botMira: '#34D399',
  botJett: '#8B5CF6',
  botRex: '#DC2626',

  // Suit colors
  suitRed: '#DC2626',
  suitBlack: '#0F0F1A',
} as const;

export const SHADOWS = {
  cardRest: '0 2px 12px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.06)',
  cardSelected: '0 4px 20px rgba(79,70,229,0.35)',
  cardLifted: '0 8px 24px rgba(0,0,0,0.4)',
  comboReady: '0 0 12px rgba(79,70,229,0.2)',
  cardPeek: '0 8px 24px rgba(0,0,0,0.5)',
} as const;
