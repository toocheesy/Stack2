import { motion, useReducedMotion } from 'motion/react';
import type { TakeTheTableMoment } from '../game/useGameController';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';

// Take the Table, TT1 Homecoming (D-007 ruling 75). The moment itself plays
// on the board: the table's cards fly to the taker (TableZone), the scores
// swap and the bars grow (the seats and your bar), and this banner rises over
// the Take the Table panel. The file keeps its name; "jackpot" is a code-only
// word (RULES.md Law 10: Take the Table).

/** The moment's data, under the name App.tsx has passed to GameView since before release 2. */
export type JackpotDisplay = TakeTheTableMoment;

/** "You took the table" / "Rex took the table" with "+40 · 5 cards", in the
 *  taker's colour: gold only when it is you. It scales up from 90%, holds, and
 *  lifts away as it fades; under reduce-motion it only fades. */
export function TakeTheTableBanner({ name, colour, points, cardCount }: {
  name: string;
  colour: string;
  points: number;
  cardCount: number;
}) {
  const calm = useReducedMotion();
  return (
    <motion.div
      role="status"
      initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={calm ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'absolute', left: 14, right: 14, top: 12, zIndex: 6, boxSizing: 'border-box', padding: '16px 14px',
        background: C.surface.classic, border: `2px solid ${colour}`, borderRadius: 12, textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 4, fontFamily: FONTS.sans,
      }}
    >
      <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 28, lineHeight: 1.1, color: colour }}>{name} took the table</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: C.ink.classic }}>
        <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 26 }}>+{points}</span> · {cardCount} {cardCount === 1 ? 'card' : 'cards'}
      </span>
    </motion.div>
  );
}
