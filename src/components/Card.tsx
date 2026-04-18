import { motion } from 'motion/react';
import type { Card as CardData } from '../engine/types';
import type { CSSProperties, RefObject } from 'react';

const CARD_W = 62;
const CARD_H = 86;

export interface CardProps {
  card: CardData;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  draggable?: boolean;
  onTap?: () => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  slotRefs?: RefObject<(HTMLDivElement | null)[]>;
  boardRef?: RefObject<HTMLDivElement | null>;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: '#EF4444',
  diamonds: '#EF4444',
  clubs: '#1E1E2E',
  spades: '#1E1E2E',
};

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
  const w = small ? 40 : CARD_W;
  const h = small ? 56 : CARD_H;
  const fontSize = small ? 14 : 22;
  const suitSize = small ? 10 : 14;

  const baseStyle: CSSProperties = {
    width: w,
    height: h,
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
    cursor: draggable ? 'grab' : disabled ? 'default' : 'pointer',
    touchAction: 'none',
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  };

  if (faceDown) {
    return (
      <div
        style={{
          ...baseStyle,
          background: '#4F46E5',
          border: '1px solid #6366F1',
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 5px)',
        }}
      />
    );
  }

  const cardFace = (
    <div
      style={{
        ...baseStyle,
        background: '#FFFFFF',
        borderLeft: '3px solid #4F46E5',
        border: selected ? '2px solid #4F46E5' : '1px solid #3A3A50',
        boxShadow: selected
          ? '0 0 12px rgba(79,70,229,0.4)'
          : '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: suitColors[card.suit] ?? '#1E1E2E',
          lineHeight: 1,
        }}
      >
        {card.rank}
      </span>
      <span
        style={{
          fontSize: suitSize,
          color: suitColors[card.suit] ?? '#1E1E2E',
          lineHeight: 1,
        }}
      >
        {suitSymbols[card.suit] ?? '?'}
      </span>
    </div>
  );

  if (draggable) {
    return (
      <motion.div
        drag
        dragSnapToOrigin
        whileDrag={{ scale: 1.12, zIndex: 100 }}
        onTap={onTap}
        onDragEnd={(_e, info) => onDragEnd?.(info.point)}
        style={{ touchAction: 'none', zIndex: 1 }}
      >
        {cardFace}
      </motion.div>
    );
  }

  return (
    <div onClick={onTap} style={{ zIndex: 1 }}>
      {cardFace}
    </div>
  );
}

export { CARD_W, CARD_H };
