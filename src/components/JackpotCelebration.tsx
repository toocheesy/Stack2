import { AnimatePresence, motion } from 'motion/react';
import type { Difficulty, PlayerIndex } from '../engine/types';
import { C } from '../config/colors';

const BOT_DISPLAY: Record<Difficulty, { name: string; color: string }> = {
  beginner:     { name: 'Calvin', color: C.botCalvin },
  intermediate: { name: 'Nina',   color: C.botNina },
  advanced:     { name: 'Rex',    color: C.botRex },
};

export interface JackpotDisplay {
  winner: PlayerIndex;
  points: number;
  cardCount: number;
}

interface Props {
  info: JackpotDisplay | null;
  bot1Personality: Difficulty;
  bot2Personality: Difficulty;
}

export function JackpotCelebration({ info, bot1Personality, bot2Personality }: Props) {
  let winnerName = 'You';
  let winnerColor = C.indigo;
  if (info) {
    if (info.winner === 1) {
      const b = BOT_DISPLAY[bot1Personality];
      winnerName = b.name;
      winnerColor = b.color;
    } else if (info.winner === 2) {
      const b = BOT_DISPLAY[bot2Personality];
      winnerName = b.name;
      winnerColor = b.color;
    }
  }

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, zIndex: 190,
          }}
        >
          <motion.span
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
              fontSize: 32, fontWeight: 800,
              fontFamily: 'Inter, sans-serif',
              color: C.amber,
              letterSpacing: 3, textTransform: 'uppercase',
            }}
          >
            JACKPOT!
          </motion.span>

          <span style={{
            fontSize: 15, fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            color: winnerColor,
          }}>
            {winnerName} sweeps the board
          </span>

          <span style={{
            fontSize: 22, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: C.amber,
          }}>
            +{info.points}
          </span>

          <span style={{
            fontSize: 11, color: C.textSecondary,
            fontFamily: 'Inter, sans-serif',
          }}>
            {info.cardCount} card{info.cardCount !== 1 ? 's' : ''} captured
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
