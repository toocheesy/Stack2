import { useLayoutEffect, useRef, useState, type Ref } from 'react';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { ChevronLeft, Gear, IconButton, Wordmark } from './pieces';

/** GB2's top bar with QD1's way back: the 44 x 44 back arrow, the wordmark at
 *  20px, MODE · TARGET · R[round] · H[hand], and the gear. On a phone too
 *  narrow for the mode line in one row (375), it takes two rows at the same
 *  size instead of losing its end. */
export function TopBar({ mode, detail, round, hand, canLeave, onLeave, onSettings, barRef }: {
  /** "CLASSIC". */
  mode: string;
  /** The target score. */
  detail: string;
  round: number;
  hand: number;
  canLeave: boolean;
  onLeave: () => void;
  onSettings: () => void;
  barRef: Ref<HTMLDivElement>;
}) {
  const slotRef = useRef<HTMLSpanElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [twoRows, setTwoRows] = useState(false);
  const first = `${mode} · ${detail}`;
  const second = `R${round} · H${hand}`;
  const oneRow = `${first} · ${second}`;

  // The hidden probe holds the one-row line at full width; when it is wider
  // than the slot, the line takes two rows.
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const probe = probeRef.current;
    if (!slot || !probe) return;
    const measure = () => setTwoRows(probe.offsetWidth > slot.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [oneRow]);

  return (
    <div ref={barRef} style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {canLeave
        ? <IconButton label="Leave game" onClick={onLeave}><ChevronLeft /></IconButton>
        : <div style={{ width: 44, flexShrink: 0 }} />}
      <Wordmark size={20} />
      <span ref={slotRef} style={{
        flex: '1 1 auto', minWidth: 0, position: 'relative', textAlign: 'center', fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.1em', lineHeight: 1.2, color: C.muted.classic, whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
        <span ref={probeRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{oneRow}</span>
        {twoRows
          ? <><span style={{ display: 'block' }}>{first}</span><span style={{ display: 'block' }}>{second}</span></>
          : <span>{oneRow}</span>}
      </span>
      <IconButton label="Settings" onClick={onSettings}><Gear /></IconButton>
    </div>
  );
}
