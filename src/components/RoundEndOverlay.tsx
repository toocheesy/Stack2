import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CaptureRecord, Difficulty, RoundStats, Scores } from '../engine/types';
import { C, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';
import { getTransition } from '../config/motion';

const BOT_DISPLAY: Record<Difficulty, { name: string; color: string }> = {
  beginner:     { name: 'Calvin', color: C.line.classic },
  intermediate: { name: 'Nina',   color: C.botAzure },
  advanced:     { name: 'Rex',    color: C.botWisteria },
  expert:       { name: 'Jett',   color: C.line.classic },
};

const AUTO_ADVANCE_SEC = 10;

interface Props {
  visible: boolean;
  roundNumber: number;
  roundStats: [RoundStats, RoundStats, RoundStats];
  overallScores: Scores;
  targetScore: number;
  bot1Personality: Difficulty;
  bot2Personality: Difficulty;
  onContinue: () => void;
  // Both sides' CONTINUE is Classic's gold in release 1 (D-007); the prop stays for the caller.
  adventureMode?: boolean;
}

function formatHighest(record: CaptureRecord | null): string | null {
  if (!record) return null;
  const others = record.cards.filter((c) => c.id !== record.baseCard.id);
  if (others.length === 0) return record.baseCard.rank;
  return `${record.baseCard.rank} = ${others.map((c) => c.rank).join('+')}`;
}

export function RoundEndOverlay({
  visible, roundNumber, roundStats, overallScores, targetScore,
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
    { name: 'YOU', color: C.accent.classic, rs: roundStats[0], total: overallScores.player },
    { name: bot1.name, color: bot1.color, rs: roundStats[1], total: overallScores.bot1 },
    { name: bot2.name, color: bot2.color, rs: roundStats[2], total: overallScores.bot2 },
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
            background: alpha(C.classicTable, 0.78),
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, zIndex: 200, padding: '24px 16px',
          }}
        >
          <h2 style={{
            fontSize: 18, fontWeight: 400,
            fontFamily: FONTS.display,
            color: C.ink.classic,
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
                background: alpha(C.ink.classic, 0.04),
                borderLeft: `3px solid ${p.color}`,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: p.color,
                  fontFamily: FONTS.sans, textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>{p.name}</span>

                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, fontFamily: FONTS.sans,
                }}>
                  <span style={{ color: C.muted.classic }}>
                    Total: <span style={{ color: C.ink.classic, fontWeight: 600 }}>{p.total}</span>
                    <span style={{ opacity: 0.5 }}>/{targetScore}</span>
                    {' · +'}<span style={{ color: C.ink.classic, fontWeight: 600 }}>{p.rs.pointsThisRound}</span>{' this round'}
                  </span>
                </div>

                <span style={{
                  fontSize: 11, fontFamily: FONTS.sans,
                  color: C.muted.classic,
                  fontStyle: best ? 'normal' : 'italic',
                }}>
                  {best ? (
                    <>
                      {best}
                      <span style={{ color: C.accent.classic, fontWeight: 600 }}> +{p.rs.highestCapture!.points}</span>
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
              border: 'none',
              background: C.classicGold,
              color: C.classicTable,
              fontSize: 14, fontWeight: 700,
              fontFamily: FONTS.sans, cursor: 'pointer',
              marginTop: 4,
            }}
          >
            CONTINUE
          </motion.button>

          <span style={{
            fontSize: 11, color: C.muted.classic,
            fontFamily: FONTS.sans,
          }}>
            Next round in {countdown}s...
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
