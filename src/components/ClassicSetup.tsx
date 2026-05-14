import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { Difficulty } from '../engine/types';
import { getTransition } from '../config/motion';
import { isJettUnlockedInClassic } from '../engine/adventure/progressManager';

const JADE = '#065F46';
const BG = '#0A0A0A';
const TARGET_PRESETS = [100, 300, 500, 1000] as const;

type BotId = 'calvin' | 'nina' | 'rex' | 'jett';

const BOTS: { id: BotId; name: string; color: string; textOnAvatar: string; difficulty: Difficulty; label: string; flavor: string }[] = [
  { id: 'calvin', name: 'Calvin', color: '#3B82F6', textOnAvatar: '#fff',    difficulty: 'beginner',     label: 'Easy',   flavor: 'Cautious, hesitant. Easy.' },
  { id: 'nina',   name: 'Nina',   color: '#DBEAFE', textOnAvatar: '#1E293B', difficulty: 'intermediate', label: 'Medium', flavor: 'Balanced, calculating. Medium.' },
  { id: 'rex',    name: 'Rex',    color: '#DC2626', textOnAvatar: '#fff',    difficulty: 'advanced',     label: 'Hard',   flavor: 'Aggressive, combo-greedy. Hard.' },
  { id: 'jett',   name: 'Jett',   color: '#0D9488', textOnAvatar: '#fff',    difficulty: 'expert',       label: 'Expert', flavor: 'Patient, relentless. Expert.' },
];

interface Props {
  onStart: (targetScore: number, bot1: Difficulty, bot2: Difficulty) => void;
  onBack: () => void;
}

export function ClassicSetup({ onStart, onBack }: Props) {
  const [targetScore, setTargetScore] = useState(300);
  const [selectedBots, setSelectedBots] = useState<BotId[]>([]);
  const [jettUnlocked, setJettUnlocked] = useState(false);

  useEffect(() => { setJettUnlocked(isJettUnlockedInClassic()); }, []);

  const toggleBot = (id: BotId) => {
    if (id === 'jett' && !jettUnlocked) return;
    setSelectedBots((prev) => {
      if (prev.includes(id)) return prev.filter((b) => b !== id);
      if (prev.length < 2) return [...prev, id];
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
      width: '100vw', height: '100dvh', background: BG,
      backgroundImage: 'radial-gradient(circle at 30% 10%, rgba(6,95,70,0.10) 0%, transparent 50%), radial-gradient(circle at 80% 90%, rgba(232,197,119,0.05) 0%, transparent 50%)',
      display: 'flex', flexDirection: 'column',
      padding: '16px 20px 24px',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} transition={getTransition('snappy')} style={{
          width: 36, height: 36, borderRadius: 99,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</motion.button>
        <h2 style={{ fontWeight: 900, fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>Classic Setup</h2>
      </div>

      {/* Target Score */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.22em', textTransform: 'uppercase' as const }}>
          TARGET SCORE
        </span>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {TARGET_PRESETS.map((val) => {
            const selected = targetScore === val;
            return (
              <motion.button key={val} onClick={() => setTargetScore(val)} whileTap={{ scale: 0.95 }} transition={getTransition('snappy')} style={{
                flex: 1, height: 44, borderRadius: 10,
                border: selected ? `2px solid ${JADE}` : '1px solid rgba(255,255,255,0.1)',
                background: selected ? 'rgba(6,95,70,0.18)' : 'transparent',
                boxShadow: selected ? `0 0 12px rgba(6,95,70,0.3)` : 'none',
                color: '#fff',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700, fontSize: 16, cursor: 'pointer',
                transition: 'border 150ms, background 150ms, box-shadow 150ms',
              }}>
                {val}
              </motion.button>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, display: 'block' }}>
          First to target wins after a round ends
        </span>
      </div>

      {/* Opponents */}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.22em', textTransform: 'uppercase' as const }}>
          PICK 2 OPPONENTS
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {BOTS.map((bot) => {
            const selected = selectedBots.includes(bot.id);
            const locked = bot.id === 'jett' && !jettUnlocked;
            return (
              <motion.button key={bot.id} onClick={() => toggleBot(bot.id)} whileTap={locked ? undefined : { scale: 0.97 }} transition={getTransition('snappy')} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                border: selected ? `2px solid ${bot.color}` : '1px solid rgba(255,255,255,0.08)',
                boxShadow: selected ? `0 0 14px ${bot.color}44` : 'none',
                background: selected ? 'rgba(255,255,255,0.04)' : 'transparent',
                cursor: locked ? 'default' : 'pointer', textAlign: 'left' as const, width: '100%',
                opacity: locked ? 0.55 : 1,
                transition: 'border 200ms, box-shadow 200ms, opacity 200ms',
                position: 'relative' as const,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 20,
                  background: selected ? bot.color : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: selected ? bot.textOnAvatar : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 18, flexShrink: 0,
                  transition: 'background 200ms, color 200ms',
                }}>
                  {bot.name[0]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: selected ? bot.color : 'rgba(255,255,255,0.35)', transition: 'color 200ms' }}>
                      {bot.name}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: selected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', transition: 'color 200ms' }}>
                      {bot.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', fontStyle: 'italic', transition: 'color 200ms' }}>
                    {locked ? 'Beat Adventure World 4 to unlock' : bot.flavor}
                  </span>
                </div>
                {locked && (
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 14, color: 'rgba(255,255,255,0.45)',
                  }}>&#128274;</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Start Game */}
      <motion.button onClick={handleStart} disabled={!canStart}
        whileTap={canStart ? { scale: 0.97 } : undefined} transition={getTransition('snappy')}
        style={{
          width: '100%', height: 52, borderRadius: 99, border: 'none',
          background: canStart ? JADE : 'rgba(6,95,70,0.3)',
          color: canStart ? '#fff' : 'rgba(255,255,255,0.5)',
          fontWeight: 800, fontSize: 16, letterSpacing: '0.08em',
          cursor: canStart ? 'pointer' : 'default',
          marginTop: 16, flexShrink: 0,
          boxShadow: canStart ? '0 2px 12px rgba(6,95,70,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        START GAME <span style={{ fontSize: 18 }}>→</span>
      </motion.button>
    </div>
  );
}
