import type { Card } from '../engine/types';
import { CardComponent, type CardSize } from './Card';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';

// The locked card at its four sizes on Classic's room colour (D-007 release 1).
const SIZES: { size: CardSize; label: string }[] = [
  { size: 'full', label: 'Full · 180 × 252' },
  { size: 'hand', label: 'Hand · 72 × 100' },
  { size: 'table', label: 'Table · 54 × 76' },
  { size: 'slot', label: 'Capture tray · 40 × 56' },
];
const QUEEN_OF_HEARTS: Card = { id: 'QH', rank: 'Q', suit: 'hearts', value: 12 };
const FOUR_OF_SPADES: Card = { id: '4S', rank: '4', suit: 'spades', value: 4 };

export function CardAtomTest() {
  return (
    <div style={{
      width: '100vw', height: '100dvh', background: C.ground.classic, color: C.muted.classic,
      fontFamily: FONTS.sans, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
      justifyContent: 'center', alignContent: 'center', gap: 32, padding: 24, overflow: 'auto',
    }}>
      {SIZES.map(({ size, label }) => (
        <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <CardComponent card={QUEEN_OF_HEARTS} size={size} />
            <CardComponent card={FOUR_OF_SPADES} size={size} />
            {size === 'slot' && <CardComponent card={FOUR_OF_SPADES} size={size} faceDown />}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
