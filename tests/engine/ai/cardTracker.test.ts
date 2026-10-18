import { describe, expect, it } from 'vitest';
import {
  createCardTracker,
  estimateDeckComposition,
  getRemainingOfRank,
  readCardMemory,
  updateGamePhase,
} from '../../../src/engine/ai/cardTracker';
import { createInitialState, startNewRound } from '../../../src/engine/core/gameState';
import { createPRNG } from '../../../src/engine/utils/prng';
import { RANKS } from '../../../src/engine/types';
import type { GameSettings, GameState, Rank } from '../../../src/engine/types';

const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

function fresh(seed = 42): GameState {
  return createInitialState(settings, createPRNG(seed));
}

function ofRank(cards: readonly { rank: Rank }[], rank: Rank): number {
  return cards.filter((c) => c.rank === rank).length;
}

// A memory with the given totals, for the readers' own tests.
function memoryWith(totalSeen: number, counts: Partial<Record<Rank, number>> = {}) {
  const t = createCardTracker();
  t.totalSeen = totalSeen;
  t.deckRemaining = 52 - totalSeen;
  for (const [rank, n] of Object.entries(counts)) t.valueCounts[rank as Rank] = n;
  return t;
}

describe('createCardTracker', () => {
  it('is an empty memory', () => {
    const t = createCardTracker();
    expect(t.totalSeen).toBe(0);
    expect(t.deckRemaining).toBe(52);
    expect(t.gamePhase).toBe('early');
    for (const r of RANKS) expect(t.valueCounts[r]).toBe(0);
  });
});

describe('readCardMemory (S-008)', () => {
  it('on a fresh game: 16 seen, 36 in the deck, phase mid, each rank counted as it sits on the board', () => {
    const s = fresh();
    const m = readCardMemory(s);
    expect(m.totalSeen).toBe(16);
    expect(m.deckRemaining).toBe(36);
    expect(m.gamePhase).toBe('mid');
    for (const r of RANKS) expect(m.valueCounts[r]).toBe(ofRank(s.board, r));
  });

  it('no hand counts as seen, a bot\'s own included', () => {
    const s = fresh(7);
    const m = readCardMemory(s);
    const counted = RANKS.reduce((n, r) => n + m.valueCounts[r], 0);
    expect(counted).toBe(s.board.length);
    expect(s.hands.flat().length).toBe(12);
  });

  it('counts a card once it has left the deck and the hands, whether on the board or captured', () => {
    const s = fresh();
    // Bot 1 captures a pair: both cards leave the state; the other three hand cards are placed.
    const [h0, h1, h2, h3] = s.hands[1];
    const after: GameState = {
      ...s,
      hands: [s.hands[0], [], s.hands[2]],
      board: [...s.board, h1, h2, h3],
    };
    const m = readCardMemory(after);
    expect(m.totalSeen).toBe(16);
    expect(m.deckRemaining).toBe(36);
    const expected = { ...readCardMemory(s).valueCounts };
    for (const c of [h0, h1, h2, h3]) expected[c.rank] += 1;
    expect(m.valueCounts).toEqual(expected);
  });

  it('a new round starts the memory afresh (RULES.md Classic rule 2)', () => {
    const s = fresh();
    // Round 1 played out: the deck and every hand are empty, so everything is seen.
    const played: GameState = { ...s, deck: [], hands: [[], [], []], board: [], gamePhase: 'roundEnd' };
    const end = readCardMemory(played);
    expect(end.totalSeen).toBe(52);
    expect(end.gamePhase).toBe('endgame');
    for (const r of RANKS) expect(end.valueCounts[r]).toBe(4);

    const next = startNewRound(played, createPRNG(9));
    const m = readCardMemory(next);
    expect(m.totalSeen).toBe(16);
    expect(m.deckRemaining).toBe(36);
    expect(m.gamePhase).toBe('mid');
    for (const r of RANKS) expect(m.valueCounts[r]).toBe(ofRank(next.board, r));
    expect(getRemainingOfRank(m, 'A')).toBe(4 - ofRank(next.board, 'A'));
  });

  it('leaves the state as it was', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    readCardMemory(s);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('getRemainingOfRank', () => {
  it('returns 4 minus the count seen', () => {
    expect(getRemainingOfRank(createCardTracker(), '5')).toBe(4);
    expect(getRemainingOfRank(memoryWith(2, { '5': 2 }), '5')).toBe(2);
    expect(getRemainingOfRank(memoryWith(4, { '5': 4 }), '5')).toBe(0);
  });
});

describe('estimateDeckComposition', () => {
  it('returns remaining counts per rank', () => {
    const comp = estimateDeckComposition(memoryWith(1, { K: 1 }));
    expect(comp.K).toBe(3);
    expect(comp.A).toBe(4);
  });
});

describe('updateGamePhase', () => {
  it('transitions at 25/50/75% of the deck seen', () => {
    expect(updateGamePhase(memoryWith(0))).toBe('early');
    expect(updateGamePhase(memoryWith(12))).toBe('early');
    expect(updateGamePhase(memoryWith(13))).toBe('mid');
    expect(updateGamePhase(memoryWith(25))).toBe('mid');
    expect(updateGamePhase(memoryWith(26))).toBe('late');
    expect(updateGamePhase(memoryWith(38))).toBe('late');
    expect(updateGamePhase(memoryWith(39))).toBe('endgame');
    expect(updateGamePhase(memoryWith(52))).toBe('endgame');
  });
});
