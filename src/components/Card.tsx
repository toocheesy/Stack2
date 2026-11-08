import { motion, useMotionValue, useTransform } from 'motion/react';
import type { Card as CardData } from '../engine/types';
import type { CSSProperties } from 'react';
import { C, SHADOWS, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';
import { getTransition } from '../config/motion';

// The locked card (D-007 Master Design, rulings 8, 8a, 10a, 23a, 23b, 26, 29a,
// 29b). Four sizes; the geometry is read from the boards: the full card from
// N4G, the hand, table and capture-slot cards from GB2. Every card in the
// game is Classic's in release 1. The card never changes in any state: same
// size, ring, stripes and shadow always.

export type CardSize = 'full' | 'hand' | 'table' | 'slot';

interface CardGeometry {
  w: number;
  h: number;
  radius: number;
  /** The thick outer ring in card-ring gold, drawn outside the face. */
  ring: number;
  /** The two thin stripes across the middle: top edge, thickness and the gap between them. */
  stripeTop: number;
  stripe: number;
  stripeGap: number;
  /** The centre rank on a patch of the face, the suit under it. */
  centreTop: number;
  rank: number;
  rankPad: number;
  suit: number;
  suitLineHeight: number;
  /** The corner rank and suit (full and hand sizes only): inset from the corner, rank and suit sizes. */
  corner: { x: number; y: number; rank: number; suit: number } | null;
  /** The soft deep shadow; the capture-slot card has none. */
  shadow: string | null;
}

/** The hand and table cards' locked widths and the hand card's ring, for
 *  layout that fits cards to a row (GameView's hand rule and six-across fit). */
export const HAND_CARD_W = 72;
export const HAND_CARD_RING = 3;
export const TABLE_CARD_W = 54;

const GEOMETRY: Record<CardSize, CardGeometry> = {
  full:  { w: 180, h: 252, radius: 20, ring: 5, stripeTop: 118, stripe: 4, stripeGap: 3, centreTop: 66, rank: 92, rankPad: 10, suit: 36, suitLineHeight: 1, corner: { x: 10, y: 10, rank: 28, suit: 20 }, shadow: SHADOWS.cardFull },
  hand:  { w: HAND_CARD_W, h: 100, radius: 9, ring: HAND_CARD_RING, stripeTop: 47, stripe: 2, stripeGap: 1.5, centreTop: 22, rank: 36, rankPad: 4, suit: 15, suitLineHeight: 1.1, corner: { x: 5, y: 4, rank: 13, suit: 10 }, shadow: SHADOWS.cardHand },
  table: { w: TABLE_CARD_W, h: 76, radius: 7, ring: 2, stripeTop: 36, stripe: 2, stripeGap: 1, centreTop: 13, rank: 28, rankPad: 3, suit: 13, suitLineHeight: 1.1, corner: null, shadow: SHADOWS.cardTable },
  slot:  { w: 40, h: 56, radius: 6, ring: 2, stripeTop: 26, stripe: 1.5, stripeGap: 1, centreTop: 8, rank: 20, rankPad: 2, suit: 10, suitLineHeight: 1.1, corner: null, shadow: null },
};

const MAX_TILT_DEG = 18;
const SELECTED_LIFT = 14;
const SELECTED_OUTLINE = 2;

export interface CardProps {
  card: CardData;
  size: CardSize;
  /** Draws the card below its locked size in the same shape and look (the
   *  hand rule, the table's six-across fit). Never above 1. */
  scale?: number;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  draggable?: boolean;
  onTap?: () => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  onDragMove?: (point: { x: number; y: number }) => void;
}

const suitSymbols: Record<string, string> = {
  hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660',
};
const RED_FAMILY = new Set(['hearts', 'diamonds']);

// The ring and the shadow are one box-shadow, as the boards draw them.
function ringAndShadow(g: CardGeometry): string {
  const ring = `0 0 0 ${g.ring}px ${C.cardRing}`;
  return g.shadow ? `${ring}, ${g.shadow}` : ring;
}

// --- Card Back ----------------------------------------
// No locked design yet (GB2 shows the bots' card counts instead, in release 2).
// It keeps its shape and takes the nearest roles: the table for the back, gold
// for the stripe, the table colour for the word on it, the size's ring and shadow.

function CardBack({ g }: { g: CardGeometry }) {
  const stripeW = g.w * 0.18;
  const bottomR = Math.max(4, Math.round(g.w * 0.03));
  const wordSize = Math.max(5, Math.round(stripeW * 0.55));

  return (
    <div style={{
      position: 'relative', width: g.w, height: g.h, borderRadius: g.radius, overflow: 'hidden',
      background: C.surface.classic, boxShadow: ringAndShadow(g), flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', left: g.w * 0.10, top: 0, width: stripeW, height: g.h * 0.70,
        background: C.classicGold, borderRadius: `0 0 ${bottomR}px ${bottomR}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <div style={{
          transform: 'rotate(-90deg)', transformOrigin: 'center center',
          whiteSpace: 'nowrap' as const, fontFamily: FONTS.sans,
          fontWeight: 700, fontSize: wordSize, lineHeight: 1,
          letterSpacing: '0.18em', color: C.classicTable, opacity: 0.65,
          userSelect: 'none' as const,
        }}>STACKED!</div>
      </div>
    </div>
  );
}

// --- Card Face ----------------------------------------

function CardFace({ card, g }: { card: CardData; g: CardGeometry }) {
  const suitColour = RED_FAMILY.has(card.suit) ? C.suitRed : C.suitDark;
  const glyph = (suitSymbols[card.suit] ?? '?') + '\uFE0E';
  const corner = g.corner && (
    <>
      <span style={{ fontFamily: FONTS.display, fontSize: g.corner.rank }}>{card.rank}</span>
      <span style={{ fontFamily: FONTS.sans, fontSize: g.corner.suit }}>{glyph}</span>
    </>
  );

  return (
    <div style={{
      position: 'relative', width: g.w, height: g.h, borderRadius: g.radius, overflow: 'hidden',
      background: C.cardFace, color: suitColour, boxShadow: ringAndShadow(g), flexShrink: 0,
    }}>
      {/* Two thin stripes across the middle: the table colour, then the deep gold */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: g.stripeTop, display: 'flex', flexDirection: 'column', gap: g.stripeGap }}>
        <div style={{ height: g.stripe, background: C.classicTable }} />
        <div style={{ height: g.stripe, background: C.classicGoldDeep }} />
      </div>

      {/* Centre rank on a patch of the face, running over the stripes; the suit under it */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: g.centreTop, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontFamily: FONTS.display, fontSize: g.rank, lineHeight: 0.95, padding: `0 ${g.rankPad}px`, background: C.cardFace }}>{card.rank}</span>
        <span style={{ fontFamily: FONTS.sans, fontSize: g.suit, lineHeight: g.suitLineHeight }}>{glyph}</span>
      </div>

      {g.corner && (
        <>
          <div style={{ position: 'absolute', left: g.corner.x, top: g.corner.y, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>{corner}</div>
          <div style={{ position: 'absolute', right: g.corner.x, bottom: g.corner.y, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, transform: 'rotate(180deg)' }}>{corner}</div>
        </>
      )}
    </div>
  );
}

// --- Exported Card Component --------------------------

export function CardComponent({
  card, size, scale = 1, faceDown, selected, disabled,
  draggable, onTap, onDragEnd, onDragMove,
}: CardProps) {
  const g = GEOMETRY[size];
  const s = Math.min(1, scale);
  const ring = g.ring * s;

  const inner = faceDown ? <CardBack g={g} /> : <CardFace card={card} g={g} />;

  // The outer box is the card's layout size; the face inside is drawn at the
  // locked size and scaled down when the row needs it. Drag moves this box, so
  // a dragged card tracks the finger whatever its scale.
  const wrapStyle: CSSProperties = {
    position: 'relative',
    width: g.w * s, height: g.h * s, borderRadius: g.radius * s,
    touchAction: 'none',
    cursor: draggable ? 'grab' : disabled ? 'default' : 'pointer',
    zIndex: 1,
    flexShrink: 0,
    // Selected: a 2px outline in Classic's ink, outside the ring (GB2).
    outline: selected ? `${SELECTED_OUTLINE}px solid ${C.ink.classic}` : undefined,
    outlineOffset: selected ? ring + 2 : undefined,
  };

  const body = (
    <>
      <div style={s === 1 ? undefined : { width: g.w, height: g.h, transform: `scale(${s})`, transformOrigin: 'top left' }}>
        {inner}
      </div>
      {/* Disabled: the table colour at 40% over the whole card, ring included; nothing else changes. */}
      {disabled && (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: -ring, borderRadius: g.radius * s + ring,
          background: alpha(C.classicTable, 0.4), pointerEvents: 'none',
        }} />
      )}
    </>
  );

  if (draggable) {
    return (
      <DraggableWrapper
        selected={selected}
        onTap={onTap}
        onDragEnd={onDragEnd}
        onDragMove={onDragMove}
        style={wrapStyle}
      >
        {body}
      </DraggableWrapper>
    );
  }

  return (
    <motion.div
      animate={{ y: selected ? -SELECTED_LIFT : 0 }}
      transition={getTransition('snappy')}
      onTap={onTap}
      style={wrapStyle}
    >
      {body}
    </motion.div>
  );
}

function DraggableWrapper({
  selected, children, onTap, onDragEnd, onDragMove, style,
}: {
  selected?: boolean;
  children: React.ReactNode;
  onTap?: () => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  onDragMove?: (point: { x: number; y: number }) => void;
  style: CSSProperties;
}) {
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 0, 200], [-MAX_TILT_DEG, 0, MAX_TILT_DEG]);

  return (
    <motion.div
      drag
      dragSnapToOrigin
      style={{ ...style, x: dragX, rotate }}
      animate={{ y: selected ? -SELECTED_LIFT : 0, scale: 1 }}
      whileDrag={{ scale: 1.05, y: -8, zIndex: 100 }}
      transition={getTransition('snappy')}
      onTap={onTap}
      onDrag={(_e, info) => onDragMove?.(info.point)}
      onDragEnd={(_e, info) => onDragEnd?.(info.point)}
    >
      {children}
    </motion.div>
  );
}
