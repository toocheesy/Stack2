import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CaptureRecord, Difficulty, GamePlayerStats, RoundStats } from '../engine/types';
import { C } from '../config/colors';
import { getTransition } from '../config/motion';

const BOT_DISPLAY: Record<Difficulty, { name: string; color: string }> = {
  beginner:     { name: 'Calvin', color: C.botCalvin },
  intermediate: { name: 'Nina',   color: C.botNina },
  advanced:     { name: 'Rex',    color: C.botRex },
  expert:       { name: 'Jett',   color: C.botJett },
};

const AUTO_ADVANCE_SEC = 10;

interface Props {
  visible: boolean;
  roundNumber: number;
  roundStats: [RoundStats, RoundStats, RoundStats];
  gameStats: [GamePlayerStats, GamePlayerStats, GamePlayerStats];
  targetScore: number;
  bot1Personality: Difficulty;
  bot2Personality: Difficulty;
  onContinue: () => void;
}

function formatHighest(record: CaptureRecord | null): string | null {
  if (!record) return null;
  const others = record.cards.filter((c) => c.id !== record.baseCard.id);
  if (others.length === 0) return record.baseCard.rank;
  return `${record.baseCard.rank} = ${others.map((c) => c.rank).join('+')}`;
}

export function RoundEndOverlay({
  visible, roundNumber, roundStats, gameStats, targetScore,
  bot1Personality, bot2Personality, onContinue,
}: Props) {
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_SEC);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!visible) { setCountdown(AUTO_ADVANCE_SEC); return; }
    setCountdown(AUTO_ADVANCE_SEC);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onContinueRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const bot1 = BOT_DISPLAY[bot1Personality];
  const bot2 = BOT_DISPLAY[bot2Personality];

  const players = [
    { name: 'YOU', color: C.amber, rs: roundStats[0], gs: gameStats[0] },
    { name: bot1.name, color: bot1.color, rs: roundStats[1], gs: gameStats[1] },
    { name: bot2.name, color: bot2.color, rs: roundStats[2], gs: gameStats[2] },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, zIndex: 200, padding: '24px 16px',
          }}
        >
          <h2 style={{
            fontSize: 18, fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            color: C.textPrimary,
            letterSpacing: 1.5, textTransform: 'uppercase',
            margin: 0,
          }}>
            Round {roundNumber} Complete
          </h2>

          {players.map((p, i) => {
            const best = formatHighest(p.rs.highestCapture);
            return (
              <div key={i} style={{
                width: '100%', maxWidth: 300, padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${p.color}`,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: p.color,
                  fontFamily: 'Inter, sans-serif', textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>{p.name}</span>

                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                }}>
                  <span style={{ color: C.textSecondary }}>
                    Round: <span style={{ color: C.textPrimary, fontWeight: 600 }}>{p.rs.roundScore}</span>
                  </span>
                  <span style={{ color: C.textSecondary }}>
                    Total: <span style={{ color: C.textPrimary, fontWeight: 600 }}>{p.gs.totalScore}</span>
                    <span style={{ opacity: 0.5 }}>/{targetScore}</span>
                  </span>
                </div>

                <span style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  color: best ? C.textSecondary : C.disabledText,
                  fontStyle: best ? 'normal' : 'italic',
                }}>
                  {best ? (
                    <>
                      {best}
                      <span style={{ color: C.amber, fontWeight: 600 }}> +{p.rs.highestCapture!.points}</span>
                    </>
                  ) : 'No captures this round'}
                </span>
              </div>
            );
          })}

          <motion.button
            onClick={onContinue}
            whileTap={{ scale: 0.97 }}
            transition={getTransition('snappy')}
            style={{
              padding: '10px 28px', borderRadius: 6,
              border: 'none', background: C.indigo,
              color: C.card, fontSize: 14, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
              marginTop: 4,
            }}
          >
            CONTINUE
          </motion.button>

          <span style={{
            fontSize: 11, color: C.textSecondary,
            fontFamily: 'Inter, sans-serif',
          }}>
            Next round in {countdown}s...
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
