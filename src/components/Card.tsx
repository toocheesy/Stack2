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

const STRIPE_PCT = 0.22; // ~22% of card width
const STRIPE_H_PCT = 0.75;
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

// ─── Card Back ────────────────────────────────────────

function CardBack({ w, h }: { w: number; h: number }) {
  const stripeW = Math.round(w * STRIPE_PCT);
  const stripeH = Math.round(h * STRIPE_H_PCT);
  return (
    <div style={{
      width: w, height: h, borderRadius: 8, background: C.indigo,
      position: 'relative', overflow: 'hidden',
      boxShadow: SHADOWS.cardRest, flexShrink: 0,
    }}>
      {/* White 75% stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: stripeW, height: stripeH,
        background: 'rgba(255,255,255,0.4)',
        borderRadius: '8px 0 0 0',
      }} />
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
  const stripeW = Math.round(w * STRIPE_PCT);
  const stripeH = Math.round(h * STRIPE_H_PCT);
  const contentShift = Math.round(stripeW / 2);

  return (
    <div style={{
      width: w, height: h, borderRadius: 8, background: C.card,
      position: 'relative', overflow: 'hidden', boxShadow: shadow,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0,
      paddingLeft: contentShift,
    }}>
      {/* 75% indigo stripe — brand mark */}
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: stripeW, height: stripeH,
        background: lifted
          ? `linear-gradient(to bottom, ${C.indigoHover}, ${C.indigo})`
          : `linear-gradient(to bottom, ${C.indigo}, ${C.indigoHover})`,
        borderRadius: '8px 0 0 0',
      }} />
      <span style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 700,
        fontSize: rankSize, lineHeight: 1, color,
      }}>{card.rank}</span>
      <span style={{ fontSize: suitSize, lineHeight: 1, color }}>
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
