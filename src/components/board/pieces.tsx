import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode, Ref } from 'react';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { getTransition } from '../../config/motion';

// Small pieces shared by the game board (GB2) and Classic Setup (CS1).

/** The wordmark: STACKED in Abril Fatface at 0.04em, with the "A" in gold. */
export function Wordmark({ size }: { size: number }) {
  return (
    <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: size, letterSpacing: '0.04em', lineHeight: 1, color: C.ink.classic, flexShrink: 0 }}>
      ST<span style={{ color: C.classicGold }}>A</span>CKED
    </span>
  );
}

/** A 44 x 44 outlined icon button: the way back and the gear (QD1, GB2). */
export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button type="button" aria-label={label} onClick={onClick} whileTap={{ scale: 0.92 }} transition={getTransition('snappy')} style={{
      width: 44, height: 44, flexShrink: 0, borderRadius: 6, border: `1px solid ${C.line.classic}`, background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', color: C.ink.classic,
    }}>
      {children}
    </motion.button>
  );
}

export function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function Gear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  );
}

/** A race bar toward the target: an 8px track outlined in the line colour and
 *  open, so what it sits on shows through its empty part, filled in the
 *  runner's colour. The fill moves by transform; under reduce-motion it steps. */
export function RaceBar({ value, max, colour }: { value: number; max: number; colour: string }) {
  const calm = useReducedMotion();
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div style={{ flex: 1, height: 8, boxSizing: 'border-box', border: `1px solid ${C.line.classic}`, borderRadius: 4, overflow: 'hidden' }}>
      <motion.div
        initial={false}
        animate={{ scaleX: fraction }}
        transition={calm ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
        style={{ width: '100%', height: '100%', background: colour, transformOrigin: 'left center' }}
      />
    </div>
  );
}

/** A small tag: outlined (HAND, PICK) or solid with table-colour text (TABLE, PICKED). */
export function Tag({ solid, colour = C.ink.classic, children }: { solid?: boolean; colour?: string; children: ReactNode }) {
  return (
    <span style={{
      padding: '1px 5px', borderRadius: 3, fontFamily: FONTS.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.3, whiteSpace: 'nowrap',
      border: `1px solid ${colour}`, background: solid ? colour : 'transparent', color: solid ? C.classicTable : colour,
    }}>
      {children}
    </span>
  );
}

/** RESET (outlined in the text colour) and SUBMIT (gold; off in the muted outline). */
export function TextButton({ label, onClick, disabled, primary, wide, wrapRef }: {
  label: string; onClick: () => void; disabled?: boolean; primary?: boolean; wide?: boolean; wrapRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={wrapRef} style={{ display: 'flex' }}>
      <motion.button type="button" onClick={onClick} disabled={disabled} whileTap={disabled ? undefined : { scale: 0.97 }} transition={getTransition('snappy')} style={{
        height: 44, padding: wide ? '0 22px' : '0 16px', borderRadius: 6, fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
        cursor: disabled ? 'default' : 'pointer',
        border: primary ? (disabled ? `1px solid ${C.line.classic}` : 'none') : `1px solid ${C.ink.classic}`,
        background: primary && !disabled ? C.classicGold : 'transparent',
        color: primary ? (disabled ? C.muted.classic : C.classicTable) : C.ink.classic,
      }}>
        {label}
      </motion.button>
    </div>
  );
}

/** A dashed ghost where a staged card came from: "IN BASE", "IN COMBO 1". */
export function Ghost({ w, h, radius, label, fontSize, twoLines }: {
  w: number; h: number; radius: number; label: string; fontSize: number; twoLines?: boolean;
}) {
  const space = label.indexOf(' ');
  const lines = twoLines && space > 0 ? [label.slice(0, space), label.slice(space + 1)] : [label];
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, border: `1.5px dashed ${C.line.classic}`, boxSizing: 'border-box', flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      fontFamily: FONTS.sans, fontSize, fontWeight: 700, lineHeight: 1.2, color: C.muted.classic,
    }}>
      {lines.map((l) => <span key={l}>{l}</span>)}
    </div>
  );
}
