/**
 * Brute-Force Ground Truth Enumerator
 * ====================================
 * Exhaustive move enumerator for the STACKED move-space coverage audit.
 * Performance does not matter — correctness is everything.
 *
 * This enumerator finds EVERY legal capture available for a given
 * (hand card, board) state. Its output is the ground truth against
 * which the engine's enumerator is measured.
 */

import type { Card, Rank } from '../../src/engine/types';
import { RANK_VALUES, SCORE_VALUES } from '../../src/engine/types';

// ── Types ──────────────────────────────────────────────────────────────

export interface GroundTruthCapture {
  type: 'single' | 'multi';
  handCard: Card;
  /** Each slot is a group of board cards captured together */
  slots: GroundTruthSlot[];
  /** Total points: hand card + all captured board cards */
  totalPoints: number;
  /** Board card IDs in sorted order, for dedup */
  boardCardKey: string;
}

export interface GroundTruthSlot {
  type: 'pair' | 'sum';
  cards: Card[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const FACE_RANKS = new Set<Rank>(['J', 'Q', 'K']);

function isFace(rank: Rank): boolean {
  return FACE_RANKS.has(rank);
}

function cardPoints(card: Card): number {
  return SCORE_VALUES[card.rank];
}

function sumPoints(cards: readonly Card[]): number {
  let total = 0;
  for (const c of cards) total += cardPoints(c);
  return total;
}

function sumValue(cards: readonly Card[]): number {
  let total = 0;
  for (const c of cards) total += RANK_VALUES[c.rank];
  return total;
}

function boardCardKey(cards: Card[]): string {
  return cards
    .map((c) => c.id)
    .sort()
    .join(',');
}

// ── Power Set Generator ────────────────────────────────────────────────
// Generate all non-empty subsets of an array.

function* allSubsets<T>(arr: readonly T[]): Generator<T[]> {
  const n = arr.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(arr[i]);
    }
    yield subset;
  }
}

// ── Single-Slot Capture Enumeration ────────────────────────────────────
// Find every valid single-slot capture (one group of board cards).

export interface SingleSlotOption {
  type: 'pair' | 'sum';
  boardCards: Card[];
  points: number; // hand + board points
}

export function findAllSingleSlotCaptures(
  handCard: Card,
  board: readonly Card[],
): SingleSlotOption[] {
  const options: SingleSlotOption[] = [];
  const handValue = RANK_VALUES[handCard.rank];
  const handPoints = cardPoints(handCard);
  const handIsFace = isFace(handCard.rank);

  // Filter board to non-face cards for sum consideration
  const nonFaceBoard = board.filter((c) => !isFace(c.rank));

  for (const subset of allSubsets(board)) {
    if (subset.length === 0) continue;

    // Check PAIR: all cards in subset match hand rank
    const allMatch = subset.every((c) => c.rank === handCard.rank);
    if (allMatch) {
      options.push({
        type: 'pair',
        boardCards: [...subset],
        points: handPoints + sumPoints(subset),
      });
      continue; // A pair subset can't also be a sum
    }

    // Check SUM: only if hand is not face, and no face cards in subset
    if (handIsFace) continue;
    if (subset.some((c) => isFace(c.rank))) continue;
    if (subset.length < 2) continue; // Sum needs at least 2 board cards

    const subsetSum = sumValue(subset);
    if (subsetSum === handValue) {
      options.push({
        type: 'sum',
        boardCards: [...subset],
        points: handPoints + sumPoints(subset),
      });
    }
  }

  return options;
}

// ── Multi-Slot Capture Enumeration ─────────────────────────────────────
// Find ALL valid multi-slot captures (2-3 non-overlapping slots).
// Each slot is independently a valid single-slot capture option.

function slotsOverlap(a: SingleSlotOption, b: SingleSlotOption): boolean {
  const ids = new Set(a.boardCards.map((c) => c.id));
  return b.boardCards.some((c) => ids.has(c.id));
}

function anyOverlapInTriple(
  a: SingleSlotOption,
  b: SingleSlotOption,
  c: SingleSlotOption,
): boolean {
  return slotsOverlap(a, b) || slotsOverlap(a, c) || slotsOverlap(b, c);
}

export function findAllMultiSlotCaptures(
  handCard: Card,
  board: readonly Card[],
): GroundTruthCapture[] {
  const singles = findAllSingleSlotCaptures(handCard, board);
  if (singles.length < 2) return [];

  const handPoints = cardPoints(handCard);
  const results: GroundTruthCapture[] = [];
  const seen = new Set<string>();

  const n = singles.length;

  // 2-slot combinations
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (slotsOverlap(singles[i], singles[j])) continue;
      const allBoardCards = [...singles[i].boardCards, ...singles[j].boardCards];
      const key = boardCardKey(allBoardCards);
      if (seen.has(key)) continue;
      seen.add(key);

      const totalPoints = handPoints + sumPoints(allBoardCards);
      results.push({
        type: 'multi',
        handCard,
        slots: [
          { type: singles[i].type, cards: singles[i].boardCards },
          { type: singles[j].type, cards: singles[j].boardCards },
        ],
        totalPoints,
        boardCardKey: key,
      });
    }
  }

  // 3-slot combinations
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (slotsOverlap(singles[i], singles[j])) continue;
      for (let k = j + 1; k < n; k++) {
        if (anyOverlapInTriple(singles[i], singles[j], singles[k])) continue;
        const allBoardCards = [
          ...singles[i].boardCards,
          ...singles[j].boardCards,
          ...singles[k].boardCards,
        ];
        const key = boardCardKey(allBoardCards);
        if (seen.has(key)) continue;
        seen.add(key);

        const totalPoints = handPoints + sumPoints(allBoardCards);
        results.push({
          type: 'multi',
          handCard,
          slots: [
            { type: singles[i].type, cards: singles[i].boardCards },
            { type: singles[j].type, cards: singles[j].boardCards },
            { type: singles[k].type, cards: singles[k].boardCards },
          ],
          totalPoints,
          boardCardKey: key,
        });
      }
    }
  }

  return results;
}

// ── Complete Ground Truth ──────────────────────────────────────────────
// Returns ALL legal captures: every single-slot AND every multi-slot.

export function enumerateAllCaptures(
  handCard: Card,
  board: readonly Card[],
): GroundTruthCapture[] {
  const results: GroundTruthCapture[] = [];
  const handPoints = cardPoints(handCard);

  // Single-slot captures
  const singles = findAllSingleSlotCaptures(handCard, board);
  for (const s of singles) {
    results.push({
      type: 'single',
      handCard,
      slots: [{ type: s.type, cards: s.boardCards }],
      totalPoints: s.points,
      boardCardKey: boardCardKey(s.boardCards),
    });
  }

  // Multi-slot captures
  const multis = findAllMultiSlotCaptures(handCard, board);
  results.push(...multis);

  return results;
}

// ── Scoring Verification ───────────────────────────────────────────────

export function computeExpectedScore(handCard: Card, boardCards: Card[]): number {
  return cardPoints(handCard) + sumPoints(boardCards);
}
