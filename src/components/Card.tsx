import { motion, useMotionValue, useTransform } from 'motion/react';
import type { Card as CardData } from '../engine/types';
import type { CSSProperties } from 'react';
import { SHADOWS } from '../config/colors';
import { getTransition } from '../config/motion';

// Poker standard 2.5:3.5
const CARD_W = 62;
const CARD_H = Math.round(CARD_W * (3.5 / 2.5));
const SMALL_W = 40;

// Brand colors (locked)
const STK = {
  JADE:  '#065F46',
  TAN:   '#E8C577',
  BROWN: '#72571C',
  WHITE: '#FFFFFF',
};

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
const RED_FAMILY = new Set(['hearts', 'diamonds']);
function inkFor(suit: string) {
  if (RED_FAMILY.has(suit)) return { rankColor: STK.TAN, suitColor: STK.BROWN };
  return { rankColor: STK.BROWN, suitColor: STK.TAN };
}

// ─── Stripe geometry (single source of truth) ───────

function stripeBox(w: number) {
  const h = Math.round(w * (3.5 / 2.5));
  const sw = w * 0.18;
  const sh = h * 0.70;
  const left = w * 0.10;
  const bottomR = Math.max(4, Math.round(w * 0.03));
  return { cardHeight: h, left, top: 0, width: sw, height: sh, radius: `0 0 ${bottomR}px ${bottomR}px` };
}

function cardShadow(w: number, lifted?: boolean): string {
  if (lifted) return SHADOWS.cardLifted;
  const ledge = Math.max(2, Math.round(w * 0.03));
  return `0 ${ledge}px 0 rgba(0,0,0,0.25), 0 ${ledge * 3}px ${ledge * 7}px rgba(0,0,0,0.45)`;
}

// ─── Card Back ────────────────────────────────────────

function CardBack({ w }: { w: number }) {
  const s = stripeBox(w);
  const wordSize = Math.max(5, Math.round(s.width * 0.55));

  return (
    <div style={{
      width: w, height: s.cardHeight, borderRadius: 12,
      background: STK.JADE, position: 'relative', overflow: 'hidden',
      boxShadow: cardShadow(w), flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', left: s.left, top: s.top,
        width: s.width, height: s.height,
        background: STK.TAN, borderRadius: s.radius,
        zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <div style={{
          transform: 'rotate(-90deg)', transformOrigin: 'center center',
          whiteSpace: 'nowrap' as const, fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 900, fontSize: wordSize, lineHeight: 1,
          letterSpacing: '0.18em', color: STK.JADE, opacity: 0.65,
          userSelect: 'none' as const,
        }}>STACKED!</div>
      </div>
    </div>
  );
}

// ─── Card Face ────────────────────────────────────────

function CardFace({ card, w, lifted }: {
  card: CardData; w: number; lifted?: boolean;
}) {
  const s = stripeBox(w);
  const { rankColor, suitColor } = inkFor(card.suit);
  const rankSize = w * 0.50;
  const suitSize = w * 0.30;

  return (
    <div style={{
      width: w, height: s.cardHeight, borderRadius: 12,
      background: STK.WHITE, position: 'relative', overflow: 'hidden',
      boxShadow: cardShadow(w, lifted), flexShrink: 0,
    }}>
      {/* Jade stripe */}
      <div style={{
        position: 'absolute', left: s.left, top: s.top,
        width: s.width, height: s.height,
        background: STK.JADE, borderRadius: s.radius, zIndex: 1,
      }} />

      {/* Rank + suit, anchored right of stripe */}
      <div style={{
        position: 'absolute',
        left: w * 0.34, right: w * 0.06, top: 0, bottom: 0,
        zIndex: 2, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: w * 0.01,
      }}>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900,
          fontSize: rankSize, lineHeight: 0.85, letterSpacing: '-0.05em',
          color: rankColor,
        }}>{card.rank}</div>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: suitSize, lineHeight: 1, color: suitColor,
        }}>{(suitSymbols[card.suit] ?? '?') + '\uFE0E'}</div>
      </div>
    </div>
  );
}

// ─── Exported Card Component ──────────────────────────

export function CardComponent({
  card, faceDown, selected, disabled, small,
  draggable, onTap, onDragEnd, onDragMove, isDragging,
}: CardProps) {
  const w = small ? SMALL_W : CARD_W;
  const lifted = selected || isDragging;

  const inner = faceDown
    ? <CardBack w={w} />
    : <CardFace card={card} w={w} lifted={lifted} />;

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
