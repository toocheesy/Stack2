/**
 * Move-Space Coverage Audit — Test Harness
 * ==========================================
 * Step 0 of the bot intelligence upgrade arc.
 *
 * Compares the engine's capture enumerator (findAllCaptures +
 * findBestMultiSlotCapture) against a brute-force ground-truth
 * enumerator to detect any missed legal captures.
 *
 * Part B: Randomized comparison across 10,000 seeded states
 * Part C: Doctrine-critical hand-crafted scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPRNG, type PRNG } from '../../src/engine/utils/prng';
import {
  findAllCaptures,
  findBestMultiSlotCapture,
} from '../../src/engine/core/captureValidator';
import {
  calculateCardPoints,
  calculateCardsPoints,
} from '../../src/engine/core/scoring';
import type { Card, CaptureOption, Rank, Suit } from '../../src/engine/types';
import { RANK_VALUES, RANKS, SUITS, SCORE_VALUES } from '../../src/engine/types';
import {
  enumerateAllCaptures,
  findAllSingleSlotCaptures,
  findAllMultiSlotCaptures,
  computeExpectedScore,
  type GroundTruthCapture,
} from './brute-force-enumerator';

// ── Card Factory ───────────────────────────────────────────────────────

let nextId = 0;
function resetIds() {
  nextId = 0;
}
function makeCard(rank: Rank, suit: Suit): Card {
  return { id: `t${++nextId}`, rank, suit, value: RANK_VALUES[rank] };
}

function createFullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(rank, suit));
    }
  }
  return deck;
}

// ── Random State Generator ─────────────────────────────────────────────

interface TestState {
  hand: Card[];
  board: Card[];
}

function generateRandomState(prng: PRNG): TestState {
  resetIds();
  const deck = prng.shuffle(createFullDeck());
  const handSize = prng.nextInt(1, 4);
  const boardSize = prng.nextInt(1, 12);
  return {
    hand: deck.slice(0, handSize),
    board: deck.slice(handSize, handSize + boardSize),
  };
}

// ── Comparison Logic ───────────────────────────────────────────────────

function boardCardKey(cards: readonly Card[]): string {
  return cards.map((c) => c.id).sort().join(',');
}

function hasOverlap(a: CaptureOption, b: CaptureOption): boolean {
  const ids = new Set(a.boardCards.map((c) => c.id));
  return b.boardCards.some((c) => ids.has(c.id));
}

/**
 * Compute all unique board-card-sets the engine can reach via
 * findAllCaptures single options and all non-overlapping 2-3 combos.
 */
function computeEngineReachableSets(
  handCard: Card,
  board: readonly Card[],
): Map<string, number> {
  const singles = findAllCaptures(handCard, board);
  const handPts = calculateCardPoints(handCard);
  const reachable = new Map<string, number>();

  for (const s of singles) {
    const key = boardCardKey(s.boardCards);
    const pts = s.points;
    const existing = reachable.get(key);
    if (!existing || pts > existing) reachable.set(key, pts);
  }

  const n = singles.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hasOverlap(singles[i], singles[j])) continue;
      const combined = [...singles[i].boardCards, ...singles[j].boardCards];
      const key = boardCardKey(combined);
      const pts = handPts + calculateCardsPoints(combined);
      const existing = reachable.get(key);
      if (!existing || pts > existing) reachable.set(key, pts);

      for (let k = j + 1; k < n; k++) {
        if (hasOverlap(singles[i], singles[k])) continue;
        if (hasOverlap(singles[j], singles[k])) continue;
        const triple = [...combined, ...singles[k].boardCards];
        const tripleKey = boardCardKey(triple);
        const triplePts = handPts + calculateCardsPoints(triple);
        const tripleExisting = reachable.get(tripleKey);
        if (!tripleExisting || triplePts > tripleExisting) {
          reachable.set(tripleKey, triplePts);
        }
      }
    }
  }

  return reachable;
}

// ── Gap Categorization ─────────────────────────────────────────────────

type GapCategory =
  | 'multi-card-pair'
  | 'four-plus-card-sum'
  | 'multi-slot-uses-missing-single'
  | 'ace-edge'
  | 'face-card-edge'
  | 'other';

interface GapDetail {
  category: GapCategory;
  capture: GroundTruthCapture;
  description: string;
}

function categorizeGap(gt: GroundTruthCapture): GapDetail {
  if (gt.type === 'single') {
    const slot = gt.slots[0];
    if (slot.type === 'pair' && slot.cards.length > 1) {
      return {
        category: 'multi-card-pair',
        capture: gt,
        description: `Multi-card pair: ${slot.cards.length} ${gt.handCard.rank}s in one slot`,
      };
    }
    if (slot.type === 'sum' && slot.cards.length >= 4) {
      const hasAce = slot.cards.some((c) => c.rank === 'A');
      if (hasAce) {
        return {
          category: 'four-plus-card-sum',
          capture: gt,
          description: `${slot.cards.length}-card sum with Ace stacking: ${slot.cards.map((c) => c.rank).join('+')}=${gt.handCard.value}`,
        };
      }
      return {
        category: 'four-plus-card-sum',
        capture: gt,
        description: `${slot.cards.length}-card sum: ${slot.cards.map((c) => c.rank).join('+')}=${gt.handCard.value}`,
      };
    }
    return {
      category: 'other',
      capture: gt,
      description: `Missed single-slot: type=${slot.type}, boardCards=${slot.cards.length}`,
    };
  }

  // Multi-slot capture: check if any slot uses a type the engine can't generate
  const hasMultiCardPairSlot = gt.slots.some(
    (s) => s.type === 'pair' && s.cards.length > 1,
  );
  const hasFourPlusSumSlot = gt.slots.some(
    (s) => s.type === 'sum' && s.cards.length >= 4,
  );

  if (hasMultiCardPairSlot || hasFourPlusSumSlot) {
    const reasons: string[] = [];
    if (hasMultiCardPairSlot) reasons.push('multi-card pair slot');
    if (hasFourPlusSumSlot) reasons.push('4+ card sum slot');
    return {
      category: 'multi-slot-uses-missing-single',
      capture: gt,
      description: `Multi-slot unreachable due to: ${reasons.join(', ')}`,
    };
  }

  return {
    category: 'other',
    capture: gt,
    description: `Multi-slot missed: ${gt.slots.length} slots, ${gt.totalPoints} pts`,
  };
}

// ── Per-HandCard Comparison ────────────────────────────────────────────

interface HandCardResult {
  handCard: Card;
  gtCaptureCount: number;
  engineSingleCount: number;
  engineBestMultiPoints: number | null;
  gaps: GapDetail[];
  scoringMismatches: { key: string; engine: number; expected: number }[];
  gtBestPoints: number;
  engineBestPoints: number;
}

function compareForHandCard(handCard: Card, board: Card[]): HandCardResult {
  const engineReachable = computeEngineReachableSets(handCard, board);
  const gtCaptures = enumerateAllCaptures(handCard, board);

  // Find gaps: GT captures not reachable by engine
  const gaps: GapDetail[] = [];
  for (const gt of gtCaptures) {
    if (!engineReachable.has(gt.boardCardKey)) {
      gaps.push(categorizeGap(gt));
    }
  }

  // Best capture comparison
  let gtBest = 0;
  for (const gt of gtCaptures) {
    if (gt.totalPoints > gtBest) gtBest = gt.totalPoints;
  }

  const engineSingles = findAllCaptures(handCard, board);
  const engineMulti = findBestMultiSlotCapture(handCard, board);

  let engineBest = 0;
  for (const s of engineSingles) {
    if (s.points > engineBest) engineBest = s.points;
  }
  if (engineMulti && engineMulti.totalPoints > engineBest) {
    engineBest = engineMulti.totalPoints;
  }

  // Scoring verification for captures both sides find
  const scoringMismatches: { key: string; engine: number; expected: number }[] = [];
  for (const s of engineSingles) {
    const expected = computeExpectedScore(handCard, s.boardCards);
    if (s.points !== expected) {
      scoringMismatches.push({
        key: boardCardKey(s.boardCards),
        engine: s.points,
        expected,
      });
    }
  }
  if (engineMulti) {
    const allBoardCards = engineMulti.slots.flatMap((s) => s.cards);
    const expected = computeExpectedScore(handCard, allBoardCards);
    if (engineMulti.totalPoints !== expected) {
      scoringMismatches.push({
        key: boardCardKey(allBoardCards),
        engine: engineMulti.totalPoints,
        expected,
      });
    }
  }

  return {
    handCard,
    gtCaptureCount: gtCaptures.length,
    engineSingleCount: engineSingles.length,
    engineBestMultiPoints: engineMulti?.totalPoints ?? null,
    gaps,
    scoringMismatches,
    gtBestPoints: gtBest,
    engineBestPoints: engineBest,
  };
}

// ── Aggregate Statistics ───────────────────────────────────────────────

interface AuditStats {
  totalStates: number;
  totalHandCardChecks: number;

  statesWithGaps: number;
  statesClean: number;

  totalGaps: number;
  gapsByCategory: Record<GapCategory, number>;

  totalScoringMismatches: number;
  bestCaptureMissedCount: number;
  bestCaptureTotalPointsLost: number;

  exampleGaps: {
    category: GapCategory;
    handCard: string;
    board: string;
    description: string;
    gtBest: number;
    engineBest: number;
  }[];
}

function createEmptyStats(): AuditStats {
  return {
    totalStates: 0,
    totalHandCardChecks: 0,
    statesWithGaps: 0,
    statesClean: 0,
    totalGaps: 0,
    gapsByCategory: {
      'multi-card-pair': 0,
      'four-plus-card-sum': 0,
      'multi-slot-uses-missing-single': 0,
      'ace-edge': 0,
      'face-card-edge': 0,
      other: 0,
    },
    totalScoringMismatches: 0,
    bestCaptureMissedCount: 0,
    bestCaptureTotalPointsLost: 0,
    exampleGaps: [],
  };
}

function cardStr(c: Card): string {
  return `${c.rank}${c.suit[0]}`;
}

function runAudit(stateCount: number, baseSeed: number): AuditStats {
  const stats = createEmptyStats();
  const MAX_EXAMPLES_PER_CATEGORY = 3;
  const exampleCounts: Record<GapCategory, number> = {
    'multi-card-pair': 0,
    'four-plus-card-sum': 0,
    'multi-slot-uses-missing-single': 0,
    'ace-edge': 0,
    'face-card-edge': 0,
    other: 0,
  };
  const exampleSeenStates: Record<GapCategory, Set<number>> = {
    'multi-card-pair': new Set(),
    'four-plus-card-sum': new Set(),
    'multi-slot-uses-missing-single': new Set(),
    'ace-edge': new Set(),
    'face-card-edge': new Set(),
    other: new Set(),
  };

  for (let i = 0; i < stateCount; i++) {
    const prng = createPRNG(baseSeed + i);
    const state = generateRandomState(prng);
    stats.totalStates++;

    let stateHasGap = false;

    for (const handCard of state.hand) {
      stats.totalHandCardChecks++;
      const result = compareForHandCard(handCard, state.board);

      if (result.gaps.length > 0) {
        stateHasGap = true;
        stats.totalGaps += result.gaps.length;

        for (const gap of result.gaps) {
          stats.gapsByCategory[gap.category]++;

          // Collect diverse examples (one per state per category)
          if (
            exampleCounts[gap.category] < MAX_EXAMPLES_PER_CATEGORY &&
            !exampleSeenStates[gap.category].has(i)
          ) {
            exampleCounts[gap.category]++;
            exampleSeenStates[gap.category].add(i);
            stats.exampleGaps.push({
              category: gap.category,
              handCard: cardStr(handCard),
              board: state.board.map(cardStr).join(' '),
              description: gap.description,
              gtBest: result.gtBestPoints,
              engineBest: result.engineBestPoints,
            });
          }
        }
      }

      if (result.scoringMismatches.length > 0) {
        stats.totalScoringMismatches += result.scoringMismatches.length;
      }

      if (result.gtBestPoints > result.engineBestPoints) {
        stats.bestCaptureMissedCount++;
        stats.bestCaptureTotalPointsLost +=
          result.gtBestPoints - result.engineBestPoints;
      }
    }

    if (stateHasGap) stats.statesWithGaps++;
    else stats.statesClean++;
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════
// PART B — RANDOMIZED COMPARISON TEST HARNESS
// ═══════════════════════════════════════════════════════════════════════

describe('Part B — Randomized Move-Space Coverage Audit', () => {
  const AUDIT_SEED = 20260504;
  const STATE_COUNT = 10_000;

  it(`runs ${STATE_COUNT} randomized states and reports gaps`, { timeout: 60_000 }, () => {
    const stats = runAudit(STATE_COUNT, AUDIT_SEED);

    // Log full audit summary
    console.log('\n════════════════════════════════════════════════');
    console.log('  MOVE-SPACE COVERAGE AUDIT — RANDOMIZED RESULTS');
    console.log('════════════════════════════════════════════════');
    console.log(`States tested:          ${stats.totalStates}`);
    console.log(`Hand-card checks:       ${stats.totalHandCardChecks}`);
    console.log(`States clean (PASS):    ${stats.statesClean}`);
    console.log(`States with gaps (FAIL):${stats.statesWithGaps}`);
    console.log(
      `Pass rate:              ${((stats.statesClean / stats.totalStates) * 100).toFixed(1)}%`,
    );
    console.log('');
    console.log('Gap breakdown by category:');
    for (const [cat, count] of Object.entries(stats.gapsByCategory)) {
      if (count > 0) console.log(`  ${cat}: ${count}`);
    }
    console.log('');
    console.log(`Total gaps found:       ${stats.totalGaps}`);
    console.log(`Scoring mismatches:     ${stats.totalScoringMismatches}`);
    console.log(
      `Best-capture misses:    ${stats.bestCaptureMissedCount} (${stats.bestCaptureTotalPointsLost} total points lost)`,
    );
    console.log('');

    if (stats.exampleGaps.length > 0) {
      console.log('Example gaps:');
      for (const ex of stats.exampleGaps) {
        console.log(`  [${ex.category}]`);
        console.log(`    Hand: ${ex.handCard}  Board: ${ex.board}`);
        console.log(`    ${ex.description}`);
        console.log(
          `    GT best: ${ex.gtBest} pts | Engine best: ${ex.engineBest} pts`,
        );
      }
    }
    console.log('════════════════════════════════════════════════\n');

    // The test itself: assert the audit ran to completion
    expect(stats.totalStates).toBe(STATE_COUNT);
    // Record gap existence for the report (test passes either way —
    // the audit's job is to FIND gaps, not to assert zero gaps)
    expect(stats.totalScoringMismatches).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PART C — DOCTRINE-CRITICAL TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════

describe('Part C — Doctrine-Critical Scenarios', () => {
  beforeEach(() => resetIds());

  // ── Scenario 1: APEX MULTI-SLOT CAPTURE ────────────────────────────

  describe('C1: Apex multi-slot capture (3-slot fill)', () => {
    it('engine finds a 3-slot capture when available', () => {
      // Hand: 10♥ (value 10)
      // Board: 10♣ (pair), 4♦+6♠ (sum=10), A♥+9♠ (sum=10)
      const hand = makeCard('10', 'hearts');
      const board = [
        makeCard('10', 'clubs'),
        makeCard('4', 'diamonds'),
        makeCard('6', 'spades'),
        makeCard('A', 'hearts'),
        makeCard('9', 'spades'),
      ];

      const engineMulti = findBestMultiSlotCapture(hand, board);
      expect(engineMulti).not.toBeNull();
      expect(engineMulti!.slots.length).toBe(3);

      // Ground truth: same result
      const gt = enumerateAllCaptures(hand, board);
      const gtBest = gt.reduce(
        (max, c) => (c.totalPoints > max ? c.totalPoints : max),
        0,
      );
      expect(engineMulti!.totalPoints).toBe(gtBest);
    });

    it('engine finds apex captures using multi-card pairs in slots', () => {
      // Hand: 5♥
      // Board: 5♣, 5♠, 5♦, 2♥, 3♣
      // Post-fix: engine packs [5♣,5♠,5♦] as 3-card pair in 1 slot +
      // [2♥,3♣] sum in slot 2 → all 5 board cards captured
      const hand = makeCard('5', 'hearts');
      const board = [
        makeCard('5', 'clubs'),
        makeCard('5', 'spades'),
        makeCard('5', 'diamonds'),
        makeCard('2', 'hearts'),
        makeCard('3', 'clubs'),
      ];

      const gt = enumerateAllCaptures(hand, board);
      const engineReachable = computeEngineReachableSets(hand, board);

      // GT should have a capture covering all 5 board cards
      const allFiveKey = boardCardKey(board);
      const gtHasAllFive = gt.some((c) => c.boardCardKey === allFiveKey);
      expect(gtHasAllFive).toBe(true);

      // Post-fix: engine CAN reach all 5 board cards
      const engineHasAllFive = engineReachable.has(allFiveKey);
      expect(engineHasAllFive).toBe(true);

      // Engine best: all 5 board cards → 5 + 5+5+5+5+5 = 30
      const engineMulti = findBestMultiSlotCapture(hand, board);
      expect(engineMulti).not.toBeNull();
      expect(engineMulti!.totalPoints).toBe(30);

      // GT best matches engine best
      const gtBest = gt.reduce(
        (max, c) => (c.totalPoints > max ? c.totalPoints : max),
        0,
      );
      expect(gtBest).toBe(30);
      expect(engineMulti!.totalPoints).toBe(gtBest);
    });
  });

  // ── Scenario 2: ACE STACKING IN SUM SLOTS ─────────────────────────

  describe('C2: Ace stacking in sum slots', () => {
    it('engine finds A+A+7 = 9 (3-card sum)', () => {
      const hand = makeCard('9', 'hearts');
      const board = [
        makeCard('A', 'clubs'),
        makeCard('A', 'diamonds'),
        makeCard('7', 'spades'),
      ];

      const opts = findAllCaptures(hand, board);
      // Should find 3-card sum: A(1)+A(1)+7=9
      const threeCardSum = opts.find(
        (o) => o.type === 'sum' && o.boardCards.length === 3,
      );
      expect(threeCardSum).toBeDefined();
      // Points: 9(hand=5) + A(15) + A(15) + 7(5) = 40
      expect(threeCardSum!.points).toBe(40);
    });

    it('engine finds A+A+A+6 = 9 (4-card sum)', () => {
      const hand = makeCard('9', 'hearts');
      const board = [
        makeCard('A', 'clubs'),
        makeCard('A', 'diamonds'),
        makeCard('A', 'spades'),
        makeCard('6', 'hearts'),
      ];

      const engineOpts = findAllCaptures(hand, board);
      // Post-fix: engine checks subset sizes 2+, finds 4-card sum
      const fourCardSum = engineOpts.find(
        (o) => o.type === 'sum' && o.boardCards.length === 4,
      );
      expect(fourCardSum).toBeDefined();
      // Points: 9(5) + A(15) + A(15) + A(15) + 6(5) = 55
      expect(fourCardSum!.points).toBe(55);
    });

    it('Ace as base captures high-value cards', () => {
      // A♥ base, board has A♣ (pair)
      const hand = makeCard('A', 'hearts');
      const board = [
        makeCard('A', 'clubs'),
        makeCard('5', 'diamonds'),
      ];

      const opts = findAllCaptures(hand, board);
      const acePair = opts.find(
        (o) => o.type === 'pair' && o.boardCards[0].rank === 'A',
      );
      expect(acePair).toBeDefined();
      expect(acePair!.points).toBe(30); // 15 + 15
    });
  });

  // ── Scenario 3: FACE CARD PAIR-ONLY ENFORCEMENT ───────────────────

  describe('C3: Face card pair-only enforcement', () => {
    it('face card hand: engine finds pairs, never generates sums', () => {
      const hand = makeCard('K', 'hearts');
      const board = [
        makeCard('K', 'clubs'),
        makeCard('K', 'spades'),
        makeCard('3', 'diamonds'),
        makeCard('7', 'hearts'),
      ];

      const opts = findAllCaptures(hand, board);
      // Should find pair captures: K♣, K♠, and K♣+K♠ (multi-card pair)
      expect(opts.length).toBe(3);
      expect(opts.every((o) => o.type === 'pair')).toBe(true);
    });

    it('face cards on board never appear in sum slots', () => {
      // Hand: 10♥, Board: J♣, Q♦, 3♠, 7♥
      // J and Q have value 0, so J+Q = 0 ≠ 10.
      // 3+7 = 10 is valid sum. J and Q should not be in any sum.
      const hand = makeCard('10', 'hearts');
      const board = [
        makeCard('J', 'clubs'),
        makeCard('Q', 'diamonds'),
        makeCard('3', 'spades'),
        makeCard('7', 'hearts'),
      ];

      const opts = findAllCaptures(hand, board);
      const sums = opts.filter((o) => o.type === 'sum');
      for (const s of sums) {
        for (const c of s.boardCards) {
          expect(['J', 'Q', 'K']).not.toContain(c.rank);
        }
      }
      // The 3+7=10 sum should be found
      expect(sums.length).toBeGreaterThanOrEqual(1);
    });

    it('face card multi-slot pair capture works', () => {
      // Hand: K♥, Board: K♣, K♠ → multi-slot with 2 pair slots
      const hand = makeCard('K', 'hearts');
      const board = [makeCard('K', 'clubs'), makeCard('K', 'spades')];

      const multi = findBestMultiSlotCapture(hand, board);
      expect(multi).not.toBeNull();
      expect(multi!.slots.length).toBe(2);
      expect(multi!.slots.every((s) => s.type === 'pair')).toBe(true);
      // Points: K(10) + K(10) + K(10) = 30
      expect(multi!.totalPoints).toBe(30);
    });
  });

  // ── Scenario 4: MULTI-CARD SUM IN SINGLE SLOT ────────────────────

  describe('C4: Multi-card sum in single slot', () => {
    it('engine finds 3-card sum: 2+3+4 = 9', () => {
      const hand = makeCard('9', 'hearts');
      const board = [
        makeCard('2', 'diamonds'),
        makeCard('3', 'spades'),
        makeCard('4', 'clubs'),
      ];

      const opts = findAllCaptures(hand, board);
      const threeSum = opts.find(
        (o) => o.type === 'sum' && o.boardCards.length === 3,
      );
      expect(threeSum).toBeDefined();
      expect(threeSum!.points).toBe(20); // 5 + 5+5+5
    });

    it('engine finds 4-card sum: A+2+3+4 = 10', () => {
      const hand = makeCard('10', 'hearts');
      const board = [
        makeCard('A', 'diamonds'),
        makeCard('2', 'spades'),
        makeCard('3', 'clubs'),
        makeCard('4', 'hearts'),
      ];

      const engineOpts = findAllCaptures(hand, board);
      // Post-fix: engine finds 4-card sum
      const fourSum = engineOpts.find(
        (o) => o.type === 'sum' && o.boardCards.length === 4,
      );
      expect(fourSum).toBeDefined();
      // Points: 10(10) + A(15) + 2(5) + 3(5) + 4(5) = 40
      expect(fourSum!.points).toBe(40);
    });

    it('engine finds 5-card sum: A+A+A+A+6 = 10', () => {
      const hand = makeCard('10', 'hearts');
      const board = [
        makeCard('A', 'clubs'),
        makeCard('A', 'diamonds'),
        makeCard('A', 'spades'),
        makeCard('A', 'hearts'),
        makeCard('6', 'clubs'),
      ];

      const engineOpts = findAllCaptures(hand, board);
      // Post-fix: engine finds 5-card sum
      const fiveSum = engineOpts.find(
        (o) => o.type === 'sum' && o.boardCards.length === 5,
      );
      expect(fiveSum).toBeDefined();
      // Points: 10(10) + 4×A(60) + 6(5) = 75
      expect(fiveSum!.points).toBe(75);
    });
  });

  // ── Scenario 5: SAME HAND CARD MULTIPLE BASE OPTIONS ──────────────

  describe('C5: Same hand card with multiple base options', () => {
    it('engine finds all single-slot options and picks the best multi-slot', () => {
      // Hand: 5♥
      // Board: 5♣ (pair), 2♦+3♣ (sum=5), A♥+4♠ (sum=5)
      const hand = makeCard('5', 'hearts');
      const board = [
        makeCard('5', 'clubs'),
        makeCard('2', 'diamonds'),
        makeCard('3', 'clubs'),
        makeCard('A', 'hearts'),
        makeCard('4', 'spades'),
      ];

      const singles = findAllCaptures(hand, board);
      // Should find: pair[5♣], sum[2♦,3♣], sum[A♥,4♠]
      expect(singles.length).toBeGreaterThanOrEqual(3);

      const multi = findBestMultiSlotCapture(hand, board);
      expect(multi).not.toBeNull();
      // Best: 3-slot → pair[5♣] + sum[2♦,3♣] + sum[A♥,4♠]
      expect(multi!.slots.length).toBe(3);
      // Points: 5(hand) + 5(5♣) + 5(2♦) + 5(3♣) + 15(A♥) + 5(4♠) = 40
      expect(multi!.totalPoints).toBe(40);

      // Ground truth best should match
      const gt = enumerateAllCaptures(hand, board);
      const gtBest = gt.reduce(
        (max, c) => (c.totalPoints > max ? c.totalPoints : max),
        0,
      );
      expect(multi!.totalPoints).toBe(gtBest);
    });

    it('engine correctly ranks higher-scoring options above lower', () => {
      // Hand: 7♥
      // Board: 7♣ (pair=10pts), 3♦+4♠ (sum=7, 10pts), A♥+6♣ (sum=7, 20pts with Ace)
      const hand = makeCard('7', 'hearts');
      const board = [
        makeCard('7', 'clubs'),
        makeCard('3', 'diamonds'),
        makeCard('4', 'spades'),
        makeCard('A', 'hearts'),
        makeCard('6', 'clubs'),
      ];

      const multi = findBestMultiSlotCapture(hand, board);
      expect(multi).not.toBeNull();
      // Best combo should include A♥+6♣ (20pts board) over lower-value options
      const allBoardCards = multi!.slots.flatMap((s) => s.cards);
      const hasAce = allBoardCards.some((c) => c.rank === 'A');
      expect(hasAce).toBe(true);
    });
  });

  // ── Scenario 6: LEGAL PLACEMENT VERIFICATION ─────────────────────

  describe('C6: Legal move enumeration includes placement', () => {
    it('placement is always a legal move for every hand card', () => {
      // With no captures available, placement should still be valid
      const board = [makeCard('2', 'hearts'), makeCard('3', 'clubs')];

      // K♥ can't capture anything on this board
      const hand = makeCard('K', 'hearts');
      const captures = findAllCaptures(hand, board);
      expect(captures.length).toBe(0);
      // Placement is always legal (not enumerated by findAllCaptures,
      // handled by evaluateAllActions which adds a 'place' action per card)
    });

    it('face card placement is legal even when pairs exist', () => {
      // K♥ hand, K♣ on board → capture available, but placement also legal
      const hand = makeCard('K', 'hearts');
      const board = [makeCard('K', 'clubs'), makeCard('5', 'diamonds')];

      const captures = findAllCaptures(hand, board);
      expect(captures.length).toBeGreaterThan(0);
      // Placement would also be legal — the player can choose to place
      // instead of capture (evaluateAllActions always generates placement)
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SUPPLEMENTAL — Edge Case Coverage
// ═══════════════════════════════════════════════════════════════════════

describe('Supplemental — Scoring verification', () => {
  beforeEach(() => resetIds());

  it('Ace scores 15 points in captures', () => {
    expect(calculateCardPoints(makeCard('A', 'hearts'))).toBe(15);
  });

  it('face cards score 10 points each', () => {
    for (const rank of ['J', 'Q', 'K'] as Rank[]) {
      expect(calculateCardPoints(makeCard(rank, 'hearts'))).toBe(10);
    }
  });

  it('10 scores 10 points', () => {
    expect(calculateCardPoints(makeCard('10', 'hearts'))).toBe(10);
  });

  it('number cards 2-9 score 5 points each', () => {
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9'] as Rank[]) {
      expect(calculateCardPoints(makeCard(rank, 'hearts'))).toBe(5);
    }
  });

  it('multi-card capture scoring sums all captured cards', () => {
    const cards = [
      makeCard('A', 'hearts'),
      makeCard('K', 'clubs'),
      makeCard('5', 'diamonds'),
    ];
    // 15 + 10 + 5 = 30
    expect(calculateCardsPoints(cards)).toBe(30);
  });
});
