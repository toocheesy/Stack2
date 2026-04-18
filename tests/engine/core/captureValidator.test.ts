import { describe, expect, it } from 'vitest';
import {
  findAllCaptures,
  findBestMultiSlotCapture,
  validateComboSlot,
  validateFullCombo,
} from '../../../src/engine/core/captureValidator';
import type {
  Card,
  CaptureGroup,
  GameState,
  Rank,
  Suit,
} from '../../../src/engine/types';
import { RANK_VALUES } from '../../../src/engine/types';

let idCounter = 0;
function card(rank: Rank, suit: Suit = 'hearts'): Card {
  return {
    id: `c${++idCounter}`,
    rank,
    suit,
    value: RANK_VALUES[rank],
  };
}

function group(c: Card, source: 'hand' | 'board' = 'board'): CaptureGroup {
  return { card: c, source, originalIndex: 0 };
}

function minimalState(overrides: Partial<GameState>): GameState {
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
    ...overrides,
  };
}

describe('validateComboSlot', () => {
  it('valid pair: slot card matches base rank', () => {
    const base = card('5', 'hearts');
    const slot = [group(card('5', 'clubs'))];
    const v = validateComboSlot(slot, base);
    expect(v.isValid).toBe(true);
    expect(v.captureType).toBe('pair');
  });

  it('valid multi-card pair', () => {
    const base = card('5');
    const slot = [group(card('5', 'clubs')), group(card('5', 'spades'))];
    const v = validateComboSlot(slot, base);
    expect(v.isValid).toBe(true);
    expect(v.captureType).toBe('pair');
  });

  it('valid 2-card sum: 2+3=5', () => {
    const base = card('5');
    const slot = [group(card('2')), group(card('3'))];
    const v = validateComboSlot(slot, base);
    expect(v.isValid).toBe(true);
    expect(v.captureType).toBe('sum');
  });

  it('valid 3-card sum: A+2+4=7', () => {
    const base = card('7');
    const slot = [group(card('A')), group(card('2')), group(card('4'))];
    const v = validateComboSlot(slot, base);
    expect(v.isValid).toBe(true);
    expect(v.captureType).toBe('sum');
  });

  it('face card base: only pairs allowed', () => {
    const base = card('K');
    const pair = validateComboSlot([group(card('K'))], base);
    expect(pair.isValid).toBe(true);
    expect(pair.captureType).toBe('pair');
    const sum = validateComboSlot(
      [group(card('2')), group(card('3'))],
      base,
    );
    expect(sum.isValid).toBe(false);
  });

  it('face card in sum slot is rejected', () => {
    const base = card('5');
    const v = validateComboSlot([group(card('J'))], base);
    expect(v.isValid).toBe(false);
  });

  it('sum mismatch rejected', () => {
    const base = card('5');
    const v = validateComboSlot([group(card('2')), group(card('2'))], base);
    expect(v.isValid).toBe(false);
  });

  it('empty slot rejected', () => {
    const v = validateComboSlot([], card('5'));
    expect(v.isValid).toBe(false);
  });

  it('ace in sum uses value 1', () => {
    const base = card('4');
    const v = validateComboSlot(
      [group(card('A')), group(card('3'))],
      base,
    );
    expect(v.isValid).toBe(true);
    expect(v.captureType).toBe('sum');
  });
});

describe('validateFullCombo', () => {
  it('rejects missing base', () => {
    const state = minimalState({ currentPlayer: 0 });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(false);
    expect(v.errors[0]).toMatch(/base/i);
  });

  it('rejects all-empty combo slots', () => {
    const base = card('5');
    const state = minimalState({
      hands: [[base], [], []],
      combination: { base, combo1: [], combo2: [], combo3: [] },
    });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(false);
  });

  it('valid: hand base + board pair', () => {
    const base = card('7', 'hearts');
    const board7 = card('7', 'clubs');
    const state = minimalState({
      hands: [[base], [], []],
      board: [board7],
      combination: {
        base,
        combo1: [group(board7, 'board')],
        combo2: [],
        combo3: [],
      },
    });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(true);
    expect(v.allCapturedCards.map((c) => c.id).sort()).toEqual(
      [base.id, board7.id].sort(),
    );
    expect(v.totalPoints).toBe(10);
  });

  it('valid multi-slot capture: pair + sum', () => {
    const base = card('5', 'hearts');
    const b5 = card('5', 'clubs');
    const b2 = card('2');
    const b3 = card('3');
    const state = minimalState({
      hands: [[base], [], []],
      board: [b5, b2, b3],
      combination: {
        base,
        combo1: [group(b5, 'board')],
        combo2: [group(b2, 'board'), group(b3, 'board')],
        combo3: [],
      },
    });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(true);
    expect(v.allCapturedCards).toHaveLength(4);
  });

  it('rejects when no hand card in combo', () => {
    const base = card('5', 'hearts');
    const b5 = card('5', 'clubs');
    const state = minimalState({
      hands: [[], [], []],
      board: [base, b5],
      combination: {
        base,
        combo1: [group(b5, 'board')],
        combo2: [],
        combo3: [],
      },
    });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(false);
  });

  it('rejects when no board card in combo', () => {
    const base = card('5', 'hearts');
    const h5 = card('5', 'clubs');
    const state = minimalState({
      hands: [[base, h5], [], []],
      combination: {
        base,
        combo1: [group(h5, 'hand')],
        combo2: [],
        combo3: [],
      },
    });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(false);
  });

  it('rejects invalid sum in a slot', () => {
    const base = card('5');
    const b2 = card('2');
    const b2b = card('2', 'clubs');
    const state = minimalState({
      hands: [[base], [], []],
      board: [b2, b2b],
      combination: {
        base,
        combo1: [group(b2, 'board'), group(b2b, 'board')],
        combo2: [],
        combo3: [],
      },
    });
    const v = validateFullCombo(state);
    expect(v.isValid).toBe(false);
  });
});

describe('findAllCaptures', () => {
  it('finds pair captures', () => {
    const hand = card('7', 'hearts');
    const board = [card('7', 'clubs'), card('3'), card('5')];
    const opts = findAllCaptures(hand, board);
    expect(opts.some((o) => o.type === 'pair' && o.boardCards.length === 1)).toBe(true);
  });

  it('finds 2-card and 3-card sums', () => {
    const hand = card('7', 'hearts');
    const board = [card('2'), card('5'), card('A', 'clubs'), card('6')];
    const opts = findAllCaptures(hand, board);
    expect(opts.some((o) => o.type === 'sum' && o.boardCards.length === 2)).toBe(
      true,
    );
  });

  it('face card hand: pairs only, no sums', () => {
    const hand = card('K', 'hearts');
    const board = [card('K', 'clubs'), card('3'), card('7')];
    const opts = findAllCaptures(hand, board);
    expect(opts.every((o) => o.type === 'pair')).toBe(true);
    expect(opts).toHaveLength(1);
  });

  it('does not include face cards in sums', () => {
    const hand = card('7');
    const board = [card('J'), card('3'), card('4')];
    const opts = findAllCaptures(hand, board);
    const sums = opts.filter((o) => o.type === 'sum');
    for (const s of sums) {
      expect(s.boardCards.every((c) => !['J', 'Q', 'K'].includes(c.rank))).toBe(
        true,
      );
    }
  });
});

describe('findBestMultiSlotCapture', () => {
  it('returns null when fewer than 2 captures available', () => {
    const hand = card('7');
    const board = [card('2'), card('4')];
    expect(findBestMultiSlotCapture(hand, board)).toBeNull();
  });

  it('returns non-overlapping best pair', () => {
    const hand = card('5');
    const board = [
      card('5', 'clubs'),
      card('2'),
      card('3'),
    ];
    const result = findBestMultiSlotCapture(hand, board);
    expect(result).not.toBeNull();
    expect(result!.slots).toHaveLength(2);
    const ids = new Set<string>();
    for (const s of result!.slots) {
      for (const c of s.cards) {
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
      }
    }
  });

  it('picks up to 3 non-overlapping captures', () => {
    const hand = card('5');
    const board = [
      card('5', 'clubs'),
      card('5', 'spades'),
      card('2'),
      card('3'),
      card('A'),
      card('4'),
    ];
    const result = findBestMultiSlotCapture(hand, board);
    expect(result).not.toBeNull();
    expect(result!.slots.length).toBeGreaterThanOrEqual(2);
    expect(result!.slots.length).toBeLessThanOrEqual(3);
  });
});
