import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  dealNewHand,
  executeCapture,
  applyJackpot,
  startNewRound,
  addScore,
} from '../gameState';
import { determineTurnResult } from '../turnManager';
import { createPRNG } from '../../utils/prng';
import { createIdGenerator } from '../../utils/uuid';
import { EventBus } from '../../events';
import { findWinner, resolveRoundEnd } from '../../roundManager';
import type { Card, GameSettings, GameState, PlayerIndex, ValidatedCapture } from '../../types';
import { RANK_VALUES } from '../../types';

const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};

function makeState(seed = 42): GameState {
  return createInitialState(
    settings,
    createPRNG(seed),
    createIdGenerator(createPRNG(seed + 1000)),
  );
}

function makeCard(rank: string, suit: string, id: string): Card {
  return {
    id,
    rank: rank as Card['rank'],
    suit: suit as Card['suit'],
    value: RANK_VALUES[rank as Card['rank']] ?? 0,
  };
}

// ─── Initial state ──────────────────────────────────

describe('createInitialState new fields', () => {
  it('includes handNumber = 1', () => {
    expect(makeState().handNumber).toBe(1);
  });

  it('includes gamePhase = playing', () => {
    expect(makeState().gamePhase).toBe('playing');
  });

  it('roundStats start zeroed for all 3 players', () => {
    const s = makeState();
    for (const rs of s.roundStats) {
      expect(rs.roundScore).toBe(0);
      expect(rs.highestCapture).toBeNull();
    }
  });

  it('gameStats start zeroed for all 3 players', () => {
    const s = makeState();
    for (const gs of s.gameStats) {
      expect(gs.totalScore).toBe(0);
      expect(gs.highestCapture).toBeNull();
    }
  });
});

// ─── dealNewHand ────────────────────────────────────

describe('dealNewHand', () => {
  it('increments handNumber', () => {
    const s = makeState();
    const dealt = dealNewHand(s);
    expect(dealt.handNumber).toBe(2);
    expect(dealNewHand(dealt).handNumber).toBe(3);
  });
});

// ─── addScore stat tracking ─────────────────────────

describe('addScore stat tracking', () => {
  it('updates roundStats.roundScore', () => {
    const result = addScore(makeState(), 0, 25);
    expect(result.roundStats[0].roundScore).toBe(25);
    expect(result.roundStats[1].roundScore).toBe(0);
  });

  it('updates gameStats.totalScore', () => {
    const result = addScore(makeState(), 1, 15);
    expect(result.gameStats[1].totalScore).toBe(15);
  });

  it('accumulates across multiple calls', () => {
    let s = makeState();
    s = addScore(s, 2, 10);
    s = addScore(s, 2, 20);
    expect(s.roundStats[2].roundScore).toBe(30);
    expect(s.gameStats[2].totalScore).toBe(30);
  });
});

// ─── executeCapture stat tracking ───────────────────

describe('executeCapture stat tracking', () => {
  it('records highestCapture in roundStats and gameStats', () => {
    let s = makeState();
    const h6 = makeCard('6', 'hearts', 'h6');
    const b6 = makeCard('6', 'spades', 'b6');
    s = {
      ...s,
      currentPlayer: 0 as PlayerIndex,
      hands: [[h6], s.hands[1], s.hands[2]],
      board: [b6],
      combination: {
        base: h6,
        combo1: [{ card: b6, source: 'board', originalIndex: 0 }],
        combo2: [],
        combo3: [],
      },
    };
    const vc: ValidatedCapture = { allCapturedCards: [h6, b6], totalPoints: 10 };
    const result = executeCapture(s, vc);

    expect(result.roundStats[0].highestCapture).not.toBeNull();
    expect(result.roundStats[0].highestCapture!.points).toBe(10);
    expect(result.roundStats[0].highestCapture!.baseCard.id).toBe('h6');
    expect(result.gameStats[0].highestCapture!.points).toBe(10);
  });

  it('does not overwrite highestCapture with a smaller capture', () => {
    let s = makeState();
    // First capture: 20 pts
    const a1 = makeCard('A', 'hearts', 'ah');
    const a2 = makeCard('A', 'spades', 'as');
    s = {
      ...s,
      currentPlayer: 0 as PlayerIndex,
      hands: [[a1, makeCard('3', 'hearts', 'h3')], s.hands[1], s.hands[2]],
      board: [a2, makeCard('3', 'spades', 's3')],
      combination: {
        base: a1,
        combo1: [{ card: a2, source: 'board', originalIndex: 0 }],
        combo2: [],
        combo3: [],
      },
    };
    s = executeCapture(s, { allCapturedCards: [a1, a2], totalPoints: 30 });
    expect(s.roundStats[0].highestCapture!.points).toBe(30);

    // Second capture: 10 pts — must not overwrite
    const c3 = makeCard('3', 'hearts', 'h3');
    const c3b = makeCard('3', 'spades', 's3');
    s = {
      ...s,
      hands: [[c3], s.hands[1], s.hands[2]],
      board: [c3b],
      combination: {
        base: c3,
        combo1: [{ card: c3b, source: 'board', originalIndex: 0 }],
        combo2: [],
        combo3: [],
      },
    };
    s = executeCapture(s, { allCapturedCards: [c3, c3b], totalPoints: 10 });
    expect(s.roundStats[0].highestCapture!.points).toBe(30); // unchanged
  });
});

// ─── applyJackpot stat tracking ─────────────────────

describe('applyJackpot stat tracking', () => {
  it('awards board card points to lastCapturer stats', () => {
    let s = makeState();
    s = {
      ...s,
      board: [makeCard('A', 'hearts', 'ah'), makeCard('10', 'spades', '10s')],
      lastCapturer: 1 as PlayerIndex,
    };
    const { state: result, jackpotResult } = applyJackpot(s);
    expect(jackpotResult!.points).toBe(25);
    expect(result.roundStats[1].roundScore).toBe(25);
    expect(result.gameStats[1].totalScore).toBe(25);
    expect(result.roundStats[1].highestCapture!.points).toBe(25);
  });
});

// ─── startNewRound ──────────────────────────────────

describe('startNewRound', () => {
  it('resets roundStats but preserves gameStats', () => {
    let s = makeState();
    s = addScore(s, 0, 50);
    const next = startNewRound(s, createPRNG(99), createIdGenerator(createPRNG(100)));
    expect(next.roundStats[0].roundScore).toBe(0);
    expect(next.roundStats[0].highestCapture).toBeNull();
    expect(next.gameStats[0].totalScore).toBe(50);
  });

  it('resets handNumber to 1', () => {
    let s = makeState();
    s = dealNewHand(s);
    const next = startNewRound(s, createPRNG(99), createIdGenerator(createPRNG(100)));
    expect(next.handNumber).toBe(1);
  });

  it('sets gamePhase to playing', () => {
    let s = makeState();
    s = { ...s, gamePhase: 'roundEnd' as const };
    const next = startNewRound(s, createPRNG(99), createIdGenerator(createPRNG(100)));
    expect(next.gamePhase).toBe('playing');
  });
});

// ─── Round end detection ────────────────────────────

describe('round end detection', () => {
  it('DEAL_NEW_HAND when deck >= 12 and all hands empty', () => {
    let s = makeState();
    s = { ...s, hands: [[], [], []] as [Card[], Card[], Card[]], deck: s.deck.slice(0, 12) };
    expect(determineTurnResult(s).type).toBe('DEAL_NEW_HAND');
  });

  it('END_ROUND or END_GAME when deck empty and all hands empty', () => {
    let s = makeState();
    s = { ...s, hands: [[], [], []] as [Card[], Card[], Card[]], deck: [] };
    const r = determineTurnResult(s);
    expect(r.type === 'END_ROUND' || r.type === 'END_GAME').toBe(true);
  });
});

// ─── Game over at round boundary only ───────────────

describe('game over at round boundary only', () => {
  it('does NOT end game mid-round even when score >= target', () => {
    let s = makeState();
    s = addScore(s, 0, 350);
    // Player 0 has cards → mid-round, game must NOT end
    const r = determineTurnResult(s);
    expect(r.type).not.toBe('END_GAME');
  });

  it('ends game at round boundary after jackpot pushes score >= target', () => {
    let s = makeState();
    s = addScore(s, 0, 290);
    s = {
      ...s,
      hands: [[], [], []] as [Card[], Card[], Card[]],
      deck: [],
      board: [makeCard('A', 'hearts', 'a1')], // 15 pts jackpot → 305 total
      lastCapturer: 0 as PlayerIndex,
    };
    const r = determineTurnResult(s);
    expect(r.type).toBe('END_GAME');
    if (r.type === 'END_GAME') expect(r.winner).toBe(0);
  });
});

// ─── Tiebreaker ─────────────────────────────────────

describe('tiebreaker', () => {
  it('lastCapturer wins when scores are tied at target', () => {
    let s = makeState();
    s = addScore(s, 0, 300);
    s = addScore(s, 1, 300);
    s = { ...s, lastCapturer: 1 as PlayerIndex, board: [], deck: [], hands: [[], [], []] as [Card[], Card[], Card[]] };
    expect(findWinner(s)).toBe(1);
  });

  it('returns null when nobody has reached target', () => {
    const s = makeState();
    expect(findWinner(s)).toBeNull();
  });
});

// ─── EventBus ───────────────────────────────────────

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus();
    const received: unknown[] = [];
    bus.on('jackpot_resolved', (e) => received.push(e));
    bus.emit({ type: 'jackpot_resolved', winner: 0 as PlayerIndex, cards: [], points: 25 });
    expect(received).toHaveLength(1);
  });

  it('unsubscribe stops delivery', () => {
    const bus = new EventBus();
    const received: unknown[] = [];
    const unsub = bus.on('deck_count_changed', (e) => received.push(e));
    unsub();
    bus.emit({ type: 'deck_count_changed', remainingCards: 10 });
    expect(received).toHaveLength(0);
  });
});

// ─── resolveRoundEnd ────────────────────────────────

describe('resolveRoundEnd', () => {
  it('emits jackpot_resolved and new_round_started when game continues', () => {
    let s = makeState();
    s = {
      ...s,
      hands: [[], [], []] as [Card[], Card[], Card[]],
      deck: [],
      board: [makeCard('5', 'hearts', 'b5')],
      lastCapturer: 2 as PlayerIndex,
    };
    const { state: next, events } = resolveRoundEnd(s, createPRNG(99), createIdGenerator(createPRNG(100)));
    expect(next.gamePhase).toBe('playing');
    expect(next.currentRound).toBe(2);
    const types = events.map((e) => e.type);
    expect(types).toContain('jackpot_resolved');
    expect(types).toContain('round_end');
    expect(types).toContain('new_round_started');
    expect(types).toContain('deck_count_changed');
  });

  it('emits game_over when score >= target after jackpot', () => {
    let s = makeState();
    s = addScore(s, 0, 290);
    s = {
      ...s,
      hands: [[], [], []] as [Card[], Card[], Card[]],
      deck: [],
      board: [makeCard('A', 'hearts', 'a1'), makeCard('10', 'spades', '10s')], // 25 pts → 315
      lastCapturer: 0 as PlayerIndex,
    };
    const { state: final, events } = resolveRoundEnd(s, createPRNG(99), createIdGenerator(createPRNG(100)));
    expect(final.gamePhase).toBe('gameOver');
    const types = events.map((e) => e.type);
    expect(types).toContain('jackpot_resolved');
    expect(types).toContain('game_over');
    expect(types).not.toContain('new_round_started');
  });
});
