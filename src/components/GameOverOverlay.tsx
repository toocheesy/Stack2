import { AnimatePresence, motion } from 'motion/react';
import type { CaptureRecord, Difficulty, GamePlayerStats, GameState, PlayerIndex } from '../engine/types';
import { SCORE_KEYS } from '../engine/types';
import { C } from '../config/colors';
import { getTransition } from '../config/motion';

const PLAYER_INFO: Record<number, { label: string; defaultColor: string }> = {
  0: { label: 'YOU', defaultColor: C.amber },
  1: { label: 'Bot 1', defaultColor: C.textPrimary },
  2: { label: 'Bot 2', defaultColor: C.textPrimary },
};

const BOT_DISPLAY: Record<Difficulty, { name: string; color: string }> = {
  beginner:     { name: 'Calvin', color: C.botCalvin },
  intermediate: { name: 'Nina',   color: C.botNina },
  advanced:     { name: 'Rex',    color: C.botRex },
};

interface Props {
  winner: { winner: PlayerIndex; winnerName: string } | null;
  state: GameState;
  onPlayAgain: () => void;
  onHome: () => void;
}

function getPlayerDisplay(idx: PlayerIndex, state: GameState): { name: string; color: string } {
  if (idx === 0) return { name: 'YOU', color: C.amber };
  const d = idx === 1 ? state.settings.bot1Personality : state.settings.bot2Personality;
  const b = BOT_DISPLAY[d];
  return { name: b.name, color: b.color };
}

function formatHighest(record: CaptureRecord | null): string | null {
  if (!record) return null;
  const others = record.cards.filter((c) => c.id !== record.baseCard.id);
  if (others.length === 0) return record.baseCard.rank;
  return `${record.baseCard.rank} = ${others.map((c) => c.rank).join('+')}`;
}

export function GameOverOverlay({ winner, state, onPlayAgain, onHome }: Props) {
  if (!winner) return null;

  const target = state.settings.targetScore;
  const winnerDisplay = getPlayerDisplay(winner.winner, state);
  const isHumanWin = winner.winner === 0;

  const players: { idx: PlayerIndex; name: string; color: string; score: number; stats: GamePlayerStats }[] = (
    [0, 1, 2] as PlayerIndex[]
  ).map((idx) => {
    const d = getPlayerDisplay(idx, state);
    return {
      idx,
      name: d.name,
      color: d.color,
      score: state.overallScores[SCORE_KEYS[idx]],
      stats: state.gameStats[idx],
    };
  });
  players.sort((a, b) => b.score - a.score);

  const winnerStats = state.gameStats[winner.winner];
  const bestEver = formatHighest(winnerStats.highestCapture);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, zIndex: 200, padding: '24px 16px',
        }}
      >
        {/* Winner section */}
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 2,
          color: C.textSecondary, fontFamily: 'Inter, sans-serif',
          textTransform: 'uppercase',
        }}>
          {isHumanWin ? 'VICTORY' : 'GAME OVER'}
        </span>

        <motion.h1
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{
            fontSize: 28, fontWeight: 800, margin: 0,
            fontFamily: 'Inter, sans-serif',
            color: winnerDisplay.color,
          }}
        >
          {isHumanWin ? 'YOU WIN!' : `${winnerDisplay.name} Wins`}
        </motion.h1>

        <span style={{
          fontSize: 24, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: C.textPrimary,
        }}>
          {players[0].score}<span style={{ fontSize: 14, color: C.textSecondary, opacity: 0.6 }}>/{target}</span>
        </span>

        {bestEver && (
          <span style={{
            fontSize: 11, color: C.textSecondary,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Best capture: {bestEver}
            <span style={{ color: C.amber, fontWeight: 600 }}> +{winnerStats.highestCapture!.points}</span>
          </span>
        )}

        {/* All players */}
        <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {players.map((p) => {
            const isWinner = p.idx === winner.winner;
            return (
              <div key={p.idx} style={{
                padding: '8px 12px', borderRadius: 6,
                background: isWinner ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                borderLeft: `3px solid ${p.color}`,
                opacity: isWinner ? 1 : 0.7,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: isWinner ? 13 : 12, fontWeight: isWinner ? 700 : 500,
                  color: p.color, fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase',
                }}>
                  {p.name}
                </span>
                <span style={{
                  fontSize: isWinner ? 18 : 14, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: isWinner ? C.textPrimary : C.textSecondary,
                }}>
                  {p.score}
                </span>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <motion.button
            onClick={onPlayAgain}
            whileTap={{ scale: 0.97 }}
            transition={getTransition('snappy')}
            style={{
              padding: '12px 28px', borderRadius: 6,
              border: 'none', background: C.indigo,
              color: C.card, fontSize: 15, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            }}
          >
            PLAY AGAIN
          </motion.button>
          <motion.button
            onClick={onHome}
            whileTap={{ scale: 0.97 }}
            transition={getTransition('snappy')}
            style={{
              padding: '12px 24px', borderRadius: 6,
              border: `1px solid ${C.textSecondary}`,
              background: 'transparent',
              color: C.textSecondary, fontSize: 15, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            }}
          >
            HOME
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
