import { Fragment, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RANK_VALUES, type Card, type Combination } from '../engine/types';
import { stagedPoints } from '../game/useGameController';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { CaptureTray } from './board/CaptureTray';
import { CARD_GLOW, SHEET_DIM } from './board/sheet';

// The tutorial, TU2 Plum Coach (D-007 rulings 79 and 80; S-031): a plum sheet
// with the gold edge and glow, docked to the top or bottom edge away from the
// part it talks about, over the table dimmed by the table colour at 85% with
// a spotlight on the part. The spotlight doesn't travel: the old light fades
// out as the new one fades in. Steps 3 to 6 lay a sample capture over the
// tray; it is a picture only, and the game underneath is never touched. It
// opens only from the in-game Settings, and the game is paused while it is
// open.

export interface TutorialMark {
  title: string;
  copy: string;
  /** The part lit: one element, or several whose boxes are joined (HAND and TABLE: the BASE and COMBO 1 columns). */
  refs: RefObject<HTMLElement | null>[];
  /** Where the sheet docks, away from the part. */
  side: 'top' | 'bottom';
  /** The sample capture lies over the tray on this step. */
  sample?: boolean;
}

interface Props {
  visible: boolean;
  /** Zero-based; the sheet says STEP {currentStep + 1} OF {totalSteps}. */
  currentStep: number;
  totalSteps: number;
  marks: TutorialMark[];
  /** The tray, where the sample capture lies. */
  trayRef: RefObject<HTMLElement | null>;
  /** A short screen (ruling 99): the sample tray takes the board's tighter gaps. */
  compact?: boolean;
  onNext(): void;
  onPrev(): void;
  onSkip(): void;
  onJump(step: number): void;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The light sits 6px outside the part, with a 3px gold edge outside that (TU2). */
const HOLE_PAD = 6;
const EDGE = 3;
const SHEET_H = 272;

/** TU2's sample capture: 10♦ from your hand as the base; 6♣ + 4♥ from the table in COMBO 1; +20 so far. */
function sampleCard(id: string, rank: Card['rank'], suit: Card['suit']): Card {
  return { id, rank, suit, value: RANK_VALUES[rank] };
}
const SAMPLE: Combination = {
  base: sampleCard('10D', '10', 'diamonds'),
  combo1: [
    { card: sampleCard('6C', '6', 'clubs'), source: 'board' },
    { card: sampleCard('4H', '4', 'hearts'), source: 'board' },
  ],
  combo2: [],
  combo3: [],
};
const SAMPLE_POINTS = stagedPoints(SAMPLE);
const SAMPLE_VALID = { combo1: true, combo2: false, combo3: false };
const nothing = () => {};

function rectOf(el: Element | null | undefined): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function unionOf(refs: RefObject<HTMLElement | null>[]): Rect | null {
  let u: Rect | null = null;
  for (const ref of refs) {
    const r = rectOf(ref.current);
    if (!r) continue;
    u = u ? { left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) } : r;
  }
  return u;
}

// A polygon over the whole screen with a rectangular hole: the outline, then
// a seam down to the hole, traced the other way round (TU2's clip-path).
function holePath(w: number, h: number, r: Rect): string {
  const x1 = r.left - HOLE_PAD, y1 = r.top - HOLE_PAD, x2 = r.right + HOLE_PAD, y2 = r.bottom + HOLE_PAD;
  return `polygon(0px ${h}px, 0px 0px, ${w}px 0px, ${w}px ${h}px, ${x1}px ${h}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x1}px ${h}px)`;
}

// The gold edge: a 3px frame just outside the hole.
function edgePath(r: Rect): string {
  const x1 = r.left - HOLE_PAD, y1 = r.top - HOLE_PAD, x2 = r.right + HOLE_PAD, y2 = r.bottom + HOLE_PAD;
  const ox1 = x1 - EDGE, oy1 = y1 - EDGE, ox2 = x2 + EDGE, oy2 = y2 + EDGE;
  return `polygon(${ox1}px ${oy2}px, ${ox1}px ${oy1}px, ${ox2}px ${oy1}px, ${ox2}px ${oy2}px, ${x1}px ${oy2}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x1}px ${oy2}px)`;
}

export function TutorialOverlay({ visible, currentStep, totalSteps, marks, trayRef, compact, onNext, onPrev, onSkip, onJump }: Props) {
  const calm = !!useReducedMotion();
  const [rects, setRects] = useState<(Rect | null)[]>([]);
  const [trayRect, setTrayRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 390, h: 844 });
  const sampleSlotRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Measure every part before the first paint when the tutorial opens and on
  // each step, again over the next two frames (the ghost tray that opens with
  // the tutorial shifts the layout), and on resize.
  useLayoutEffect(() => {
    if (!visible) return;
    const measure = () => {
      setRects(marks.map((m) => unionOf(m.refs)));
      setTrayRect(rectOf(trayRef.current));
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    measure();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measure();
      raf2 = requestAnimationFrame(measure);
    });
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [visible, currentStep, marks, trayRef]);

  const mark = marks[currentStep];
  if (!mark) return null;
  const side = mark.side;
  const isLast = currentStep === totalSteps - 1;
  const measured = rects.length > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="tutorial"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: 'linear' }}
          style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'auto', overflow: 'hidden', fontFamily: FONTS.sans }}
        >
          {/* The sample capture over the tray (steps 3 to 6), under the lights so only the lit part shows in full. */}
          <AnimatePresence>
            {mark.sample && trayRect && (
              <motion.div
                key="sample"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: 'linear' }}
                style={{ position: 'absolute', left: trayRect.left, top: trayRect.top, width: trayRect.right - trayRect.left, zIndex: 1, background: C.ground.classic, pointerEvents: 'none' }}
              >
                <CaptureTray
                  mode="build"
                  compact={compact}
                  build={SAMPLE}
                  baseSide="hand"
                  valid={SAMPLE_VALID}
                  canSubmit
                  points={SAMPLE_POINTS}
                  ghost={false}
                  hoveredSlot={null}
                  onRemove={nothing}
                  onReset={nothing}
                  onSubmit={nothing}
                  slotRefs={sampleSlotRefs}
                  submitWrapRef={null}
                  resetWrapRef={null}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* The lights: one scrim with a hole per part, the lit one shown; they cross-fade. */}
          {!measured && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SHEET_DIM, zIndex: 2 }} />}
          {marks.map((m, i) => {
            const r = rects[i];
            if (!r) return null;
            const lit = i === currentStep;
            const fade = { duration: 0.28, ease: 'easeInOut' as const };
            return (
              <Fragment key={m.title}>
                <motion.div aria-hidden="true" initial={false} animate={{ opacity: lit ? 1 : 0 }} transition={fade}
                  style={{ position: 'absolute', inset: 0, background: SHEET_DIM, clipPath: holePath(viewport.w, viewport.h, r), zIndex: 2, pointerEvents: 'none' }} />
                <motion.div aria-hidden="true" initial={false} animate={{ opacity: lit ? 1 : 0 }} transition={fade}
                  style={{ position: 'absolute', inset: 0, background: C.classicGold, clipPath: edgePath(r), zIndex: 3, pointerEvents: 'none' }} />
              </Fragment>
            );
          })}

          {/* The sheet, docked away from the part. A side change slides the old
              sheet off its edge and the new one in from its own; on the same
              side the words cross-fade. Under reduce-motion the sheets fade in place. */}
          <AnimatePresence initial={false}>
            <motion.section
              key={side}
              aria-label="Tutorial"
              initial={calm ? { opacity: 0 } : { y: side === 'top' ? '-110%' : '110%' }}
              animate={calm ? { opacity: 1 } : { y: 0 }}
              exit={calm
                ? { opacity: 0, transition: { duration: 0.2, ease: 'linear' } }
                : { y: side === 'top' ? '-110%' : '110%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={calm ? { duration: 0.2, ease: 'linear' } : { duration: 0.34, ease: [0.2, 0.8, 0.2, 1], delay: 0.12 }}
              style={{
                position: 'absolute', left: 0, right: 0, height: SHEET_H, zIndex: 4, boxSizing: 'border-box',
                background: C.classicSheet, boxShadow: CARD_GLOW, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                ...(side === 'top'
                  ? { top: 0, borderBottom: `2px solid ${C.classicGold}`, borderRadius: '0 0 24px 24px', padding: '24px 20px 14px' }
                  : { bottom: 0, borderTop: `2px solid ${C.classicGold}`, borderRadius: '24px 24px 0 0', padding: '22px 20px 22px' }),
              }}
            >
              <div style={{ position: 'relative', height: 128 }}>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.16, ease: 'linear' } }}
                    transition={{ duration: 0.16, ease: 'linear', delay: 0.06 }}
                    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: C.classicSheetMuted }}>STEP {currentStep + 1} OF {totalSteps}</span>
                    <h2 style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 26, lineHeight: 1.1, color: C.classicSheetInk }}>{mark.title}</h2>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4, color: C.classicSheetInk }}>{mark.copy}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div role="group" aria-label="Steps" style={{ display: 'flex', justifyContent: 'center', margin: '0 -4px' }}>
                {Array.from({ length: totalSteps }, (_, i) => {
                  const colour = i === currentStep ? C.classicGold : i < currentStep ? C.classicSheetMuted : C.classicSheetLine;
                  return (
                    <button key={i} type="button" aria-label={`Go to step ${i + 1}`} aria-current={i === currentStep ? 'step' : undefined} onClick={() => onJump(i)} style={{
                      width: 32, height: 44, padding: 0, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                      <motion.span
                        initial={false}
                        animate={{ scale: i === currentStep && !calm ? 1.4 : 1 }}
                        transition={{ duration: calm ? 0 : 0.2, ease: 'easeInOut' }}
                        style={{ width: 10, height: 10, borderRadius: 5, boxSizing: 'border-box', border: `1.5px solid ${colour}`, background: i < currentStep || i === currentStep ? colour : 'transparent' }}
                      />
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={onSkip} style={{
                  height: 44, padding: '0 10px', border: 'none', background: 'transparent', fontFamily: FONTS.sans, fontWeight: 700, cursor: 'pointer',
                  borderRadius: 8, fontSize: 14, color: C.classicSheetInk, textDecoration: 'underline', textUnderlineOffset: 3,
                }}>
                  Skip
                </button>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={onPrev} style={{
                  visibility: currentStep === 0 ? 'hidden' : 'visible', height: 44, padding: '0 18px', border: `1.5px solid ${C.classicSheetInk}`, background: 'transparent',
                  fontFamily: FONTS.sans, fontWeight: 700, cursor: 'pointer', borderRadius: 8, fontSize: 15, color: C.classicSheetInk,
                }}>
                  Back
                </button>
                <button type="button" onClick={onNext} style={{
                  height: 48, minWidth: 112, padding: '0 22px', border: 'none', background: C.classicGold, fontFamily: FONTS.sans, fontWeight: 700, cursor: 'pointer',
                  borderRadius: 8, fontSize: 16, letterSpacing: '0.02em', color: C.classicTable,
                }}>
                  {isLast ? 'Done' : 'Next'}
                </button>
              </div>
            </motion.section>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
