import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { RaceBar } from './pieces';

/** Your race bar (GB2): YOUR TURN in gold on your turn, otherwise WAITING FOR
 *  [name] while that opponent thinks or WAITING · [NAME]'S TURN; the gold
 *  bar; "You 120 / 300". */
export function YourBar({ label, yours, score, target }: { label: string; yours: boolean; score: number; target: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexShrink: 0, fontFamily: FONTS.sans }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: yours ? C.classicGold : C.muted.classic, whiteSpace: 'nowrap' }}>{label}</span>
      <RaceBar value={score} max={target} colour={C.classicGold} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink.classic, whiteSpace: 'nowrap' }}>You {score} / {target}</span>
    </div>
  );
}
