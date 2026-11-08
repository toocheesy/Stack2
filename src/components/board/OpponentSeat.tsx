import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { PopNumber, RaceBar } from './pieces';

/** An opponent's seat (GB2): its name, score over the target, the cards it
 *  holds (or THINKING ···) and its race bar, all in its own colour. The edge
 *  thickens to 2px on its turn. The score pops and the bar grows when points
 *  land (TT1). */
export function OpponentSeat({ name, colour, score, target, cardsHeld, thinking, active, seatRef }: {
  name: string;
  colour: string;
  score: number;
  target: number;
  cardsHeld: number;
  thinking: boolean;
  active: boolean;
  seatRef: (el: HTMLDivElement | null) => void;
}) {
  const held = Math.max(0, cardsHeld);
  return (
    <div ref={seatRef} style={{
      flex: 1, minWidth: 0, height: 88, boxSizing: 'border-box', padding: '8px 10px', background: C.surface.classic,
      border: `${active ? 2 : 1}px solid ${colour}`, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: FONTS.sans,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 18, lineHeight: 1.2, color: colour, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink.classic, whiteSpace: 'nowrap' }}><PopNumber value={score} /> / {target}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {Array.from({ length: held }, (_, i) => (
          <div key={i} style={{ width: 15, height: 21, borderRadius: 3, background: C.ground.classic, border: `1.5px solid ${colour}`, boxSizing: 'border-box', flexShrink: 0 }} />
        ))}
        {thinking
          ? <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: colour, whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 }}>THINKING ···</span>
          : <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: C.muted.classic, whiteSpace: 'nowrap' }}>{held} {held === 1 ? 'CARD' : 'CARDS'}</span>}
      </div>
      <div style={{ display: 'flex' }}>
        <RaceBar value={score} max={target} colour={colour} />
      </div>
    </div>
  );
}
