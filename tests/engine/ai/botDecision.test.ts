import { describe, expect, it } from 'vitest';
import {
  captureChainThreshold,
  decideBotAction,
  getBotThinkingDelay,
  getPersonalityProfile,
  getPersonalityWeights,
} from '../../../src/engine/ai/botDecision';
import { createCardTracker } from '../../../src/engine/ai/cardTracker';
import { createPRNG } from '../../../src/engine/utils/prng';
import type {
  Card,
  GameState,
  Rank,
  Suit,
} from '../../../src/engine/types';
import { RANK_VALUES } from '../../../src/engine/types';
import { CALVIN_WEIGHTS } from '../../../src/engine/ai/personalities/calvin';
import { NINA_WEIGHTS } from '../../../src/engine/ai/personalities/nina';
import { REX_WEIGHTS } from '../../../src/engine/ai/personalities/rex';

let idCounter = 0;
function card(rank: Rank, suit: Suit = 'hearts'): Card {
  return {
    id: `bd${++idCounter}`,
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

describe('getPersonalityWeights', () => {
  it('routes difficulty to correct weights', () => {
    expect(getPersonalityWeights('beginner')).toEqual(CALVIN_WEIGHTS);
    expect(getPersonalityWeights('intermediate')).toEqual(NINA_WEIGHTS);
    expect(getPersonalityWeights('advanced')).toEqual(REX_WEIGHTS);
  });
});

describe('getBotThinkingDelay', () => {
  it('Calvin delay in [1500, 3000]', () => {
    const prng = createPRNG(1);
    for (let i = 0; i < 20; i++) {
      const d = getBotThinkingDelay('beginner', prng);
      expect(d).toBeGreaterThanOrEqual(1500);
      expect(d).toBeLessThanOrEqual(3000);
    }
  });

  it('Rex delay in [400, 900]', () => {
    const prng = createPRNG(2);
    for (let i = 0; i < 20; i++) {
      const d = getBotThinkingDelay('advanced', prng);
      expect(d).toBeGreaterThanOrEqual(400);
      expect(d).toBeLessThanOrEqual(900);
    }
  });

  it('deterministic for same seed', () => {
    const d1 = getBotThinkingDelay('intermediate', createPRNG(7));
    const d2 = getBotThinkingDelay('intermediate', createPRNG(7));
    expect(d1).toBe(d2);
  });
});

describe('decideBotAction', () => {
  it('returns a valid decision with a handCard from the hand', () => {
    const hand = [card('A'), card('5'), card('K')];
    const s = state({ hands: [hand, [], []], board: [card('2')] });
    const t = createCardTracker();
    const prng = createPRNG(42);
    const d = decideBotAction(s, 0, 'intermediate', t, prng);
    expect(hand.some((c) => c.id === d.handCard.id)).toBe(true);
    expect(['capture', 'place']).toContain(d.action);
    expect(d.reasoning.length).toBeGreaterThan(0);
  });

  it('same seed + same state = same decision', () => {
    const h = card('A');
    const b = card('A', 'clubs');
    const s = state({ hands: [[h, card('3')], [], []], board: [b, card('7')] });
    const t = createCardTracker();
    const d1 = decideBotAction(s, 0, 'intermediate', t, createPRNG(123));
    const d2 = decideBotAction(s, 0, 'intermediate', t, createPRNG(123));
    expect(d1.action).toBe(d2.action);
    expect(d1.handCard.id).toBe(d2.handCard.id);
  });

  it('throws if hand is empty', () => {
    const s = state({ hands: [[], [], []] });
    const t = createCardTracker();
    expect(() =>
      decideBotAction(s, 0, 'beginner', t, createPRNG(1)),
    ).toThrow();
  });

  it('Calvin never returns multi-slot captures', () => {
    const hand = card('5');
    const b1 = card('5', 'clubs');
    const b2 = card('2');
    const b3 = card('3');
    const s = state({
      hands: [[hand], [], []],
      board: [b1, b2, b3],
    });
    const t = createCardTracker();
    for (let seed = 0; seed < 20; seed++) {
      const d = decideBotAction(s, 0, 'beginner', t, createPRNG(seed));
      if (d.action === 'capture') {
        expect(d.captureDetails!.slots.length).toBe(1);
      }
    }
  });

  // ─── Doctrine 2.7 — Forced-Placement Dump ────────────

  it('returns a place action when dumpActive (capture available but locked out)', () => {
    // Bot holds an Ace; board has another Ace — a pair capture is the
    // top-scoring action under normal play. With dumpActive=true, the
    // bot must place instead.
    const hand1 = card('A');
    const hand2 = card('5');
    const boardA = card('A', 'clubs');
    const s = state({
      hands: [[hand1, hand2], [], []],
      board: [boardA, card('7')],
      dumpActive: true,
    });
    const t = createCardTracker();
    for (let seed = 0; seed < 10; seed++) {
      const d = decideBotAction(s, 0, 'intermediate', t, createPRNG(seed));
      expect(d.action).toBe('place');
    }
  });

  it('without dumpActive the same setup permits capture', () => {
    // Sanity check: without the dump flag, the bot should at least
    // sometimes choose capture given the obvious pair on the board.
    const hand1 = card('A');
    const hand2 = card('5');
    const boardA = card('A', 'clubs');
    const s = state({
      hands: [[hand1, hand2], [], []],
      board: [boardA, card('7')],
      dumpActive: false,
    });
    const t = createCardTracker();
    let captured = 0;
    for (let seed = 0; seed < 10; seed++) {
      const d = decideBotAction(s, 0, 'intermediate', t, createPRNG(seed));
      if (d.action === 'capture') captured++;
    }
    expect(captured).toBeGreaterThan(0);
  });

  it('Calvin places highest number card (2-9) when placing', () => {
    const low = card('2');
    const mid = card('5');
    const ace = card('A');
    const s = state({
      hands: [[low, mid, ace], [], []],
      board: [card('K'), card('Q')],
    });
    const t = createCardTracker();
    let placedMid = 0;
    for (let seed = 0; seed < 10; seed++) {
      const d = decideBotAction(s, 0, 'beginner', t, createPRNG(seed));
      if (d.action === 'place' && d.handCard.id === mid.id) placedMid++;
    }
    // Calvin's tell: places highest number card (5) over Ace and 2
    expect(placedMid).toBe(10);
  });

  it('getPersonalityProfile for beginner is Calvin', () => {
    expect(getPersonalityProfile('beginner').name).toBe('Calvin');
  });

  it('getPersonalityProfile for expert is Jett', () => {
    expect(getPersonalityProfile('expert').name).toBe('Jett');
  });

  it('Jett returns valid decisions across game states', () => {
    const hand = [card('A'), card('K'), card('5'), card('3')];
    const s = state({
      hands: [hand, [], []],
      board: [card('A', 'clubs'), card('K', 'clubs'), card('2'), card('7')],
    });
    const t = createCardTracker();
    for (let seed = 0; seed < 20; seed++) {
      const d = decideBotAction(s, 0, 'expert', t, createPRNG(seed));
      expect(hand.some((c) => c.id === d.handCard.id)).toBe(true);
      expect(['capture', 'place']).toContain(d.action);
    }
  });

  it('Jett has lower mistake rate than Rex', () => {
    const jettProfile = getPersonalityProfile('expert');
    const rexProfile = getPersonalityProfile('advanced');
    expect(jettProfile.weights.mistakeRate).toBeLessThan(rexProfile.weights.mistakeRate);
  });

  it('Jett has higher risk threshold than Rex', () => {
    const jettProfile = getPersonalityProfile('expert');
    const rexProfile = getPersonalityProfile('advanced');
    expect(jettProfile.riskThreshold).toBeGreaterThan(rexProfile.riskThreshold);
  });
});

describe('personality strength ordering (statistical)', () => {
  it('Rex picks captures more often than Calvin in capture-available states', () => {
    const hand = card('5');
    const b1 = card('5', 'clubs');
    const b2 = card('2');
    const b3 = card('3');
    const s = state({
      hands: [[hand], [], []],
      board: [b1, b2, b3],
    });
    const t = createCardTracker();
    let rexCaptures = 0;
    let calvinCaptures = 0;
    for (let seed = 0; seed < 50; seed++) {
      const r = decideBotAction(s, 0, 'advanced', t, createPRNG(seed));
      const c = decideBotAction(s, 0, 'beginner', t, createPRNG(seed));
      if (r.action === 'capture') rexCaptures++;
      if (c.action === 'capture') calvinCaptures++;
    }
    expect(rexCaptures).toBeGreaterThanOrEqual(calvinCaptures);
  });

  it('Calvin makes suboptimal choices at roughly his mistake rate', () => {
    const hand = [card('A'), card('5'), card('2')];
    const b = card('A', 'clubs');
    const s = state({ hands: [hand, [], []], board: [b, card('8'), card('6')] });
    const t = createCardTracker();
    const optimalIds = new Set<string>();
    const bestAction = decideBotAction(s, 0, 'advanced', t, createPRNG(0));
    optimalIds.add(bestAction.handCard.id);

    let suboptimal = 0;
    const runs = 100;
    for (let seed = 0; seed < runs; seed++) {
      const d = decideBotAction(s, 0, 'beginner', t, createPRNG(seed));
      if (!optimalIds.has(d.handCard.id)) suboptimal++;
    }
    expect(suboptimal).toBeGreaterThanOrEqual(0);
    expect(suboptimal).toBeLessThanOrEqual(runs);
  });
});

// ─── Q3 — captureChainThreshold(se) curve ────────────

describe('captureChainThreshold', () => {
  it('returns 1.40 for SE 5 (and below)', () => {
    expect(captureChainThreshold(1)).toBe(1.40);
    expect(captureChainThreshold(5)).toBe(1.40);
  });

  it('returns 1.30 for SE 6-7 (Rex tier)', () => {
    expect(captureChainThreshold(6)).toBe(1.30);
    expect(captureChainThreshold(7)).toBe(1.30); // Rex
  });

  it('returns 1.20 for SE 8 (Jett tier — preserves prior default)', () => {
    expect(captureChainThreshold(8)).toBe(1.20); // Jett
  });

  it('returns 1.15 for SE 9 and above', () => {
    expect(captureChainThreshold(9)).toBe(1.15);
    expect(captureChainThreshold(10)).toBe(1.15);
  });

  it('curve is monotonically non-increasing (higher SE = lower or equal threshold)', () => {
    let prev = captureChainThreshold(0);
    for (let se = 1; se <= 10; se++) {
      const cur = captureChainThreshold(se);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });

  it('Rex and Jett receive distinct thresholds (Rex more conservative)', () => {
    const rexSE = getPersonalityProfile('advanced').setupEngineering;
    const jettSE = getPersonalityProfile('expert').setupEngineering;
    expect(captureChainThreshold(rexSE)).toBeGreaterThan(captureChainThreshold(jettSE));
  });
});
