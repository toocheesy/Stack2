import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { Card } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { getTransition } from '../../config/motion';
import { CardComponent } from '../Card';
import { centreOf, type Point } from './moments';
import { overlap } from './tableFit';

// Small pieces shared by the game board (GB2), its moments, the sheets and Classic Setup (CS1).

/** A still stack of capture-slot cards, overlapped (RE1p's best capture row). */
export function CardStack({ cards }: { cards: readonly Card[] }) {
  const o = overlap(cards.length);
  return (
    <div style={{ display: 'flex', padding: 2, flexShrink: 0 }}>
      {cards.map((c, i) => (
        <div key={c.id} style={{ marginLeft: i > 0 ? -o : 0, position: 'relative', zIndex: i }}>
          <CardComponent card={c} size="slot" />
        </div>
      ))}
    </div>
  );
}

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

/** A race bar toward the target: a track outlined in the line colour and
 *  open, so what it sits on shows through its empty part, filled in the
 *  runner's colour. The fill grows by transform (TT1: 420 ms); under
 *  reduce-motion it steps. */
export function RaceBar({ value, max, colour, height = 8, track = C.line.classic }: {
  value: number; max: number; colour: string; height?: number; track?: string;
}) {
  const calm = useReducedMotion();
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div style={{ flex: 1, height, boxSizing: 'border-box', border: `1px solid ${track}`, borderRadius: height / 2, overflow: 'hidden' }}>
      <motion.div
        initial={false}
        animate={{ scaleX: fraction }}
        transition={calm ? { duration: 0 } : { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ width: '100%', height: '100%', background: colour, transformOrigin: 'left center' }}
      />
    </div>
  );
}

/** A number that swaps with a pop when it changes: the new value lands from
 *  160% as the old fades beneath it (YC1, TT1). Under reduce-motion the two
 *  crossfade. */
export function PopNumber({ value }: { value: number }) {
  const calm = useReducedMotion();
  return (
    <span style={{ display: 'inline-grid' }}>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={calm ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: calm ? 0.16 : 0.22, ease: 'easeOut' }}
          style={{ gridArea: '1 / 1', display: 'inline-block' }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A small tag: outlined (HAND, PICK) or solid with table-colour text (TABLE, PICKED). */
export function Tag({ solid, children }: { solid?: boolean; children: ReactNode }) {
  const colour = C.ink.classic;
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

/** A dashed ghost where a staged card came from: "IN BASE", "IN COMBO 1".
 *  With `fade`, it fades away over that many seconds (YC1's tray chrome). */
export function Ghost({ w, h, radius, label, fontSize, twoLines, fade }: {
  w: number; h: number; radius: number; label: string; fontSize: number; twoLines?: boolean; fade?: number;
}) {
  const space = label.indexOf(' ');
  const lines = twoLines && space > 0 ? [label.slice(0, space), label.slice(space + 1)] : [label];
  return (
    <motion.div animate={{ opacity: fade ? 0 : 1 }} transition={{ duration: fade ?? 0, ease: 'linear' }} style={{
      width: w, height: h, borderRadius: radius, border: `1.5px dashed ${C.line.classic}`, boxSizing: 'border-box', flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      fontFamily: FONTS.sans, fontSize, fontWeight: 700, lineHeight: 1.2, color: C.muted.classic,
    }}>
      {lines.map((l) => <span key={l}>{l}</span>)}
    </motion.div>
  );
}

/** Something that fades out when `out` is set: a moment's chrome. */
export function Fade({ out, duration, delay = 0, style, children }: {
  out: boolean; duration: number; delay?: number; style?: CSSProperties; children?: ReactNode;
}) {
  return (
    <motion.div animate={{ opacity: out ? 0 : 1 }} transition={{ duration, delay, ease: 'linear' }} style={style}>
      {children}
    </motion.div>
  );
}

/** How a card flies: to where `target` says at the moment it starts, after
 *  `delay`, over `duration` (seconds), hopping up `hop` px and growing to
 *  `grow` first, then tilting by `rotate` and shrinking to `shrink` as it
 *  lands and fades. Under reduce-motion it only fades out, over `calmDuration`. */
export interface Flight {
  target: () => Point | null;
  delay: number;
  duration: number;
  hop: number;
  grow: number;
  shrink: number;
  rotate: number;
  calmDuration: number;
}

/** A card on its way to a seat or a bar (YC1, TT1). Its contents are the card itself. */
export function FlyingCard({ flight, children }: { flight: Flight; children: ReactNode }) {
  const calm = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [delta, setDelta] = useState<Point | null>(null);

  useLayoutEffect(() => {
    const from = centreOf(ref.current);
    const to = flight.target();
    setDelta(from && to ? { x: to.x - from.x, y: to.y - from.y } : { x: 0, y: 0 });
    // Measured once, as the flight starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ease: [number, number, number, number] = [0.5, 0, 0.2, 1];
  const leg = { duration: flight.duration, delay: flight.delay, ease };
  return (
    <motion.div
      ref={ref}
      animate={delta
        ? (calm
          ? { opacity: 0 }
          : { x: delta.x, y: [0, -flight.hop, delta.y], scale: [1, flight.grow, flight.shrink], rotate: flight.rotate, opacity: [1, 1, 0] })
        : undefined}
      transition={calm
        ? { duration: flight.calmDuration, ease: 'linear' }
        : { ...leg, y: { ...leg, times: [0, 0.2, 1] }, scale: { ...leg, times: [0, 0.2, 1] }, opacity: { ...leg, times: [0, 0.85, 1] } }}
      style={{ position: 'relative', zIndex: 5, flexShrink: 0 }}
    >
      {children}
    </motion.div>
  );
}

/** A card landing where it now lies, from where `from` says (your hand or
 *  an opponent's seat), after `delay` seconds: the last cards (RULES.md Law 8,
 *  ruling 44). Under reduce-motion it fades in. */
export function LandingCard({ from, delay, children }: { from: () => Point | null; delay: number; children: ReactNode }) {
  const calm = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState<Point | null>(null);

  useLayoutEffect(() => {
    const here = centreOf(ref.current);
    const f = from();
    setStart(here && f ? { x: f.x - here.x, y: f.y - here.y } : { x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={start ? (calm ? { opacity: 1 } : { x: [start.x, 0], y: [start.y, 0], scale: [0.8, 1], opacity: [1, 1] }) : undefined}
      transition={calm ? { duration: 0.2, delay, ease: 'linear' } : { duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ position: 'relative', zIndex: 3, flexShrink: 0 }}
    >
      {children}
    </motion.div>
  );
}
