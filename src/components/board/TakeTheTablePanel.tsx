import type { Card } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { pointsBreakdown, takeTheTableSentence, worthWords } from './words';

/** The Take the Table panel (GB2 phone B, RULES.md Law 10): in the last hand,
 *  who is in line to take the table, what it is worth, and the points by
 *  card. Its edge and label take the colour of the player in line: gold for
 *  you, an opponent's colour for an opponent. */
export function TakeTheTablePanel({ inLine, colour, others, cards, points }: {
  inLine: string;
  colour: string;
  /** The other two players' names, in turn order from the current player. */
  others: readonly string[];
  cards: readonly Card[];
  points: number;
}) {
  return (
    <div style={{
      marginTop: 12, flexShrink: 0, boxSizing: 'border-box', padding: '14px 16px', background: C.surface.classic,
      border: `1px solid ${colour}`, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: FONTS.sans,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: colour }}>TAKE THE TABLE</span>
      <div style={{ fontSize: 13, color: C.muted.classic }}>In line to take it now</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 26, lineHeight: 1.1, color: C.ink.classic }}>{inLine}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink.classic, whiteSpace: 'nowrap' }}>{worthWords(cards.length, points)}</span>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.4, color: C.muted.classic }}>{takeTheTableSentence(inLine, others)}</div>
      {cards.length > 0 && <div style={{ fontSize: 12, lineHeight: 1.4, color: C.muted.classic }}>{pointsBreakdown(cards)}</div>}
    </div>
  );
}
