import { describe, expect, it } from 'vitest';
import {
  botCaptureToCombination,
  findAllCaptures,
  findBestMultiSlotCapture,
  validateFullCombo,
} from '../../../src/engine/core/captureValidator';
import type { Card, GameState, MultiSlotCaptureSlot, Rank, Suit } from '../../../src/engine/types';
import { RANK_VALUES, RANKS, SUITS } from '../../../src/engine/types';
import { createPRNG, type PRNG } from '../../../src/engine/utils/prng';

// Random states built the way tests/coverage/move-space-coverage.test.ts
// builds them: a shuffled full deck, a hand of 1–4 and a board of 1–12.
let nextId = 0;
function makeCard(rank: Rank, suit: Suit): Card {
  return { id: `t${++nextId}`, rank, suit, value: RANK_VALUES[rank] };
}

function createFullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(makeCard(rank, suit));
  }
  return deck;
}

function generateRandomState(prng: PRNG): { hand: Card[]; board: Card[] } {
  nextId = 0;
  const deck = prng.shuffle(createFullDeck());
  const handSize = prng.nextInt(1, 4);
  const boardSize = prng.nextInt(1, 12);
  return {
    hand: deck.slice(0, handSize),
    board: deck.slice(handSize, handSize + boardSize),
  };
}

function stateFor(hand: Card[], board: Card[]): GameState {
  return {
    deck: [],
    board,
    hands: [[], hand, []],
    scores: { player: 0, bot1: 0, bot2: 0 },
    overallScores: { player: 0, bot1: 0, bot2: 0 },
    combination: { base: null, combo1: [], combo2: [], combo3: [] },
    currentPlayer: 1,
    lastAction: null,
    lastCapturer: null,
    settings: { targetScore: 100, bot1Personality: 'beginner', bot2Personality: 'beginner' },
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
    isOvertime: false,
  };
}

describe('botCaptureToCombination', () => {
  it('base = the hand card; slots in order, each card from the board with its board index', () => {
    const hand = makeCard('5', 'hearts');
    const b5 = makeCard('5', 'clubs');
    const b2 = makeCard('2', 'hearts');
    const b3 = makeCard('3', 'spades');
    const board = [b2, b5, b3];
    const slots: MultiSlotCaptureSlot[] = [
      { slot: 'combo1', cards: [b5], type: 'pair' },
      { slot: 'combo2', cards: [b2, b3], type: 'sum' },
    ];
    const combo = botCaptureToCombination(hand, slots, board);
    expect(combo.base).toBe(hand);
    expect(combo.combo1).toEqual([{ card: b5, source: 'board', originalIndex: 1 }]);
    expect(combo.combo2).toEqual([
      { card: b2, source: 'board', originalIndex: 0 },
      { card: b3, source: 'board', originalIndex: 2 },
    ]);
    expect(combo.combo3).toEqual([]);
  });

  it('every capture from findAllCaptures and findBestMultiSlotCapture passes validateFullCombo', () => {
    const SEED = 20260509;
    const STATE_COUNT = 2000;
    let checked = 0;
    for (let i = 0; i < STATE_COUNT; i++) {
      const { hand, board } = generateRandomState(createPRNG(SEED + i));
      const state = stateFor(hand, board);
      for (const handCard of hand) {
        for (const opt of findAllCaptures(handCard, board)) {
          const slots: MultiSlotCaptureSlot[] = [
            { slot: 'combo1', cards: opt.boardCards, type: opt.type },
          ];
          const v = validateFullCombo(state, botCaptureToCombination(handCard, slots, board));
          expect(v.errors).toEqual([]);
          expect(v.totalPoints).toBe(opt.points);
          checked++;
        }
        const multi = findBestMultiSlotCapture(handCard, board);
        if (multi) {
          const v = validateFullCombo(state, botCaptureToCombination(handCard, multi.slots, board));
          expect(v.errors).toEqual([]);
          expect(v.totalPoints).toBe(multi.totalPoints);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a bot slot card that is not on the board is refused', () => {
    const hand = makeCard('5', 'hearts');
    const b5 = makeCard('5', 'clubs');
    const elsewhere = makeCard('5', 'spades');
    const board = [b5];
    const state = stateFor([hand], board);
    const slots: MultiSlotCaptureSlot[] = [
      { slot: 'combo1', cards: [b5, elsewhere], type: 'pair' },
    ];
    const combo = botCaptureToCombination(hand, slots, board);
    expect(combo.combo1[1].originalIndex).toBe(-1);
    expect(validateFullCombo(state, combo).isValid).toBe(false);
  });
});
