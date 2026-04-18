import { motion } from 'motion/react';
import type { Card as CardData } from '../engine/types';
import type { CSSProperties } from 'react';

// Poker standard 2.5:3.5
const CARD_W = 62;
const CARD_H = Math.round(CARD_W * (3.5 / 2.5));
const SMALL_W = 40;
const SMALL_H = Math.round(SMALL_W * (3.5 / 2.5));

const STRIPE_W = 4;

export interface CardProps {
  card: CardData;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  draggable?: boolean;
  onTap?: () => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: '#DC2626',
  diamonds: '#DC2626',
  clubs: '#0F0F1A',
  spades: '#0F0F1A',
};

// ─── Card Back ────────────────────────────────────────

function CardBack({ w, h }: { w: number; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: '#4F46E5',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        flexShrink: 0,
      }}
    >
      {/* Grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(0deg, rgba(255,255,255,0.1) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />
      {/* Wordmark */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.2)',
          fontSize: w < 50 ? 7 : 10,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: 1,
        }}
      >
        STACKED
      </div>
    </div>
  );
}

// ─── Card Face ────────────────────────────────────────

function CardFace({
  card,
  w,
  h,
  selected,
}: {
  card: CardData;
  w: number;
  h: number;
  selected?: boolean;
}) {
  const rankSize = w < 50 ? 16 : 28;
  const suitSize = w < 50 ? 10 : 16;

  const shadow = selected
    ? '0 4px 20px rgba(79,70,229,0.35)'
    : '0 2px 12px rgba(0,0,0,0.3)';

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `${shadow}, inset 1px 1px 0 rgba(255,255,255,0.06)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        flexShrink: 0,
      }}
    >
      {/* Indigo stripe — brand mark */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: STRIPE_W,
          background: selected ? '#6366F1' : '#4F46E5',
          borderRadius: '8px 0 0 8px',
        }}
      />

      {/* Rank */}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: rankSize,
          lineHeight: 1,
          color: suitColors[card.suit] ?? '#0F0F1A',
        }}
      >
        {card.rank}
      </span>

      {/* Suit */}
      <span
        style={{
          fontSize: suitSize,
          lineHeight: 1,
          color: suitColors[card.suit] ?? '#0F0F1A',
        }}
      >
        {suitSymbols[card.suit] ?? '?'}
      </span>
    </div>
  );
}

// ─── Exported Card Component ──────────────────────────

export function CardComponent({
  card,
  faceDown,
  selected,
  disabled,
  small,
  draggable,
  onTap,
  onDragEnd,
}: CardProps) {
  const w = small ? SMALL_W : CARD_W;
  const h = small ? SMALL_H : CARD_H;

  const inner = faceDown ? (
    <CardBack w={w} h={h} />
  ) : (
    <CardFace card={card} w={w} h={h} selected={selected} />
  );

  const wrapStyle: CSSProperties = {
    touchAction: 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: draggable ? 'grab' : disabled ? 'default' : 'pointer',
    zIndex: 1,
    flexShrink: 0,
  };

  if (draggable) {
    return (
      <motion.div
        drag
        dragSnapToOrigin
        whileDrag={{ scale: 1.12, zIndex: 100 }}
        animate={{
          y: selected ? -8 : 0,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onTap={onTap}
        onDragEnd={(_e, info) => onDragEnd?.(info.point)}
        style={wrapStyle}
      >
        {inner}
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ y: selected ? -8 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onTap={onTap}
      style={wrapStyle}
    >
      {inner}
    </motion.div>
  );
}

export { CARD_W, CARD_H };
