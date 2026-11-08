import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode, Ref, RefObject } from 'react';
import type { Card, CaptureGroup, Combination, ComboSlot } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { CardComponent } from '../Card';
import { Tag, TextButton } from './pieces';
import { cardPointsLine, sourceTags } from './words';

// The capture tray (GB2): BASE, COMBO 1, COMBO 2, COMBO 3 as capture-slot
// cards, each staged card tagged HAND (outlined) or TABLE (solid). Yours
// shows while you build, with RESET, the points preview and SUBMIT, in gold.
// An opponent's capture replays in it for about two seconds, edged and
// labelled in the opponent's colour, slot by slot as the opponent built it.

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const SLOT_LABELS: Record<ComboSlot, string> = { base: 'BASE', combo1: 'COMBO 1', combo2: 'COMBO 2', combo3: 'COMBO 3' };
const SLOT_CARD_W = 40;

type ComboKey = Exclude<ComboSlot, 'base'>;

interface BuildProps {
  mode: 'build';
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
  flyTo: { x: number; y: number } | null;
}

export type CaptureTrayProps = BuildProps | ReplayProps;

/** Staged cards overlap so a combo of any size stays inside its box. */
function overlap(n: number): number {
  return n <= 2 ? 16 : Math.ceil(SLOT_CARD_W - 32 / (n - 1));
}

function StagedCards({ cards, onTap, flyTo }: { cards: Card[]; onTap?: (id: string) => void; flyTo: { x: number; y: number } | null }) {
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

function SlotColumn({ label, labelColour, children }: { label: string; labelColour: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: labelColour, whiteSpace: 'nowrap' }}>{label}</span>
      {children}
    </div>
  );
}

function FilledBox({ edge, hovered, boxRef, children }: { edge: string; hovered?: boolean; boxRef?: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  return (
    <div ref={boxRef} style={{
      width: '100%', height: 96, boxSizing: 'border-box', border: `1px solid ${edge}`, outline: hovered ? `1px solid ${C.classicGold}` : undefined,
      borderRadius: 6, background: C.surface.classic, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
    }}>
      {children}
    </div>
  );
}

function EmptyBox({ hovered, boxRef, children }: { hovered?: boolean; boxRef?: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  return (
    <div ref={boxRef} style={{
      width: '100%', height: 96, boxSizing: 'border-box', border: `1.5px dashed ${C.line.classic}`, outline: hovered ? `1px solid ${C.classicGold}` : undefined,
      borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 6,
      fontFamily: FONTS.sans, fontSize: 10, fontWeight: 600, lineHeight: 1.25, color: C.muted.classic,
    }}>
      {children}
    </div>
  );
}

function Tags({ groups }: { groups: readonly CaptureGroup[] }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {sourceTags(groups).map((t) => <Tag key={t.source} solid={t.source === 'board'}>{t.label}</Tag>)}
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

  const { build, baseSide, valid, canSubmit, points, ghost, hoveredSlot, onRemove, onReset, onSubmit, slotRefs, submitWrapRef, resetWrapRef } = props;
  const needs = baseSide === 'board' ? 'needs a hand card' : 'needs a table card';
  const setSlotRef = (i: number) => (el: HTMLDivElement | null) => { slotRefs.current[i] = el; };
  const nothing = () => {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.muted.classic }}>YOUR CAPTURE</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {SLOT_KEYS.map((key, i) => {
          const hovered = hoveredSlot === key;
          if (key === 'base') {
            const base = build.base;
            return (
              <SlotColumn key={key} label="BASE" labelColour={C.classicGold}>
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
              <SlotColumn key={key} label={SLOT_LABELS[key]} labelColour={C.muted.classic}>
                <EmptyBox hovered={hovered} boxRef={setSlotRef(i)}>
                  {ghost || !build.base ? 'Empty' : <>Optional<span style={{ fontWeight: 400 }}>{needs}</span></>}
                </EmptyBox>
              </SlotColumn>
            );
          }
          return (
            <SlotColumn key={key} label={valid[key] ? `${SLOT_LABELS[key]} ✓` : SLOT_LABELS[key]} labelColour={C.muted.classic}>
              <FilledBox edge={C.line.classic} hovered={hovered} boxRef={setSlotRef(i)}>
                <StagedCards cards={groups.map((g) => g.card)} onTap={onRemove} flyTo={null} />
                <Tags groups={groups} />
              </FilledBox>
            </SlotColumn>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
        <TextButton label="RESET" onClick={ghost ? nothing : onReset} disabled={ghost} wrapRef={resetWrapRef} />
        <div style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700, color: C.ink.classic }}>
          {!ghost && build.base ? `+${points} so far` : ''}
        </div>
        <TextButton label="SUBMIT" primary wide onClick={ghost ? nothing : onSubmit} disabled={ghost || !canSubmit} wrapRef={submitWrapRef} />
      </div>
    </div>
  );
}
