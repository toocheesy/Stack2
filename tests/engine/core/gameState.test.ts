import { describe, expect, it } from 'vitest';
import {
  addScore,
  applyJackpot,
  createInitialState,
  dealNewHand,
  executeCapture,
  nextPlayer,
  placeCard,
  resetCombination,
  startNewRound,
} from '../../../src/engine/core/gameState';
import type {
  Card,
  GameSettings,
  GameState,
  Rank,
  ValidatedCapture,
} from '../../../src/engine/types';
import { RANK_VALUES } from '../../../src/engine/types';
import { createPRNG } from '../../../src/engine/utils/prng';
import { createIdGenerator } from '../../../src/engine/utils/uuid';

function settings(): GameSettings {
  return {
    targetScore: 100,
    bot1Personality: 'beginner',
    bot2Personality: 'beginner',
  };
}

function makeState(seed = 1): GameState {
  const prng = createPRNG(seed);
  const gen = createIdGenerator(createPRNG(seed + 1000));
  return createInitialState(settings(), prng, gen);
}

let idCounter = 0;
function card(rank: Rank): Card {
  return {
    id: `tc${++idCounter}`,
    rank,
    suit: 'hearts',
    value: RANK_VALUES[rank],
  };
}

describe('createInitialState', () => {
  it('creates state with 4 cards per hand, 4 on board, remaining deck', () => {
    const s = makeState(42);
    expect(s.hands[0]).toHaveLength(4);
    expect(s.hands[1]).toHaveLength(4);
    expect(s.hands[2]).toHaveLength(4);
    expect(s.board).toHaveLength(4);
    expect(s.deck).toHaveLength(52 - 16);
  });

  it('total cards across all zones = 52', () => {
    const s = makeState(7);
    const total =
      s.deck.length +
      s.board.length +
      s.hands.reduce((acc, h) => acc + h.length, 0);
    expect(total).toBe(52);
  });

  it('all cards have unique IDs', () => {
    const s = makeState(7);
    const ids = new Set<string>();
    for (const c of [...s.deck, ...s.board, ...s.hands.flat()]) ids.add(c.id);
    expect(ids.size).toBe(52);
  });

  it('currentPlayer is (currentDealer + 1) % 3', () => {
    const s = makeState(5);
    expect(s.currentPlayer).toBe(((s.currentDealer + 1) % 3));
  });

  it('is deterministic for same seed', () => {
    const a = makeState(123);
    const b = makeState(123);
    expect(a.hands[0].map((c) => c.id)).toEqual(b.hands[0].map((c) => c.id));
    expect(a.currentDealer).toBe(b.currentDealer);
  });

  it('currentRound=1, round scores zero, lastAction null', () => {
    const s = makeState();
    expect(s.currentRound).toBe(1);
    expect(s.scores).toEqual({ player: 0, bot1: 0, bot2: 0 });
    expect(s.lastAction).toBeNull();
    expect(s.lastCapturer).toBeNull();
  });

  it('dumpActive defaults to false (doctrine 2.7)', () => {
    expect(makeState().dumpActive).toBe(false);
  });
});

describe('dealNewHand', () => {
  it('deals 4 more cards to each player and reduces deck by 12', () => {
    const s = makeState();
    const afterCapture: GameState = {
      ...s,
      hands: [[], [], []],
    };
    const dealt = dealNewHand(afterCapture);
    expect(dealt.hands[0]).toHaveLength(4);
    expect(dealt.hands[1]).toHaveLength(4);
    expect(dealt.hands[2]).toHaveLength(4);
    expect(dealt.deck.length).toBe(afterCapture.deck.length - 12);
  });

  it('returns new state object', () => {
    const s = makeState();
    const dealt = dealNewHand(s);
    expect(dealt).not.toBe(s);
  });

  it('clears dumpActive when new cards are dealt (doctrine 2.7)', () => {
    const s: GameState = { ...makeState(), dumpActive: true };
    const dealt = dealNewHand(s);
    expect(dealt.dumpActive).toBe(false);
  });
});

describe('nextPlayer', () => {
  it('advances currentPlayer mod 3', () => {
    const s = { ...makeState(), currentPlayer: 0 as 0 | 1 | 2 };
    expect(nextPlayer(s).currentPlayer).toBe(1);
    expect(nextPlayer({ ...s, currentPlayer: 2 }).currentPlayer).toBe(0);
  });
});

describe('addScore', () => {
  it('adds to both round and overall scores', () => {
    const s = makeState();
    const s2 = addScore(s, 1, 25);
    expect(s2.scores.bot1).toBe(25);
    expect(s2.overallScores.bot1).toBe(25);
    expect(s).not.toBe(s2);
  });
});

describe('resetCombination', () => {
  it('clears combination', () => {
    const s = makeState();
    const withCombo: GameState = {
      ...s,
      combination: {
        base: s.hands[0][0],
        combo1: [{ card: s.hands[0][1], source: 'hand', originalIndex: 0 }],
        combo2: [],
        combo3: [],
      },
    };
    const cleared = resetCombination(withCombo);
    expect(cleared.combination.base).toBeNull();
    expect(cleared.combination.combo1).toEqual([]);
  });
});

describe('executeCapture', () => {
  it('removes captured cards, scores, sets lastAction=capture, lastCapturer=current', () => {
    const s = makeState();
    const handCard = s.hands[s.currentPlayer][0];
    const boardCard = s.board[0];
    const vc: ValidatedCapture = {
      allCapturedCards: [handCard, boardCard],
      totalPoints: 10,
    };
    const original = s;
    const after = executeCapture(s, vc);
    expect(after.hands[s.currentPlayer].some((c) => c.id === handCard.id)).toBe(
      false,
    );
    expect(after.board.some((c) => c.id === boardCard.id)).toBe(false);
    expect(after.lastAction).toBe('capture');
    expect(after.lastCapturer).toBe(s.currentPlayer);
    expect(after).not.toBe(original);
    expect(original.hands[s.currentPlayer].some((c) => c.id === handCard.id)).toBe(
      true,
    );
  });
});

describe('placeCard', () => {
  it('moves card from hand to board and sets lastAction=place', () => {
    const s = makeState();
    const handCard = s.hands[s.currentPlayer][0];
    const after = placeCard(s, handCard.id);
    expect(after.hands[s.currentPlayer].some((c) => c.id === handCard.id)).toBe(
      false,
    );
    expect(after.board.some((c) => c.id === handCard.id)).toBe(true);
    expect(after.lastAction).toBe('place');
    expect(after).not.toBe(s);
  });

  it('throws if card not in current hand', () => {
    const s = makeState();
    expect(() => placeCard(s, 'bogus')).toThrow();
  });
});

describe('applyJackpot', () => {
  it('gives remaining board to lastCapturer and clears board', () => {
    const base: GameState = {
      ...makeState(),
      board: [card('A'), card('5')],
      lastCapturer: 1,
      overallScores: { player: 0, bot1: 0, bot2: 0 },
      scores: { player: 0, bot1: 0, bot2: 0 },
    };
    const { state: after, jackpotResult } = applyJackpot(base);
    expect(after.board).toEqual([]);
    expect(jackpotResult).not.toBeNull();
    expect(jackpotResult!.player).toBe(1);
    expect(jackpotResult!.points).toBe(20);
    expect(after.scores.bot1).toBe(20);
    expect(after.overallScores.bot1).toBe(20);
  });

  it('returns null when no lastCapturer', () => {
    const s = makeState();
    const { state: after, jackpotResult } = applyJackpot(s);
    expect(jackpotResult).toBeNull();
    expect(after).toBe(s);
  });

  it('returns null when board empty', () => {
    const s: GameState = { ...makeState(), board: [], lastCapturer: 0 };
    const { jackpotResult } = applyJackpot(s);
    expect(jackpotResult).toBeNull();
  });
});

describe('startNewRound', () => {
  it('preserves overallScores, zeroes round scores, advances dealer, increments round', () => {
    const s: GameState = {
      ...makeState(10),
      overallScores: { player: 30, bot1: 40, bot2: 50 },
      scores: { player: 10, bot1: 20, bot2: 30 },
      currentDealer: 1,
      currentRound: 1,
    };
    const prng = createPRNG(99);
    const gen = createIdGenerator(createPRNG(100));
    const next = startNewRound(s, prng, gen);
    expect(next.overallScores).toEqual({ player: 30, bot1: 40, bot2: 50 });
    expect(next.scores).toEqual({ player: 0, bot1: 0, bot2: 0 });
    expect(next.currentDealer).toBe(2);
    expect(next.currentPlayer).toBe(0);
    expect(next.currentRound).toBe(2);
    expect(next.hands[0]).toHaveLength(4);
    expect(next.board).toHaveLength(4);
  });

  it('clears dumpActive at the start of a new round (doctrine 2.7)', () => {
    const s: GameState = { ...makeState(10), dumpActive: true };
    const prng = createPRNG(99);
    const gen = createIdGenerator(createPRNG(100));
    const next = startNewRound(s, prng, gen);
    expect(next.dumpActive).toBe(false);
  });
});
