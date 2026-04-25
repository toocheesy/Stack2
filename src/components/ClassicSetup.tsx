import { useState } from 'react';
import { motion } from 'motion/react';
import type { Difficulty } from '../engine/types';
import { C } from '../config/colors';
import { getTransition } from '../config/motion';

const TARGET_PRESETS = [100, 300, 500, 1000] as const;

type BotId = 'calvin' | 'nina' | 'rex';

const BOTS: { id: BotId; name: string; color: string; border: string; difficulty: Difficulty; label: string; flavor: string }[] = [
  { id: 'calvin', name: 'Calvin', color: C.botCalvin, border: '#93C5FD', difficulty: 'beginner',     label: 'Easy',   flavor: 'Cautious, hesitant. Easy.' },
  { id: 'nina',   name: 'Nina',   color: C.botNina,   border: '#C4B5FD', difficulty: 'intermediate', label: 'Medium', flavor: 'Balanced, calculating. Medium.' },
  { id: 'rex',    name: 'Rex',    color: C.botRex,     border: '#FCA5A5', difficulty: 'advanced',     label: 'Hard',   flavor: 'Aggressive, combo-greedy. Hard.' },
];

interface Props {
  onStart: (targetScore: number, bot1: Difficulty, bot2: Difficulty) => void;
  onBack: () => void;
}

export function ClassicSetup({ onStart, onBack }: Props) {
  const [targetScore, setTargetScore] = useState(300);
  const [selectedBots, setSelectedBots] = useState<BotId[]>([]);

  const toggleBot = (id: BotId) => {
    setSelectedBots((prev) => {
      if (prev.includes(id)) return prev.filter((b) => b !== id);
      if (prev.length < 2) return [...prev, id];
      // Third tap: drop oldest, add new
      return [prev[1], id];
    });
  };

  const canStart = selectedBots.length === 2;

  const handleStart = () => {
    if (!canStart) return;
    const bot1 = BOTS.find((b) => b.id === selectedBots[0])!;
    const bot2 = BOTS.find((b) => b.id === selectedBots[1])!;
    onStart(targetScore, bot1.difficulty, bot2.difficulty);
  };

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: C.slateBg,
      display: 'flex', flexDirection: 'column',
      padding: '16px 20px 24px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          transition={getTransition('snappy')}
          style={{
            width: 36, height: 36, borderRadius: 8,
            border: `1px solid ${C.divider}`, background: 'transparent',
            color: C.textSecondary, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          ←
        </motion.button>
        <h2 style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18,
          color: C.textPrimary, margin: 0,
        }}>
          Classic Setup
        </h2>
      </div>

      {/* Target Score */}
      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
          color: C.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          TARGET SCORE
        </span>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {TARGET_PRESETS.map((val) => {
            const selected = targetScore === val;
            return (
              <motion.button
                key={val}
                onClick={() => setTargetScore(val)}
                whileTap={{ scale: 0.95 }}
                transition={getTransition('snappy')}
                style={{
                  flex: 1, height: 42, borderRadius: 8,
                  border: selected ? `2px solid ${C.indigo}` : `1px solid ${C.divider}`,
                  background: selected ? 'rgba(79,70,229,0.1)' : 'transparent',
                  color: selected ? C.textPrimary : C.textSecondary,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700, fontSize: 16, cursor: 'pointer',
                }}
              >
                {val}
              </motion.button>
            );
          })}
        </div>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 11,
          color: C.disabledText, marginTop: 6, display: 'block',
        }}>
          First to target wins after a round ends
        </span>
      </div>

      {/* Opponents */}
      <div style={{ flex: 1 }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
          color: C.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          PICK 2 OPPONENTS
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {BOTS.map((bot) => {
            const selected = selectedBots.includes(bot.id);
            return (
              <motion.button
                key={bot.id}
                onClick={() => toggleBot(bot.id)}
                whileTap={{ scale: 0.97 }}
                transition={getTransition('snappy')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: selected ? `2px solid ${bot.color}` : `1px solid ${C.divider}`,
                  boxShadow: selected ? `0 0 12px ${bot.color}33` : 'none',
                  background: selected ? 'rgba(255,255,255,0.04)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left' as const,
                  width: '100%',
                  transition: 'border 150ms, box-shadow 150ms',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 20,
                  background: selected ? bot.color : C.disabled,
                  border: `2px solid ${selected ? bot.border : C.divider}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFF', fontWeight: 700, fontSize: 18,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background 150ms, border 150ms',
                  flexShrink: 0,
                }}>
                  {bot.name[0]}
                </div>
                {/* Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15,
                      color: selected ? bot.color : C.disabledText,
                      transition: 'color 150ms',
                    }}>
                      {bot.name}
                    </span>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500,
                      color: selected ? C.textSecondary : C.disabledText,
                      transition: 'color 150ms',
                    }}>
                      {bot.label}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 11,
                    color: selected ? C.textSecondary : C.disabledText,
                    fontStyle: 'italic',
                    transition: 'color 150ms',
                  }}>
                    {bot.flavor}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Start Game */}
      <motion.button
        onClick={handleStart}
        disabled={!canStart}
        whileTap={canStart ? { scale: 0.97 } : undefined}
        transition={getTransition('snappy')}
        style={{
          width: '100%', height: 52, borderRadius: 12,
          border: 'none',
          background: canStart ? C.indigo : C.disabled,
          color: canStart ? '#FFF' : C.disabledText,
          fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 18,
          cursor: canStart ? 'pointer' : 'default',
          marginTop: 16,
          flexShrink: 0,
        }}
      >
        START GAME
      </motion.button>
    </div>
  );
}
