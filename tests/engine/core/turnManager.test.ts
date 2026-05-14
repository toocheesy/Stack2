import { describe, expect, it } from 'vitest';
import {
  determineTurnResult,
  findNextPlayerWithCards,
} from '../../../src/engine/core/turnManager';
import type {
  Card,
  GameState,
  PlayerIndex,
  Rank,
} from '../../../src/engine/types';
import { RANK_VALUES } from '../../../src/engine/types';

let idCounter = 0;
function card(rank: Rank): Card {
  return {
    id: `tm${++idCounter}`,
    rank,
    suit: 'hearts',
    value: RANK_VALUES[rank],
  };
}

function state(overrides: Partial<GameState>): GameState {
  return {
    deck: [],
    board: [],
    hands: [[], [], []],
    scores: { player: 0, bot1: 0, bot2: 0 },
    overallScores: { player: 0, bot1: 0, bot2: 0 },
    combination: { base: null, combo1: [], combo2: [], combo3: [] },
    currentPlayer: 0,
    lastAction: null,
    lastCapturer: null,
    settings: {
      targetScore: 100,
      bot1Personality: 'beginner',
      bot2Personality: 'beginner',
    },
    currentRound: 1,
    currentDealer: 0,
    handNumber: 1,
    gamePhase: 'playing',
    roundStats: [
      { roundScore: 0, highestCapture: null },
      { roundScore: 0, highestCapture: null },
      { roundScore: 0, highestCapture: null },
    ],
    gameStats: [
      { totalScore: 0, highestCapture: null },
      { totalScore: 0, highestCapture: null },
      { totalScore: 0, highestCapture: null },
    ],
    dumpActive: false,
    ...overrides,
  };
}

describe('findNextPlayerWithCards', () => {
  it('when skipCurrent=false returns current if they have cards', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[card('2')], [card('3')], [card('4')]],
    });
    expect(findNextPlayerWithCards(s, false)).toBe(0);
  });

  it('when skipCurrent=true skips current and finds next', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[card('2')], [card('3')], [card('4')]],
    });
    expect(findNextPlayerWithCards(s, true)).toBe(1);
  });

  it('wraps around', () => {
    const s = state({
      currentPlayer: 2,
      hands: [[card('2')], [], []],
    });
    expect(findNextPlayerWithCards(s, true)).toBe(0);
  });

  it('returns null when no one has cards', () => {
    const s = state({ currentPlayer: 0, hands: [[], [], []] });
    expect(findNextPlayerWithCards(s, false)).toBeNull();
  });
});

describe('determineTurnResult', () => {
  it('capture → current player continues if they have cards', () => {
    const s = state({
      currentPlayer: 1,
      hands: [[card('2')], [card('3'), card('4')], [card('5')]],
      lastAction: 'capture',
    });
    const r = determineTurnResult(s);
    expect(r.type).toBe('CONTINUE_TURN');
    if (r.type === 'CONTINUE_TURN') expect(r.nextPlayer).toBe(1);
  });

  it('capture → next player if current is out', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[], [card('3')], [card('5')]],
      lastAction: 'capture',
    });
    const r = determineTurnResult(s);
    expect(r.type).toBe('CONTINUE_TURN');
    if (r.type === 'CONTINUE_TURN') expect(r.nextPlayer).toBe(1);
  });

  it('place → advances to next player with cards', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[card('2')], [card('3')], [card('5')]],
      lastAction: 'place',
    });
    const r = determineTurnResult(s);
    expect(r.type).toBe('CONTINUE_TURN');
    if (r.type === 'CONTINUE_TURN') expect(r.nextPlayer).toBe(1);
  });

  it('place → wraps past empty player to find next with cards', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[card('2')], [], [card('5')]],
      lastAction: 'place',
    });
    const r = determineTurnResult(s);
    if (r.type === 'CONTINUE_TURN') expect(r.nextPlayer).toBe(2);
    else throw new Error('expected CONTINUE_TURN');
  });

  // ─── Doctrine 2.7 — Forced-Placement Dump trigger ──────────

  it('lone player + just placed → CONTINUE_TURN with dumpActive=true', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[card('2'), card('5')], [], []],
      lastAction: 'place',
    });
    const r = determineTurnResult(s);
    if (r.type !== 'CONTINUE_TURN') throw new Error('expected CONTINUE_TURN');
    expect(r.nextPlayer).toBe(0);
    expect(r.dumpActive).toBe(true);
  });

  it('normal CONTINUE_TURN does not signal dumpActive', () => {
    const s = state({
      currentPlayer: 0,
      hands: [[card('2')], [card('5')], [card('A')]],
      lastAction: 'place',
    });
    const r = determineTurnResult(s);
    if (r.type !== 'CONTINUE_TURN') throw new Error('expected CONTINUE_TURN');
    expect(r.dumpActive).toBeFalsy();
  });

  it('all empty + deck >= 12 → DEAL_NEW_HAND', () => {
    const deck: Card[] = [];
    for (let i = 0; i < 12; i++) deck.push(card('2'));
    const s = state({ hands: [[], [], []], deck, lastAction: 'place' });
    const r = determineTurnResult(s);
    expect(r.type).toBe('DEAL_NEW_HAND');
  });

  // ─── Doctrine 5.7 — position locked within a round ─────────

  it('DEAL_NEW_HAND startingPlayer is always (currentDealer + 1) % 3', () => {
    const deck: Card[] = [];
    for (let i = 0; i < 12; i++) deck.push(card('2'));
    const s = state({
      hands: [[], [], []],
      deck,
      currentDealer: 0,
      currentPlayer: 2,
      lastAction: 'place',
    });
    const r = determineTurnResult(s);
    if (r.type !== 'DEAL_NEW_HAND') throw new Error('expected DEAL_NEW_HAND');
    expect(r.startingPlayer).toBe(1);
  });

  it('startingPlayer ignores who placed last in the prior hand (lock)', () => {
    const deck: Card[] = [];
    for (let i = 0; i < 12; i++) deck.push(card('2'));

    // Round dealer = 1 → round's first player = 2. Vary currentPlayer
    // and lastAction across multiple hands; startingPlayer should
    // remain 2 every time.
    for (const currentPlayer of [0, 1, 2] as PlayerIndex[]) {
      for (const lastAction of ['place', 'capture'] as const) {
        const s = state({
          hands: [[], [], []],
          deck,
          currentDealer: 1,
          currentPlayer,
          lastAction,
        });
        const r = determineTurnResult(s);
        if (r.type !== 'DEAL_NEW_HAND') throw new Error('expected DEAL_NEW_HAND');
        expect(r.startingPlayer).toBe(2);
      }
    }
  });

  it('startingPlayer rotates only when the dealer rotates (round boundary)', () => {
    const deck: Card[] = [];
    for (let i = 0; i < 12; i++) deck.push(card('2'));

    // Each row simulates a freshly started round with a different dealer.
    const cases: Array<[PlayerIndex, PlayerIndex]> = [
      [0, 1],
      [1, 2],
      [2, 0],
    ];
    for (const [dealer, expected] of cases) {
      const s = state({
        hands: [[], [], []],
        deck,
        currentDealer: dealer,
        currentPlayer: dealer, // does not affect startingPlayer
        lastAction: 'place',
      });
      const r = determineTurnResult(s);
      if (r.type !== 'DEAL_NEW_HAND') throw new Error('expected DEAL_NEW_HAND');
      expect(r.startingPlayer).toBe(expected);
    }
  });

  it('all empty + deck < 12 + scores below target → END_ROUND with jackpot', () => {
    const s = state({
      hands: [[], [], []],
      deck: [],
      board: [card('A'), card('K')],
      lastCapturer: 1,
      lastAction: 'place',
      overallScores: { player: 10, bot1: 20, bot2: 30 },
    });
    const r = determineTurnResult(s);
    expect(r.type).toBe('END_ROUND');
    if (r.type === 'END_ROUND') {
      expect(r.jackpotResult).not.toBeNull();
      expect(r.jackpotResult!.points).toBe(25);
      expect(r.scores.bot1).toBe(45);
      expect(r.newDealer).toBe(((s.currentDealer + 1) % 3) as PlayerIndex);
    }
  });

  it('END_GAME when projected overall score >= target after jackpot', () => {
    const s = state({
      hands: [[], [], []],
      deck: [],
      board: [card('A'), card('A'), card('A'), card('A')],
      lastCapturer: 0,
      lastAction: 'place',
      overallScores: { player: 50, bot1: 40, bot2: 30 },
      settings: {
        targetScore: 100,
        bot1Personality: 'beginner',
        bot2Personality: 'beginner',
      },
    });
    const r = determineTurnResult(s);
    expect(r.type).toBe('END_GAME');
    if (r.type === 'END_GAME') {
      expect(r.winner).toBe(0);
      expect(r.scores.player).toBeGreaterThanOrEqual(100);
    }
  });

  it('END_ROUND when no jackpot (lastCapturer null)', () => {
    const s = state({
      hands: [[], [], []],
      deck: [],
      lastCapturer: null,
      lastAction: 'place',
    });
    const r = determineTurnResult(s);
    expect(r.type).toBe('END_ROUND');
    if (r.type === 'END_ROUND') expect(r.jackpotResult).toBeNull();
  });
});
