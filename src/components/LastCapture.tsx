import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LastCaptureInfo } from '../game/useGameController';
import { C } from '../config/colors';
import { tween } from '../config/motion';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const PLAYER_COLORS: Record<number, string> = {
  0: C.amber, 1: C.botCalvin, 2: C.botNina,
};
const HOLD_MS = 3000;

function cardColor(suit: string): string {
  return suit === 'hearts' || suit === 'diamonds' ? C.suitRed : C.suitBlack;
}

function CardBadge({ rank, suit, large }: { rank: string; suit: string; large?: boolean }) {
  return (
    <span style={{
      fontSize: large ? 14 : 12, fontWeight: 700,
      color: cardColor(suit), fontFamily: 'Inter, sans-serif',
      background: 'rgba(255,255,255,0.9)', borderRadius: 3,
      padding: large ? '2px 5px' : '1px 4px',
      border: large ? `1px solid ${C.indigo}44` : 'none',
    }}>
      {rank}{SUIT_SYMBOLS[suit] ?? ''}
    </span>
  );
}

export function LastCaptureCallout({ info }: { info: LastCaptureInfo | null }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<LastCaptureInfo | null>(null);

  useEffect(() => {
    if (!info) return;
    setCurrent(info);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [info]);

  const borderColor = current ? (PLAYER_COLORS[current.playerIndex] ?? C.textSecondary) : C.textSecondary;

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tween.default}
          style={{
            width: '100%', padding: '4px 12px 6px',
            borderBottom: `1px solid ${borderColor}66`,
            display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: 'center', flexShrink: 0, flexWrap: 'wrap',
          }}
        >
          <span style={{
            fontSize: 9, fontWeight: 500, color: C.textSecondary,
            letterSpacing: 1, fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase', flexShrink: 0,
          }}>LAST CAPTURE</span>

          {current.baseCard && (
            <>
              <CardBadge rank={current.baseCard.rank} suit={current.baseCard.suit} large />
              <span style={{ fontSize: 12, color: C.textSecondary }}>=</span>
            </>
          )}
          <span style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            {current.comboCards.map((c, i) => (
              <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {i > 0 && <span style={{ fontSize: 11, color: C.textSecondary }}>+</span>}
                <CardBadge rank={c.rank} suit={c.suit} />
              </span>
            ))}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.amber,
            fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
          }}>+{current.points}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
