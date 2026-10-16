import { describe, expect, it } from 'vitest';
import type { GameSettings, PlayerIndex } from '../../src/engine/types';
import { SCORE_KEYS } from '../../src/engine/types';
import { playGame } from '../engine/fullGame/runner';

// S-006: one score. overallScores is the sum of every capture and every
// Take the Table so far in the game; pointsThisRound is only this round's.
const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

describe('one score (S-006)', () => {
  it.each(SEEDS)('seed %i: after each round, overallScores is the game total and pointsThisRound the round total', (seed) => {
    let roundEnds = 0;
    const result = playGame(seed, settings, {
      onRoundEnd: (state, log) => {
        roundEnds++;
        const round = state.currentRound;
        expect('scores' in state).toBe(false);
        for (const p of [0, 1, 2] as PlayerIndex[]) {
          const key = SCORE_KEYS[p];
          const points = (inRound: boolean) =>
            log.moves.filter((m) => m.player === p && (!inRound || m.round === round)).reduce((sum, m) => sum + m.points, 0) +
            log.sweeps.filter((s) => s.player === p && (!inRound || s.round === round)).reduce((sum, s) => sum + s.points, 0);
          expect(state.overallScores[key]).toBe(points(false));
          expect(state.roundStats[p].pointsThisRound).toBe(points(true));
          expect('totalScore' in state.gameStats[p]).toBe(false);
        }
      },
    });
    expect(roundEnds).toBe(result.rounds);
    expect(result.rounds).toBeGreaterThanOrEqual(2);
  });
});
