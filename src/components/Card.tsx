import { motion, useMotionValue, useTransform } from 'motion/react';
import type { Card as CardData } from '../engine/types';
import type { CSSProperties } from 'react';
import { C, SHADOWS } from '../config/colors';
import { getTransition } from '../config/motion';

// Poker standard 2.5:3.5
const CARD_W = 62;
const CARD_H = Math.round(CARD_W * (3.5 / 2.5));
const SMALL_W = 40;
const SMALL_H = Math.round(SMALL_W * (3.5 / 2.5));

// Banner/pennant proportions (percentage of card)
const BANNER_W_PCT = 0.20;
const BANNER_H_PCT = 0.65;
const BANNER_LEFT_PCT = 0.08;
const BANNER_TOP_PCT = 0;

const BANNER_CLIP = 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)';

const MAX_TILT_DEG = 18;

export interface CardProps {
  card: CardData;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  draggable?: boolean;
  onTap?: () => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  onDragMove?: (point: { x: number; y: number }) => void;
  isDragging?: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const suitColor = (suit: string) =>
  suit === 'hearts' || suit === 'diamonds' ? C.suitRed : C.suitBlack;

// ─── Banner shape (shared between face and back) ─────

function Banner({ w, h, lifted, back }: { w: number; h: number; lifted?: boolean; back?: boolean }) {
  const bw = Math.round(w * BANNER_W_PCT);
  const bh = Math.round(h * BANNER_H_PCT);
  const left = Math.round(w * BANNER_LEFT_PCT);
  const top = Math.round(h * BANNER_TOP_PCT);

  const bg = back
    ? 'rgba(255,255,255,0.3)'
    : lifted
    ? `linear-gradient(to bottom, ${C.indigoHover}, #818CF8)`
    : `linear-gradient(to bottom, ${C.indigo}, ${C.indigoHover})`;

  return (
    <div style={{
      position: 'absolute', left, top, width: bw, height: bh,
      background: bg,
      clipPath: BANNER_CLIP,
      filter: back ? 'none' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))',
    }} />
  );
}

// ─── Card Back ────────────────────────────────────────

function CardBack({ w, h }: { w: number; h: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8, background: C.indigo,
      position: 'relative', overflow: 'hidden',
      boxShadow: SHADOWS.cardRest, flexShrink: 0,
    }}>
      <Banner w={w} h={h} back />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.2)', fontSize: w < 50 ? 7 : 10,
        fontWeight: 700, fontFamily: 'Inter, sans-serif', letterSpacing: 1,
      }}>STACKED</div>
    </div>
  );
}

// ─── Card Face ────────────────────────────────────────

function CardFace({ card, w, h, lifted }: {
  card: CardData; w: number; h: number; lifted?: boolean;
}) {
  const rankSize = w < 50 ? 16 : 28;
  const suitSize = w < 50 ? 10 : 16;
  const shadow = lifted ? SHADOWS.cardLifted : SHADOWS.cardRest;
  const color = suitColor(card.suit);

  return (
    <div style={{
      width: w, height: h, borderRadius: 8, background: C.card,
      position: 'relative', overflow: 'hidden', boxShadow: shadow,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0,
    }}>
      <Banner w={w} h={h} lifted={lifted} />
      <span style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 700,
        fontSize: rankSize, lineHeight: 1, color,
        position: 'relative', zIndex: 2,
      }}>{card.rank}</span>
      <span style={{
        fontSize: suitSize, lineHeight: 1, color,
        position: 'relative', zIndex: 2,
      }}>
        {suitSymbols[card.suit] ?? '?'}
      </span>
    </div>
  );
}

// ─── Exported Card Component ──────────────────────────

export function CardComponent({
  card, faceDown, selected, disabled, small,
  draggable, onTap, onDragEnd, onDragMove, isDragging,
}: CardProps) {
  const w = small ? SMALL_W : CARD_W;
  const h = small ? SMALL_H : CARD_H;
  const lifted = selected || isDragging;

  const inner = faceDown
    ? <CardBack w={w} h={h} />
    : <CardFace card={card} w={w} h={h} lifted={lifted} />;

  const wrapStyle: CSSProperties = {
    touchAction: 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: draggable ? 'grab' : disabled ? 'default' : 'pointer',
    zIndex: 1,
    flexShrink: 0,
  };

  if (draggable) {
    return (
      <DraggableWrapper
        selected={selected}
        onTap={onTap}
        onDragEnd={onDragEnd}
        onDragMove={onDragMove}
        style={wrapStyle}
      >
        {inner}
      </DraggableWrapper>
    );
  }

  return (
    <motion.div
      animate={{ y: selected ? -8 : 0 }}
      transition={getTransition('snappy')}
      onTap={onTap}
      style={wrapStyle}
    >
      {inner}
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
      animate={{ y: selected ? -8 : 0, scale: 1 }}
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

export { CARD_W, CARD_H };
