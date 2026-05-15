import { AnimatePresence, motion } from 'motion/react';
import type { Difficulty, PlayerIndex } from '../engine/types';
import { C } from '../config/colors';

const BOT_DISPLAY: Record<Difficulty, { name: string; color: string }> = {
  beginner:     { name: 'Calvin', color: C.botCalvin },
  intermediate: { name: 'Nina',   color: C.botNina },
  advanced:     { name: 'Rex',    color: C.botRex },
  expert:       { name: 'Jett',   color: C.botJett },
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
  // Language rename L3 — asymmetric Take the Table popup formula:
  //   Player: "TABLE TAKEN!" (active voice, no name — the event IS the celebration)
  //   Bot:    "[BOT] TOOK THE TABLE!" (name-first, all-caps, parallels FIRST BLOOD — JINX)
  // Subtitle ("X sweep(s) the board") dropped — redundant with new headline that already
  // says "took the table." Bundle A's grammar ternary lives on in this comment as
  // documentation if the subtitle ever returns.
  const isPlayer = !info || info.winner === 0;
  let botName = '';
  let winnerColor: string = C.amber;
  if (info && !isPlayer) {
    const b = info.winner === 1 ? BOT_DISPLAY[bot1Personality] : BOT_DISPLAY[bot2Personality];
    botName = b.name;
    winnerColor = b.color;
  }
  const headline = isPlayer ? 'TABLE TAKEN!' : `${botName.toUpperCase()} TOOK THE TABLE!`;

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
            gap: 10, zIndex: 190, padding: '0 24px', textAlign: 'center',
          }}
        >
          <motion.span
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
              fontSize: isPlayer ? 32 : 26, fontWeight: 800,
              fontFamily: 'Inter, sans-serif',
              color: isPlayer ? C.amber : winnerColor,
              letterSpacing: 2, textTransform: 'uppercase',
              lineHeight: 1.1,
            }}
          >
            {headline}
          </motion.span>

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
