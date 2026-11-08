import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import type { Card, CaptureGroup, Combination, ComboSlot } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { MOMENTS } from '../../game/useGameController';
import { CardComponent } from '../Card';
import { Fade, FlyingCard, Tag, TextButton, type Flight } from './pieces';
import { centreOf, type Point } from './moments';
import { cardPointsLine, sourceTags } from './words';

// The capture tray (GB2): BASE, COMBO 1, COMBO 2, COMBO 3 as capture-slot
// cards, each staged card tagged HAND (outlined) or TABLE (solid). Yours
// shows while you build, with RESET, the points preview and SUBMIT, in gold.
// An opponent's capture replays in it for about two seconds, edged and
// labelled in the opponent's colour, slot by slot as the opponent built it.
// When you SUBMIT, the tray plays YC1: its chrome fades, the cards fly to
// your race bar one after another, and the points pop and drop into your score.

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const SLOT_LABELS: Record<ComboSlot, string> = { base: 'BASE', combo1: 'COMBO 1', combo2: 'COMBO 2', combo3: 'COMBO 3' };
const SLOT_CARD_W = 40;

type ComboKey = Exclude<ComboSlot, 'base'>;

interface BuildProps {
  mode: 'build';
  /** A short screen (ruling 99): tighter gaps. */
  compact?: boolean;
  build: Combination;
  baseSide: 'hand' | 'board' | null;
  valid: Record<ComboKey, boolean>;
  canSubmit: boolean;
  points: number;
  /** The tutorial's ghost: empty boxes and buttons that do nothing. */
  ghost: boolean;
  hoveredSlot: ComboSlot | null;
  onRemove: (cardId: string) => void;
  onReset: () => void;
  onSubmit: () => void;
  slotRefs: RefObject<(HTMLDivElement | null)[]>;
  submitWrapRef: Ref<HTMLDivElement>;
  resetWrapRef: Ref<HTMLDivElement>;
}

interface ReplayProps {
  mode: 'replay';
  combination: Combination;
  name: string;
  colour: string;
  points: number;
  cards: Card[];
  /** Where the cards fly when the tray closes: the opponent's seat, from the tray's centre. */
  flyTo: Point | null;
}

/** YC1: your capture just made, flying from the tray to your race bar. */
interface CaptureProps {
  mode: 'capture';
  combination: Combination;
  baseSide: 'hand' | 'board' | null;
  points: number;
  /** Your race bar's centre, where the cards land. */
  barTarget: () => Point | null;
  /** Your score's centre, where the points drop. */
  scoreTarget: () => Point | null;
}

export type CaptureTrayProps = BuildProps | ReplayProps | CaptureProps;

/** Staged cards overlap so a combo of any size stays inside its box. */
function overlap(n: number): number {
  return n <= 2 ? 16 : Math.ceil(SLOT_CARD_W - 32 / (n - 1));
}

function StagedCards({ cards, onTap, flyTo }: { cards: Card[]; onTap?: (id: string) => void; flyTo: Point | null }) {
  const calm = useReducedMotion();
  const exit = flyTo && !calm ? { x: flyTo.x, y: flyTo.y, scale: 0.4, opacity: 0 } : { opacity: 0 };
  const o = overlap(cards.length);
  return (
    <div style={{ display: 'flex' }}>
      {cards.map((c, i) => (
        <motion.div key={c.id} exit={exit} transition={{ duration: 0.45, ease: 'easeIn' }}
          onClick={onTap ? (e) => { e.stopPropagation(); onTap(c.id); } : undefined}
          style={{ marginLeft: i > 0 ? -o : 0, cursor: onTap ? 'pointer' : 'default', position: 'relative', zIndex: i }}>
          <CardComponent card={c} size="slot" />
        </motion.div>
      ))}
    </div>
  );
}

/** YC1's cards: each hops out of the tray and flies to your bar, 60 ms after the one before. */
function CapturedCards({ cards, startIndex, count, target }: { cards: Card[]; startIndex: number; count: number; target: () => Point | null }) {
  const yc = MOMENTS.yourCapture;
  const o = overlap(cards.length);
  return (
    <div style={{ display: 'flex' }}>
      {cards.map((c, i) => {
        const index = startIndex + i;
        const flight: Flight = {
          target,
          delay: (yc.cardStep + index * yc.cardStep) / 1000,
          duration: yc.cardFlight / 1000,
          hop: 8,
          grow: 1.06,
          shrink: 0.5,
          rotate: (index - (count - 1) / 2) * 8,
          calmDuration: yc.calm.out / 1000,
        };
        return (
          <div key={c.id} style={{ marginLeft: i > 0 ? -o : 0, position: 'relative', zIndex: i }}>
            <FlyingCard flight={flight}><CardComponent card={c} size="slot" /></FlyingCard>
          </div>
        );
      })}
    </div>
  );
}

function SlotColumn({ label, labelColour, fade, compact, children }: { label: string; labelColour: string; fade?: number; compact?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 2 : 4, minWidth: 0 }}>
      <Fade out={fade !== undefined} duration={fade ?? 0}>
        <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: labelColour, whiteSpace: 'nowrap' }}>{label}</span>
      </Fade>
      {children}
    </div>
  );
}

/** A filled box: its frame can fade (YC1) while the cards on it stay. */
function FilledBox({ edge, hovered, boxRef, fade, children }: { edge: string; hovered?: boolean; boxRef?: (el: HTMLDivElement | null) => void; fade?: number; children: ReactNode }) {
  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', height: 96, boxSizing: 'border-box' }}>
      <Fade out={fade !== undefined} duration={fade ?? 0} style={{
        position: 'absolute', inset: 0, border: `1px solid ${edge}`, outline: hovered ? `1px solid ${C.classicGold}` : undefined,
        borderRadius: 6, background: C.surface.classic,
      }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        {children}
      </div>
    </div>
  );
}

function EmptyBox({ hovered, boxRef, fade, children }: { hovered?: boolean; boxRef?: (el: HTMLDivElement | null) => void; fade?: number; children: ReactNode }) {
  return (
    <div ref={boxRef} style={{ width: '100%', height: 96 }}>
      <Fade out={fade !== undefined} duration={fade ?? 0} style={{
        width: '100%', height: 96, boxSizing: 'border-box', border: `1.5px dashed ${C.line.classic}`, outline: hovered ? `1px solid ${C.classicGold}` : undefined,
        borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 6,
        fontFamily: FONTS.sans, fontSize: 10, fontWeight: 600, lineHeight: 1.25, color: C.muted.classic,
      }}>
        {children}
      </Fade>
    </div>
  );
}

function Tags({ groups, fade }: { groups: readonly CaptureGroup[]; fade?: number }) {
  return (
    <Fade out={fade !== undefined} duration={fade ?? 0} style={{ display: 'flex', gap: 3 }}>
      {sourceTags(groups).map((t) => <Tag key={t.source} solid={t.source === 'board'}>{t.label}</Tag>)}
    </Fade>
  );
}

/** YC1's "+20": pops up big and gold where the tray was (80 to 720 ms), holds,
 *  then drops into your score and fades. Under reduce-motion it fades in and
 *  out in place (150 to 750 ms). */
function PointsPop({ points, target }: { points: number; target: () => Point | null }) {
  const calm = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [delta, setDelta] = useState<Point | null>(null);

  useLayoutEffect(() => {
    const from = centreOf(ref.current);
    const to = target();
    setDelta(from && to ? { x: to.x - from.x, y: to.y - from.y } : { x: 0, y: 0 });
    // Measured once, as the pop appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 7 }}>
      <motion.span
        ref={ref}
        initial={{ opacity: 0, scale: calm ? 1 : 0.6 }}
        animate={delta
          ? (calm
            ? { opacity: [0, 1, 1, 0] }
            : { opacity: [0, 1, 1, 1, 0], scale: [0.6, 1.08, 1, 1, 0.4], x: [0, 0, 0, 0, delta.x], y: [0, 0, 0, 0, delta.y] })
          : undefined}
        transition={calm
          ? { duration: 0.6, delay: 0.15, ease: 'linear', times: [0, 0.3, 0.7, 1] }
          : { duration: 0.64, delay: 0.08, ease: [0.5, 0, 0.2, 1], times: [0, 0.25, 0.4, 0.8, 1] }}
        style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 44, lineHeight: 1, color: C.classicGold, display: 'inline-block' }}
      >
        +{points}
      </motion.span>
    </div>
  );
}

export function CaptureTray(props: CaptureTrayProps) {
  if (props.mode === 'replay') {
    const { combination, name, colour, points, cards, flyTo } = props;
    return (
      <div style={{ boxSizing: 'border-box', padding: '10px 10px 12px', background: C.surface.classic, border: `2px solid ${colour}`, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: colour }}>{name.toUpperCase()}'S CAPTURE</span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 600, color: C.muted.classic, whiteSpace: 'nowrap' }}>Going to {name}…</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {SLOT_KEYS.map((key) => {
            if (key === 'base') {
              const base = combination.base;
              return (
                <SlotColumn key={key} label="BASE" labelColour={colour}>
                  <FilledBox edge={colour}>
                    {base && <StagedCards cards={[base]} flyTo={flyTo} />}
                    <Tag>HAND</Tag>
                  </FilledBox>
                </SlotColumn>
              );
            }
            const groups = combination[key];
            if (groups.length === 0) {
              return (
                <SlotColumn key={key} label={SLOT_LABELS[key]} labelColour={C.muted.classic}>
                  <EmptyBox>Empty</EmptyBox>
                </SlotColumn>
              );
            }
            return (
              <SlotColumn key={key} label={`${SLOT_LABELS[key]} ✓`} labelColour={C.muted.classic}>
                <FilledBox edge={C.line.classic}>
                  <StagedCards cards={groups.map((g) => g.card)} flyTo={flyTo} />
                  <Tags groups={groups} />
                </FilledBox>
              </SlotColumn>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0 2px' }}>
          <span style={{ fontFamily: FONTS.display, fontSize: 24, lineHeight: 1, color: C.ink.classic }}>+{points}</span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 12, color: C.muted.classic, textAlign: 'right' }}>{cardPointsLine(cards)}</span>
        </div>
      </div>
    );
  }

  if (props.mode === 'capture') {
    const { combination, baseSide, points, barTarget, scoreTarget } = props;
    const fade = MOMENTS.yourCapture.chromeOut / 1000;
    const filled = [combination.combo1, combination.combo2, combination.combo3];
    const count = (combination.base ? 1 : 0) + filled.reduce((n, g) => n + g.length, 0);
    // Each card's place in the flight order: the base, then the combos in slot order.
    const startOf: Record<ComboSlot, number> = { base: 0, combo1: 0, combo2: 0, combo3: 0 };
    startOf.combo1 = combination.base ? 1 : 0;
    startOf.combo2 = startOf.combo1 + combination.combo1.length;
    startOf.combo3 = startOf.combo2 + combination.combo2.length;
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Fade out duration={fade}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.muted.classic }}>YOUR CAPTURE</span>
        </Fade>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {SLOT_KEYS.map((key) => {
            if (key === 'base') {
              const base = combination.base;
              return (
                <SlotColumn key={key} label="BASE" labelColour={C.classicGold} fade={fade}>
                  <FilledBox edge={C.classicGold} fade={fade}>
                    {base && <CapturedCards cards={[base]} startIndex={startOf.base} count={count} target={barTarget} />}
                    <Fade out duration={fade}><Tag solid={baseSide === 'board'}>{baseSide === 'board' ? 'TABLE' : 'HAND'}</Tag></Fade>
                  </FilledBox>
                </SlotColumn>
              );
            }
            const groups = combination[key];
            if (groups.length === 0) {
              return (
                <SlotColumn key={key} label={SLOT_LABELS[key]} labelColour={C.muted.classic} fade={fade}>
                  <EmptyBox fade={fade}>Optional<span style={{ fontWeight: 400 }}>{baseSide === 'board' ? 'needs a hand card' : 'needs a table card'}</span></EmptyBox>
                </SlotColumn>
              );
            }
            return (
              <SlotColumn key={key} label={`${SLOT_LABELS[key]} ✓`} labelColour={C.muted.classic} fade={fade}>
                <FilledBox edge={C.line.classic} fade={fade}>
                  <CapturedCards cards={groups.map((g) => g.card)} startIndex={startOf[key]} count={count} target={barTarget} />
                  <Tags groups={groups} fade={fade} />
                </FilledBox>
              </SlotColumn>
            );
          })}
        </div>
        <Fade out duration={fade} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          <TextButton label="RESET" onClick={() => {}} disabled />
          <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700, color: C.ink.classic }}>+{points} so far</div>
          <TextButton label="SUBMIT" primary wide onClick={() => {}} />
        </Fade>
        <PointsPop points={points} target={scoreTarget} />
      </div>
    );
  }

  const { build, baseSide, valid, canSubmit, points, ghost, hoveredSlot, compact, onRemove, onReset, onSubmit, slotRefs, submitWrapRef, resetWrapRef } = props;
  const needs = baseSide === 'board' ? 'needs a hand card' : 'needs a table card';
  const setSlotRef = (i: number) => (el: HTMLDivElement | null) => { slotRefs.current[i] = el; };
  const nothing = () => {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.muted.classic }}>YOUR CAPTURE</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {SLOT_KEYS.map((key, i) => {
          const hovered = hoveredSlot === key;
          if (key === 'base') {
            const base = build.base;
            return (
              <SlotColumn key={key} label="BASE" labelColour={C.classicGold} compact={compact}>
                {base ? (
                  <FilledBox edge={C.classicGold} hovered={hovered} boxRef={setSlotRef(i)}>
                    <StagedCards cards={[base]} onTap={onRemove} flyTo={null} />
                    <Tag solid={baseSide === 'board'}>{baseSide === 'board' ? 'TABLE' : 'HAND'}</Tag>
                  </FilledBox>
                ) : (
                  <EmptyBox hovered={hovered} boxRef={setSlotRef(i)}>Empty</EmptyBox>
                )}
              </SlotColumn>
            );
          }
          const groups = build[key];
          if (groups.length === 0) {
            return (
              <SlotColumn key={key} label={SLOT_LABELS[key]} labelColour={C.muted.classic} compact={compact}>
                <EmptyBox hovered={hovered} boxRef={setSlotRef(i)}>
                  {ghost || !build.base ? 'Empty' : <>Optional<span style={{ fontWeight: 400 }}>{needs}</span></>}
                </EmptyBox>
              </SlotColumn>
            );
          }
          return (
            <SlotColumn key={key} label={valid[key] ? `${SLOT_LABELS[key]} ✓` : SLOT_LABELS[key]} labelColour={C.muted.classic} compact={compact}>
              <FilledBox edge={C.line.classic} hovered={hovered} boxRef={setSlotRef(i)}>
                <StagedCards cards={groups.map((g) => g.card)} onTap={onRemove} flyTo={null} />
                <Tags groups={groups} />
              </FilledBox>
            </SlotColumn>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: compact ? 0 : 2 }}>
        <TextButton label="RESET" onClick={ghost ? nothing : onReset} disabled={ghost} wrapRef={resetWrapRef} />
        <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700, color: C.ink.classic }}>
          {!ghost && build.base ? `+${points} so far` : ''}
        </div>
        <TextButton label="SUBMIT" primary wide onClick={ghost ? nothing : onSubmit} disabled={ghost || !canSubmit} wrapRef={submitWrapRef} />
      </div>
    </div>
  );
}
