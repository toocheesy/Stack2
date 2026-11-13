import type { Ref } from 'react';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { PopNumber, RaceBar } from './pieces';

/** Your race bar (GB2): YOUR TURN in gold on your turn, otherwise WAITING FOR
 *  [name] while that opponent thinks or WAITING · [NAME]'S TURN; the gold
 *  bar; "You 120 / 300". The score pops and the bar grows when points land
 *  (YC1, TT1). */
export function YourBar({ label, yours, score, target, compact, barRef, scoreRef }: {
  label: string;
  yours: boolean;
  score: number;
  target: number;
  /** A short screen (ruling 99): less room above. */
  compact?: boolean;
  barRef?: Ref<HTMLDivElement>;
  scoreRef?: Ref<HTMLSpanElement>;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: compact ? 6 : 10, flexShrink: 0, fontFamily: FONTS.sans }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: yours ? C.classicGold : C.muted.classic, whiteSpace: 'nowrap' }}>{label}</span>
      <div ref={barRef} style={{ flex: 1, display: 'flex' }}>
        <RaceBar value={score} max={target} colour={C.classicGold} />
      </div>
      <span ref={scoreRef} style={{ fontSize: 13, fontWeight: 700, color: C.ink.classic, whiteSpace: 'nowrap' }}>
        You <PopNumber value={score} /> / {target}
      </span>
    </div>
  );
}
