import { describe, expect, it } from 'vitest';
import {
  evaluateAllActions,
  evaluateChainCapture,
  scoreCapture,
  scorePlacement,
} from '../../../src/engine/ai/evaluator';
import { createCardTracker } from '../../../src/engine/ai/cardTracker';
import type {
  Card,
  GameState,
  Rank,
  Suit,
} from '../../../src/engine/types';
import { RANK_VALUES } from '../../../src/engine/types';
import { NINA_WEIGHTS } from '../../../src/engine/ai/personalities/nina';

let idCounter = 0;
function card(rank: Rank, suit: Suit = 'hearts'): Card {
  return {
    id: `ev${++idCounter}`,
    rank,
    suit,
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

describe('scoreCapture', () => {
  it('rawPoints equals sum of captured card SCORE_VALUES', () => {
    const hand = card('A');
    const b1 = card('A', 'clubs');
    const s = state({ hands: [[hand], [], []], board: [b1] });
    const t = createCardTracker();
    const score = scoreCapture(s, hand, [hand, b1], 0, t);
    expect(score.rawPoints).toBe(30);
  });

  it('higher-point capture has higher rawPoints', () => {
    const t = createCardTracker();
    const s = state({});
    const a = card('A');
    const aa = card('A', 'clubs');
    const aceScore = scoreCapture(s, a, [a, aa], 0, t);
    const two = card('2');
    const twoTwo = card('2', 'clubs');
    const numScore = scoreCapture(s, two, [two, twoTwo], 0, t);
    expect(aceScore.rawPoints).toBeGreaterThan(numScore.rawPoints);
  });

  it('jackpotValue bonus in late/endgame when flipping lastCapturer', () => {
    const hand = card('A');
    const b1 = card('A', 'clubs');
    const s = state({
      hands: [[hand], [], []],
      board: [b1],
      lastCapturer: 1,
    });
    const t = { ...createCardTracker(), gamePhase: 'endgame' as const };
    const score = scoreCapture(s, hand, [hand, b1], 0, t);
    expect(score.jackpotValue).toBeGreaterThanOrEqual(25);
  });

  it('no jackpot bonus when already lastCapturer', () => {
    const hand = card('A');
    const b1 = card('A', 'clubs');
    const s = state({
      hands: [[hand], [], []],
      board: [b1],
      lastCapturer: 0,
    });
    const t = { ...createCardTracker(), gamePhase: 'endgame' as const };
    const score = scoreCapture(s, hand, [hand, b1], 0, t);
    expect(score.jackpotValue).toBeLessThan(25 + 30);
  });

  it('chainPotential = 20 when remaining hand can still capture', () => {
    const handA = card('5');
    const handB = card('7');
    const b5 = card('5', 'clubs');
    const b7 = card('7', 'clubs');
    const s = state({
      hands: [[handA, handB], [], []],
      board: [b5, b7],
    });
    const t = createCardTracker();
    const score = scoreCapture(s, handA, [handA, b5], 0, t);
    expect(score.chainPotential).toBe(20);
  });

  it('sweep bonus when capture empties board', () => {
    const hand = card('A');
    const b = card('A', 'clubs');
    const s = state({ hands: [[hand], [], []], board: [b] });
    const t = { ...createCardTracker(), gamePhase: 'late' as const };
    const score = scoreCapture(s, hand, [hand, b], 0, t);
    expect(score.jackpotValue).toBeGreaterThanOrEqual(30);
  });
});

describe('scorePlacement', () => {
  it('face cards are safer than low number cards (with a realistic board)', () => {
    const faceHand = card('K');
    const lowHand = card('2');
    const board = [card('3'), card('4'), card('5'), card('6')];
    const s = state({ board });
    const t = createCardTracker();
    const faceScore = scorePlacement(s, faceHand, 0, t);
    const lowScore = scorePlacement(s, lowHand, 0, t);
    expect(faceScore.placementDanger).toBeGreaterThan(lowScore.placementDanger);
  });

  it('endgame placement when not lastCapturer = -10 jackpot penalty', () => {
    const hand = card('K');
    const s = state({ lastCapturer: 1 });
    const t = { ...createCardTracker(), gamePhase: 'endgame' as const };
    const score = scorePlacement(s, hand, 0, t);
    expect(score.jackpotValue).toBe(-10);
  });

  // ─── Doctrine 3.2 — valueLossPenalty (universal floor) ─────

  it('Ace placement carries valueLossPenalty of 22.5 (15 * 1.5)', () => {
    const hand = card('A');
    const s = state({});
    const t = createCardTracker();
    const score = scorePlacement(s, hand, 0, t);
    expect(score.valueLossPenalty).toBe(22.5);
  });

  it('face card placement (K/Q/J) carries valueLossPenalty of 15 (10 * 1.5)', () => {
    const t = createCardTracker();
    const s = state({});
    for (const rank of ['K', 'Q', 'J'] as const) {
      const score = scorePlacement(s, card(rank), 0, t);
      expect(score.valueLossPenalty).toBe(15);
    }
  });

  it('10 placement carries valueLossPenalty of 15 (10 * 1.5)', () => {
    const hand = card('10');
    const s = state({});
    const t = createCardTracker();
    const score = scorePlacement(s, hand, 0, t);
    expect(score.valueLossPenalty).toBe(15);
  });

  it('2-9 placements carry zero valueLossPenalty', () => {
    const s = state({});
    const t = createCardTracker();
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9'] as const) {
      const score = scorePlacement(s, card(rank), 0, t);
      expect(score.valueLossPenalty).toBe(0);
    }
  });

  it('capture scores carry zero valueLossPenalty (placement-only floor)', () => {
    const hand = card('A');
    const board = [card('A', 'clubs')];
    const s = state({ hands: [[hand], [], []], board });
    const t = createCardTracker();
    const score = scoreCapture(s, hand, [hand, ...board], 0, t);
    expect(score.valueLossPenalty).toBe(0);
  });
});

describe('evaluateAllActions', () => {
  it('returns actions sorted by total score desc', () => {
    const hand = card('A');
    const b = card('A', 'clubs');
    const s = state({ hands: [[hand], [], []], board: [b] });
    const t = createCardTracker();
    const actions = evaluateAllActions(s, 0, t, NINA_WEIGHTS);
    expect(actions.length).toBeGreaterThan(0);
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].score.total).toBeGreaterThanOrEqual(actions[i].score.total);
    }
    expect(actions[0].action).toBe('capture');
  });

  it('respects allowMultiSlot=false', () => {
    const hand = card('5');
    const b1 = card('5', 'clubs');
    const b2 = card('2');
    const b3 = card('3');
    const s = state({ hands: [[hand], [], []], board: [b1, b2, b3] });
    const t = createCardTracker();
    const filtered = evaluateAllActions(s, 0, t, NINA_WEIGHTS, {
      allowMultiSlot: false,
    });
    const withMulti = evaluateAllActions(s, 0, t, NINA_WEIGHTS, {
      allowMultiSlot: true,
    });
    expect(
      filtered.some((a) => a.captureDetails?.kind === 'multi'),
    ).toBe(false);
    expect(
      withMulti.some((a) => a.captureDetails?.kind === 'multi'),
    ).toBe(true);
  });

  it('zero-weight dimensions zero out the weighted total but valueLossPenalty floor remains', () => {
    // Doctrine 3.2: valueLossPenalty is unweighted. Even with all weight
    // dimensions at zero, placing a face/Ace/10 still incurs the floor
    // penalty (Ace → -22.5). Captures and 2-9 placements unaffected.
    const hand = card('A');
    const b = card('A', 'clubs');
    const s = state({ hands: [[hand], [], []], board: [b] });
    const t = createCardTracker();
    const zeroWeights = {
      rawPoints: 0,
      chainPotential: 0,
      placementDanger: 0,
      opponentDenial: 0,
      jackpotValue: 0,
      boardControl: 0,
      mistakeRate: 0,
    };
    const actions = evaluateAllActions(s, 0, t, zeroWeights);
    for (const a of actions) {
      if (a.action === 'capture') {
        expect(a.score.total).toBe(0);
      } else {
        // Ace placement carries the doctrine 3.2 floor.
        expect(a.score.total).toBe(-22.5);
      }
    }
  });
});

describe('evaluateChainCapture', () => {
  it('finds a valid two-step chain', () => {
    const h5 = card('5');
    const h7 = card('7');
    const b5 = card('5', 'clubs');
    const b7 = card('7', 'clubs');
    const s = state({
      hands: [[h5, h7], [], []],
      board: [b5, b7],
    });
    const plan = evaluateChainCapture(s, 0, s.hands[0], s.board);
    expect(plan).not.toBeNull();
    expect(plan!.firstCapture.handCard.id).not.toBe(
      plan!.secondCapture.handCard.id,
    );
    expect(plan!.totalPoints).toBeGreaterThan(0);
  });

  it('returns null when no second capture possible', () => {
    const h5 = card('5');
    const h2 = card('2');
    const b5 = card('5', 'clubs');
    const s = state({ hands: [[h5, h2], [], []], board: [b5] });
    const plan = evaluateChainCapture(s, 0, s.hands[0], s.board);
    expect(plan).toBeNull();
  });
});
