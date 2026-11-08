import { useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import type { Difficulty } from '../engine/types';
import { getTransition } from '../config/motion';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { BOT_COLOURS } from './board/opponents';
import { ChevronLeft, IconButton, Wordmark } from './board/pieces';

// Classic Setup, CS1 (D-007 rulings 25, 26, 32, 61): the target score, the
// four opponents with PICK / PICKED tags in their own colours, no seats (the
// game seats the two by a coin flip), and DEAL ME IN once two are picked.

const TARGET_PRESETS = [100, 300, 500, 1000] as const;

type BotId = 'calvin' | 'nina' | 'rex' | 'jett';

// CS1's four rows, with their words from its script. Jett is pickable for
// every player (ruling 32).
const BOTS: { id: BotId; name: string; difficulty: Difficulty; level: string; desc: string }[] = [
  { id: 'calvin', name: 'Calvin', difficulty: 'beginner',     level: 'EASY',   desc: 'Cautious, hesitant.' },
  { id: 'nina',   name: 'Nina',   difficulty: 'intermediate', level: 'MEDIUM', desc: 'Balanced, calculating.' },
  { id: 'rex',    name: 'Rex',    difficulty: 'advanced',     level: 'HARD',   desc: 'Aggressive, combo-greedy.' },
  { id: 'jett',   name: 'Jett',   difficulty: 'expert',       level: 'EXPERT', desc: 'Patient, relentless.' },
];

const LABEL: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.muted.classic };

interface Props {
  onStart: (targetScore: number, bot1: Difficulty, bot2: Difficulty) => void;
  onBack: () => void;
}

export function ClassicSetup({ onStart, onBack }: Props) {
  const [targetScore, setTargetScore] = useState<number>(300);
  const [picked, setPicked] = useState<BotId[]>([]);

  const toggleBot = (id: BotId) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((b) => b !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id];
    });
  };

  const ready = picked.length === 2;
  const bots = picked.map((id) => BOTS.find((b) => b.id === id)!);
  const summary = ready
    ? `You vs ${bots[0].name} and ${bots[1].name} · first to ${targetScore} · seats by coin flip`
    : 'Pick two opponents to deal.';

  const handleStart = () => {
    if (!ready) return;
    onStart(targetScore, bots[0].difficulty, bots[1].difficulty);
  };

  return (
    <div style={{
      width: '100vw', height: '100dvh', boxSizing: 'border-box', background: C.ground.classic, color: C.ink.classic, fontFamily: FONTS.sans,
      display: 'flex', flexDirection: 'column', padding: '14px 20px 24px',
      overflowX: 'hidden', overflowY: 'auto', touchAction: 'pan-y',
    }}>
      {/* The way back and the wordmark, at CS1's 16px gutter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, margin: '0 -4px', flexShrink: 0 }}>
        <IconButton label="Back" onClick={onBack}><ChevronLeft /></IconButton>
        <Wordmark size={18} />
      </div>

      <div style={{ marginTop: 16, flexShrink: 0 }}>
        <h2 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 34, lineHeight: 1.1, margin: 0, color: C.ink.classic }}>Classic Setup</h2>
        <div style={{ marginTop: 4, fontSize: 13, color: C.muted.classic }}>You against two opponents.</div>
      </div>

      {/* Target score */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <span style={LABEL}>TARGET SCORE</span>
        <div role="radiogroup" aria-label="Target score" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {TARGET_PRESETS.map((v) => {
            const on = v === targetScore;
            return (
              <motion.button key={v} type="button" role="radio" aria-checked={on} onClick={() => setTargetScore(v)} whileTap={{ scale: 0.96 }} transition={getTransition('snappy')} style={{
                height: 48, borderRadius: 6, border: `1px solid ${on ? C.classicGold : C.line.classic}`, background: on ? C.classicGold : C.surface.classic,
                fontFamily: FONTS.display, fontWeight: 400, fontSize: 20, color: on ? C.classicTable : C.ink.classic, cursor: 'pointer',
              }}>
                {v}
              </motion.button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, lineHeight: 1.35, color: C.ink.classic }}>
          First to the target wins, checked when a round ends. <span style={{ color: C.muted.classic }}>A tie at the top plays one more round.</span>
        </span>
      </div>

      {/* Opponents */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={LABEL}>PICK TWO OPPONENTS</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.ink.classic }}>{picked.length} OF 2</span>
        </div>
        {BOTS.map((bot) => {
          const on = picked.includes(bot.id);
          const colour = BOT_COLOURS[bot.difficulty];
          const ring = on ? colour : C.line.classic;
          return (
            <motion.button key={bot.id} type="button" aria-pressed={on} onClick={() => toggleBot(bot.id)} whileTap={{ scale: 0.98 }} transition={getTransition('snappy')} style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 12, height: 78, padding: '0 14px', boxSizing: 'border-box', borderRadius: 6,
              border: on ? `2px solid ${colour}` : `1px solid ${C.line.classic}`, background: C.surface.classic,
              textAlign: 'left', cursor: 'pointer', fontFamily: FONTS.sans, color: C.ink.classic,
            }}>
              <span style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: '50%', boxSizing: 'border-box', border: `2px solid ${ring}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.display, fontWeight: 400, fontSize: 20, color: ring,
              }}>
                {bot.name[0]}
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 19, color: C.ink.classic }}>{bot.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.muted.classic }}>{bot.level}</span>
                </span>
                <span style={{ fontSize: 12, color: C.muted.classic }}>{bot.desc}</span>
              </span>
              <span style={{
                flexShrink: 0, padding: '3px 7px', borderRadius: 3, background: on ? colour : 'transparent', border: `1px solid ${on ? colour : C.line.classic}`,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: on ? C.classicTable : C.ink.classic,
              }}>
                {on ? 'PICKED' : 'PICK'}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Summary and the start button. Starting still ends a saved game without asking (App.tsx). */}
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.35, textAlign: 'center', color: ready ? C.ink.classic : C.muted.classic }}>{summary}</div>
        <motion.button type="button" disabled={!ready} onClick={handleStart} whileTap={ready ? { scale: 0.98 } : undefined} transition={getTransition('snappy')} style={{
          height: 56, borderRadius: 6, border: ready ? 'none' : `1px solid ${C.line.classic}`, background: ready ? C.classicGold : 'transparent',
          fontFamily: FONTS.sans, fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', color: ready ? C.classicTable : C.muted.classic,
          cursor: ready ? 'pointer' : 'default',
        }}>
          {ready ? 'DEAL ME IN' : 'PICK 2 OPPONENTS'}
        </motion.button>
      </div>
    </div>
  );
}
