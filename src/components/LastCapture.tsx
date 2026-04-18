import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LastCaptureInfo } from '../game/useGameController';

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const SUIT_COLORS: Record<string, string> = {
  hearts: '#DC2626', diamonds: '#DC2626', clubs: '#0F0F1A', spades: '#0F0F1A',
};
const PLAYER_COLORS: Record<number, string> = {
  0: '#F59E0B', 1: '#60A5FA', 2: '#A78BFA',
};

const HOLD_MS = 3000;

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

  const borderColor = current ? (PLAYER_COLORS[current.playerIndex] ?? '#8B8BA3') : '#8B8BA3';

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            width: '100%',
            padding: '4px 12px 6px',
            borderBottom: `1px solid ${borderColor}66`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{
            fontSize: 9, fontWeight: 500, color: '#8B8BA3',
            letterSpacing: 1, fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase' as const,
            flexShrink: 0,
          }}>
            LAST CAPTURE
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#F1F1F3', fontFamily: 'Inter, sans-serif' }}>
            {current.playerName}:
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {current.cards.map((c) => (
              <span key={c.id} style={{
                fontSize: 12, fontWeight: 600,
                color: SUIT_COLORS[c.suit] ?? '#F1F1F3',
                fontFamily: 'Inter, sans-serif',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 3,
                padding: '1px 4px',
              }}>
                {c.rank}{SUIT_SYMBOLS[c.suit] ?? ''}
              </span>
            ))}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#F59E0B',
            fontFamily: "'JetBrains Mono', monospace",
            flexShrink: 0,
          }}>
            +{current.points}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
