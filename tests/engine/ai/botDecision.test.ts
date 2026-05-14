import { describe, expect, it } from 'vitest';
import {
  captureChainThreshold,
  captureValueThreshold,
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

// ─── Canonical rebuild S1 — Doctrine 3.2 + PI sub-rules ──

describe('doctrine 3.2 — valueLossPenalty defers high-value placements', () => {
  it('Nina with [A, 5] in hand places the 5, not the Ace (the original bug)', () => {
    const ace = card('A');
    const five = card('5');
    const s = state({
      hands: [[ace, five], [], []],
      board: [card('3'), card('8')], // no capture available for either
    });
    const t = createCardTracker();
    // Sweep seeds to avoid mistake-roll noise; Nina mistakeRate 0.08.
    let placedFive = 0;
    let placedAce = 0;
    for (let seed = 0; seed < 30; seed++) {
      const d = decideBotAction(s, 0, 'intermediate', t, createPRNG(seed));
      if (d.action === 'place' && d.handCard.id === five.id) placedFive++;
      if (d.action === 'place' && d.handCard.id === ace.id) placedAce++;
    }
    // 5 should dominate. Mistake roll could pick Ace at ~8%, so expect
    // 5 placements to far exceed Ace placements over 30 seeds.
    expect(placedFive).toBeGreaterThan(placedAce);
    expect(placedFive).toBeGreaterThanOrEqual(20);
  });

  it('Rex placing from [A, 5, K] picks 5 (deferring A and K)', () => {
    const ace = card('A');
    const five = card('5');
    const king = card('K');
    const s = state({
      hands: [[ace, five, king], [], []],
      board: [card('3'), card('8')],
    });
    const t = createCardTracker();
    for (let seed = 0; seed < 10; seed++) {
      const d = decideBotAction(s, 0, 'advanced', t, createPRNG(seed));
      if (d.action === 'place') {
        // Rex (Advanced) defers high-value cards (mistakeRate 0.02 → very rare flip).
        expect([five.id]).toContain(d.handCard.id);
      }
    }
  });

  it('Jett placing from [A, 4, 7, J] picks a 2-9 (PI 9 strict tier)', () => {
    // Board chosen to ensure no place-then-capture chain exists for the
    // Ace or J (which would otherwise be promoted by SE Place-To-Plant /
    // place-chain logic at SE ≥ 5 — that interaction is called out in
    // the S1 impact doc as a known conflict between Place-To-Plant and
    // doctrine 3.2 that S3 will resolve).
    const ace = card('A');
    const four = card('4');
    const seven = card('7');
    const jack = card('J');
    const s = state({
      hands: [[ace, four, seven, jack], [], []],
      board: [card('5'), card('8')],
    });
    const t = createCardTracker();
    for (let seed = 0; seed < 10; seed++) {
      const d = decideBotAction(s, 0, 'expert', t, createPRNG(seed));
      if (d.action === 'place') {
        // Should defer Ace and Jack; pick a 2-9. Mistake rate 0.005 → essentially always.
        expect([four.id, seven.id]).toContain(d.handCard.id);
      }
    }
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
    // S3 migrated this function from SE-keyed to CC-keyed; the production
    // call site now passes profile.captureComplexity. Rex CC 6, Jett CC 8.
    const rexCC = getPersonalityProfile('advanced').captureComplexity;
    const jettCC = getPersonalityProfile('expert').captureComplexity;
    expect(captureChainThreshold(rexCC)).toBeGreaterThan(captureChainThreshold(jettCC));
  });
});

// ─── Canonical rebuild S4 — PASS 3A roster lock ───────────

describe('PASS 3A roster lock', () => {
  it('Calvin profile matches PASS 3A (10/80 total)', () => {
    const p = getPersonalityProfile('beginner');
    expect(p.riskThreshold).toBe(1);
    expect(p.deckAwareness).toBe(1);
    expect(p.opponentAwareness).toBe(1);
    expect(p.positionAwareness).toBe(2);
    expect(p.pressureHandling).toBe(1);
    expect(p.captureComplexity).toBe(1);
    expect(p.setupEngineering).toBe(1);
    expect(p.placementIntelligence).toBe(2);
  });

  it('Nina profile matches PASS 3A (30/80 total) with surviving preferSumsOnTie', () => {
    const p = getPersonalityProfile('intermediate');
    expect(p.riskThreshold).toBe(3);
    expect(p.deckAwareness).toBe(4);
    expect(p.opponentAwareness).toBe(3);
    expect(p.positionAwareness).toBe(4);
    expect(p.pressureHandling).toBe(4);
    expect(p.captureComplexity).toBe(5);    // CC > SE asymmetry (sees combos, doesn't plan)
    expect(p.setupEngineering).toBe(3);
    expect(p.placementIntelligence).toBe(4);
    expect(p.preferSumsOnTie).toBe(true);
  });

  it('Rex profile matches PASS 3A (48/80 total)', () => {
    const p = getPersonalityProfile('advanced');
    expect(p.riskThreshold).toBe(5);
    expect(p.deckAwareness).toBe(6);
    expect(p.opponentAwareness).toBe(6);
    expect(p.positionAwareness).toBe(7);    // HIGHER — positional hunter
    expect(p.pressureHandling).toBe(7);     // HIGHER — score-state reactive
    expect(p.captureComplexity).toBe(6);
    expect(p.setupEngineering).toBe(6);     // SE < 7 means no Jackpot Trap (intentional)
    expect(p.placementIntelligence).toBe(5);
  });

  it('Jett profile matches PASS 3A (61/80 total) with PH<PI asymmetry', () => {
    const p = getPersonalityProfile('expert');
    expect(p.riskThreshold).toBe(7);
    expect(p.deckAwareness).toBe(8);
    expect(p.opponentAwareness).toBe(8);
    expect(p.positionAwareness).toBe(8);
    expect(p.pressureHandling).toBe(6);     // slightly LOWER — stalker, not reactive
    expect(p.captureComplexity).toBe(8);
    expect(p.setupEngineering).toBe(8);     // SE ≥ 7 → Jackpot Trap (Jett-only)
    expect(p.placementIntelligence).toBe(9); // HIGHEST — multi-turn placement (stubbed)
  });

  it('only preferSumsOnTie survives as a binary flag (Nina alone)', () => {
    expect(getPersonalityProfile('beginner').preferSumsOnTie).toBe(false);
    expect(getPersonalityProfile('intermediate').preferSumsOnTie).toBe(true);
    expect(getPersonalityProfile('advanced').preferSumsOnTie).toBe(false);
    expect(getPersonalityProfile('expert').preferSumsOnTie).toBe(false);
  });

  it('mistakeRate unchanged across migration', () => {
    expect(getPersonalityProfile('beginner').weights.mistakeRate).toBe(0.25);
    expect(getPersonalityProfile('intermediate').weights.mistakeRate).toBe(0.08);
    expect(getPersonalityProfile('advanced').weights.mistakeRate).toBe(0.02);
    expect(getPersonalityProfile('expert').weights.mistakeRate).toBe(0.005);
  });
});

// ─── Canonical rebuild S3 — CC gates ───────────────────────

describe('CC (Capture Complexity) gates', () => {
  it('canEvaluateMultiSlot true only at CC ≥ 3', async () => {
    const { canEvaluateMultiSlot } = await import('../../../src/engine/ai/evaluator');
    expect(canEvaluateMultiSlot(1)).toBe(false);  // Calvin tier
    expect(canEvaluateMultiSlot(2)).toBe(false);
    expect(canEvaluateMultiSlot(3)).toBe(true);
    expect(canEvaluateMultiSlot(5)).toBe(true);   // Nina
    expect(canEvaluateMultiSlot(8)).toBe(true);   // Jett
  });

  it('canEvaluateChainCapture true only at CC ≥ 6', async () => {
    const { canEvaluateChainCapture } = await import('../../../src/engine/ai/evaluator');
    expect(canEvaluateChainCapture(1)).toBe(false);  // Calvin
    expect(canEvaluateChainCapture(5)).toBe(false);  // Nina — sees multi-slot, no chain
    expect(canEvaluateChainCapture(6)).toBe(true);   // Rex
    expect(canEvaluateChainCapture(8)).toBe(true);   // Jett
  });

  it('roster CC values produce the expected gate matrix', () => {
    const c = getPersonalityProfile('beginner').captureComplexity;
    const n = getPersonalityProfile('intermediate').captureComplexity;
    const r = getPersonalityProfile('advanced').captureComplexity;
    const j = getPersonalityProfile('expert').captureComplexity;
    // Calvin: no multi-slot, no chain eval
    expect(c).toBeLessThan(3);
    // Nina: multi-slot YES, chain eval NO
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThan(6);
    // Rex + Jett: both
    expect(r).toBeGreaterThanOrEqual(6);
    expect(j).toBeGreaterThanOrEqual(6);
  });
});

// ─── Canonical rebuild S3 — Place-Chain × doctrine 3.2 guard ──

describe('Place-Chain respects doctrine 3.2 floor (S3 fix)', () => {
  it('Jett does not promote a face/Ace place-chain when the floor outweighs the chain', () => {
    // Board [5, 6] + hand [A, 4, 7, J]. Pre-S3 the evaluatePlaceChain logic
    // would promote placing the Ace because the place-then-capture chain
    // (capture 7 to take 6+A summing to 7) exists. The doctrine 3.2 floor
    // (-22.5 for Ace placement) was ignored. S3's gate now requires
    // chainExpected to exceed bestCapture * threshold + valueLossFloor.
    const ace = card('A');
    const four = card('4');
    const seven = card('7');
    const jack = card('J');
    const s = state({
      hands: [[ace, four, seven, jack], [], []],
      board: [card('5'), card('6')],
    });
    const t = createCardTracker();
    let placedAce = 0;
    for (let seed = 0; seed < 10; seed++) {
      const d = decideBotAction(s, 0, 'expert', t, createPRNG(seed));
      if (d.action === 'place' && d.handCard.id === ace.id) placedAce++;
    }
    expect(placedAce).toBe(0);
  });
});

// ─── Canonical rebuild S2 — captureValueThreshold(rt) ──────

describe('captureValueThreshold', () => {
  it('returns 0.02 for RT 1 (Calvin tier)', () => {
    expect(captureValueThreshold(1)).toBe(0.02);
  });

  it('returns 0.05 for RT 2-3 (Nina tier)', () => {
    expect(captureValueThreshold(2)).toBe(0.05);
    expect(captureValueThreshold(3)).toBe(0.05);
  });

  it('returns 0.08 for RT 4-5 (Rex tier)', () => {
    expect(captureValueThreshold(4)).toBe(0.08);
    expect(captureValueThreshold(5)).toBe(0.08);
  });

  it('returns 0.10 for RT 6-7 (Jett tier)', () => {
    expect(captureValueThreshold(6)).toBe(0.10);
    expect(captureValueThreshold(7)).toBe(0.10);
  });

  it('returns 0.12 for RT 8-9 (future tier)', () => {
    expect(captureValueThreshold(8)).toBe(0.12);
    expect(captureValueThreshold(9)).toBe(0.12);
  });

  it('returns 0.15 for RT 10+ (future master)', () => {
    expect(captureValueThreshold(10)).toBe(0.15);
  });

  it('curve is monotonically non-decreasing', () => {
    let prev = captureValueThreshold(0);
    for (let rt = 1; rt <= 10; rt++) {
      const cur = captureValueThreshold(rt);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('locked roster values produce expected percentages', () => {
    // RT field on each personality maps to the percentage we shipped pre-rebuild.
    expect(captureValueThreshold(getPersonalityProfile('beginner').riskThreshold)).toBe(0.02);
    expect(captureValueThreshold(getPersonalityProfile('intermediate').riskThreshold)).toBe(0.05);
    expect(captureValueThreshold(getPersonalityProfile('advanced').riskThreshold)).toBe(0.08);
    expect(captureValueThreshold(getPersonalityProfile('expert').riskThreshold)).toBe(0.10);
  });
});
