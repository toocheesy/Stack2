import { describe, expect, it } from 'vitest';
import { calculateCardPoints, calculateCardsPoints, getRankedPlayers } from '../../../src/engine/core/scoring';
import type { Card, GameState } from '../../../src/engine/types';

function makeCard(id: string, rank: Card['rank']): Card {
  return { id, rank, suit: 'hearts', value: 0 };
}

describe('scoring', () => {
  it('Ace = 15', () => {
    expect(calculateCardPoints(makeCard('a', 'A'))).toBe(15);
  });

  it('face cards = 10', () => {
    expect(calculateCardPoints(makeCard('k', 'K'))).toBe(10);
    expect(calculateCardPoints(makeCard('q', 'Q'))).toBe(10);
    expect(calculateCardPoints(makeCard('j', 'J'))).toBe(10);
  });

  it('10 = 10', () => {
    expect(calculateCardPoints(makeCard('t', '10'))).toBe(10);
  });

  it('2-9 = 5', () => {
    for (const r of ['2', '3', '4', '5', '6', '7', '8', '9'] as const) {
      expect(calculateCardPoints(makeCard('x', r))).toBe(5);
    }
  });

  it('calculateCardsPoints sums', () => {
    const cards = [makeCard('a', 'A'), makeCard('k', 'K'), makeCard('5', '5')];
    expect(calculateCardsPoints(cards)).toBe(15 + 10 + 5);
  });

  it('getRankedPlayers sorts descending by round score', () => {
    const state = {
      scores: { player: 20, bot1: 50, bot2: 35 },
      overallScores: { player: 100, bot1: 200, bot2: 150 },
    } as GameState;
    const ranked = getRankedPlayers(state);
    expect(ranked.map((r) => r.index)).toEqual([1, 2, 0]);
    expect(ranked[0].score).toBe(50);
    expect(ranked[0].overall).toBe(200);
  });
});
