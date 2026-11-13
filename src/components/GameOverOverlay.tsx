import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Difficulty, GameState, PlayerIndex } from '../engine/types';
import { SCORE_KEYS } from '../engine/types';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { getTransition } from '../config/motion';
import { CardComponent } from './Card';
import { SHEET_DIM, SHEET_GLOW, sheetColourOf } from './board/sheet';
import { captureLine } from './board/words';

// Game over, GO2 The Crown (D-007 rulings 72 and 73): a framed plum card
// lifted off the dimmed table, with the round end sheet's colours, its gold
// edge and glow. The result big, the winner's best capture of the game held
// up at hand size, and a podium with the winner's step in the winner's
// colour: gold only when you win. Never a tie (RULES.md Law 11).

const NAMES: Record<Difficulty, string> = { beginner: 'Calvin', intermediate: 'Nina', advanced: 'Rex', expert: 'Jett' };

interface Props {
  winner: { winner: PlayerIndex } | null;
  state: GameState;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function GameOverOverlay({ winner, state, onPlayAgain, onHome }: Props) {
  const calm = useReducedMotion();
  if (!winner) return null;

  const target = state.settings.targetScore;
  const nameOf = (idx: PlayerIndex) => (idx === 0 ? 'You' : NAMES[idx === 1 ? state.settings.bot1Personality : state.settings.bot2Personality]);
  const players = ([0, 1, 2] as PlayerIndex[]).map((idx) => ({
    idx,
    name: nameOf(idx),
    colour: sheetColourOf(idx, state),
    score: state.overallScores[SCORE_KEYS[idx]],
  }));
  // Finishing order: by score, then by seat. The winner is first (Law 11).
  const order = [...players].sort((a, b) => b.score - a.score || a.idx - b.idx);
  const [first, second, third] = order;
  const you = winner.winner === 0;
  const winnerColour = sheetColourOf(winner.winner, state);
  const winnerName = nameOf(winner.winner);
  const best = state.gameStats[winner.winner].highestCapture;
  const opponents = `${NAMES[state.settings.bot1Personality]} and ${NAMES[state.settings.bot2Personality]}`;

  const step = (p: typeof first, place: '1ST' | '2ND' | '3RD', height: number) => {
    const win = place === '1ST';
    return (
      <div key={p.idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 18, color: p.colour, whiteSpace: 'nowrap' }}>{p.name}</span>
        <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 24, lineHeight: 1, color: C.classicSheetInk }}>{p.score}</span>
        <div style={{
          width: '100%', height, boxSizing: 'border-box', borderRadius: '8px 8px 0 0',
          background: win ? winnerColour : C.classicSheetDeep, border: `1px solid ${win ? winnerColour : C.classicSheetLine}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: win ? C.classicTable : C.classicSheetMuted,
        }}>
          {place}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div key="game-over" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SHEET_DIM }} />
        <motion.section
          aria-label="Game over"
          initial={calm ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute', left: 14, right: 14, top: 56, bottom: 18, boxSizing: 'border-box', padding: '24px 18px 18px',
            background: C.classicSheet, border: `2px solid ${C.classicGold}`, borderRadius: 20, boxShadow: SHEET_GLOW,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', overflowY: 'auto', touchAction: 'pan-y',
            fontFamily: FONTS.sans, color: C.classicSheetInk,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.classicSheetMuted }}>GAME OVER · {state.currentRound} {state.currentRound === 1 ? 'ROUND' : 'ROUNDS'}</div>
          <h2 style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 52, lineHeight: 1.02, color: you ? C.classicGold : C.classicSheetInk }}>
            {you ? 'You win!' : <><span style={{ color: winnerColour }}>{winnerName}</span> wins</>}
          </h2>

          {best && (
            <div style={{ marginTop: 4, padding: '16px 18px 14px', borderRadius: 14, background: C.classicSheetDeep, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                {best.cards.map((c) => <CardComponent key={c.id} card={c} size="hand" />)}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.classicSheetMuted }}>{you ? 'YOUR' : `${winnerName.toUpperCase()}'S`} BEST CAPTURE</span>
              <span>
                <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 22, color: C.classicSheetInk }}>{captureLine(best)}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.classicSheetInk }}>{'  '}+{best.points}</span>
              </span>
            </div>
          )}

          <div style={{ width: '100%', marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 8, borderBottom: `2px solid ${C.classicSheetLine}` }}>
            {step(second, '2ND', 96)}
            {step(first, '1ST', 132)}
            {step(third, '3RD', 72)}
          </div>
          <div style={{ width: '100%', fontSize: 12, color: C.classicSheetMuted }}>Target {target}</div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <motion.button type="button" onClick={onPlayAgain} whileTap={{ scale: 0.98 }} transition={getTransition('snappy')} style={{
              width: '100%', height: 56, borderRadius: 6, border: 'none', background: C.classicGold, fontFamily: FONTS.sans,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: C.classicTable, cursor: 'pointer',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.18em' }}>PLAY AGAIN</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{opponents} · to {target}</span>
            </motion.button>
            <motion.button type="button" onClick={onHome} whileTap={{ scale: 0.98 }} transition={getTransition('snappy')} style={{
              width: '100%', height: 46, borderRadius: 6, border: `1.5px solid ${C.classicSheetInk}`, background: 'transparent', fontFamily: FONTS.sans,
              fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', color: C.classicSheetInk, cursor: 'pointer',
            }}>
              HOME
            </motion.button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
