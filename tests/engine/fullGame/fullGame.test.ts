import { describe, expect, it } from 'vitest';
import type { Difficulty, GameSettings } from '../../../src/engine/types';
import { createDeck } from '../../../src/engine/utils/deck';
import { playGame, type GameLog } from './runner';

// S-006: the shuffle is seeded (architecture rule 2). One seed, one game.
const settings: GameSettings = {
  targetScore: 100,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const ALL_IDS = createDeck()
  .map((c) => c.id)
  .sort();

function roundOpenings(log: GameLog) {
  return log.deals.filter((d) => d.hand === 1);
}

describe('full game from one seed (S-006)', () => {
  it.each(SEEDS)('seed %i played twice gives identical deals, moves, scores and winner', (seed) => {
    const a = playGame(seed, settings);
    const b = playGame(seed, settings);
    expect(b.deals).toEqual(a.deals);
    expect(b.moves).toEqual(a.moves);
    expect(b.scores).toEqual(a.scores);
    expect(b.winner).toBe(a.winner);
    expect(a.moves.length).toBeGreaterThan(0);
    expect(a.rounds).toBeGreaterThanOrEqual(1);
  });

  it('different seeds give different games', () => {
    const a = playGame(1, settings);
    const b = playGame(2, settings);
    expect(a.deals[0]).not.toEqual(b.deals[0]);
  });

  it.each(SEEDS)('seed %i: after every move each of the 52 cards is in exactly one zone', (seed) => {
    let steps = 0;
    playGame(seed, settings, {
      onStep: (state, captured) => {
        steps++;
        const everywhere = [
          ...state.deck.map((c) => c.id),
          ...state.board.map((c) => c.id),
          ...state.hands[0].map((c) => c.id),
          ...state.hands[1].map((c) => c.id),
          ...state.hands[2].map((c) => c.id),
          ...captured,
        ].sort();
        expect(everywhere).toEqual(ALL_IDS);
      },
    });
    expect(steps).toBeGreaterThan(0);
  });

  it('the same seed with different bot difficulties deals the same first-round cards', () => {
    const pairs: [Difficulty, Difficulty][] = [
      ['beginner', 'beginner'],
      ['intermediate', 'advanced'],
      ['expert', 'beginner'],
      ['expert', 'expert'],
    ];
    for (const seed of [3, 11, 19]) {
      const logs = pairs.map(([bot1Personality, bot2Personality]) =>
        playGame(seed, { ...settings, bot1Personality, bot2Personality }),
      );
      for (const log of logs.slice(1)) {
        expect(log.deals[0]).toEqual(logs[0].deals[0]);
      }
      // The deal stream never sees a bot draw, so every round the games share
      // opens with the same cards too.
      const openings = logs.map(roundOpenings);
      const shared = Math.min(...openings.map((o) => o.length));
      for (let r = 0; r < shared; r++) {
        for (const o of openings.slice(1)) expect(o[r]).toEqual(openings[0][r]);
      }
    }
  });
});
