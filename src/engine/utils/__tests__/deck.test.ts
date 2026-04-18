import { describe, expect, it } from 'vitest';
import { RANKS, RANK_VALUES, SUITS } from '../../types';
import { createDeck, shuffleDeck } from '../deck';
import { createPRNG } from '../prng';
import { createIdGenerator } from '../uuid';

describe('createDeck', () => {
  it('produces 52 cards', () => {
    const deck = createDeck(createIdGenerator(createPRNG(1)));
    expect(deck).toHaveLength(52);
  });

  it('covers all 13 ranks across all 4 suits exactly once', () => {
    const deck = createDeck(createIdGenerator(createPRNG(1)));
    const seen = new Set<string>();
    for (const c of deck) seen.add(`${c.suit}-${c.rank}`);
    expect(seen.size).toBe(52);
    for (const s of SUITS) {
      for (const r of RANKS) {
        expect(seen.has(`${s}-${r}`)).toBe(true);
      }
    }
  });

  it('assigns correct values (A=1, 2-10 face, JQK=0)', () => {
    const deck = createDeck(createIdGenerator(createPRNG(1)));
    for (const c of deck) {
      expect(c.value).toBe(RANK_VALUES[c.rank]);
    }
    const face = deck.filter((c) => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K');
    expect(face.every((c) => c.value === 0)).toBe(true);
    const aces = deck.filter((c) => c.rank === 'A');
    expect(aces.every((c) => c.value === 1)).toBe(true);
  });

  it('gives every card a unique id', () => {
    const deck = createDeck(createIdGenerator(createPRNG(1)));
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(52);
  });
});

describe('shuffleDeck', () => {
  it('returns a new array, leaves input intact', () => {
    const deck = createDeck(createIdGenerator(createPRNG(1)));
    const snapshot = deck.map((c) => c.id);
    const prng = createPRNG(99);
    const shuffled = shuffleDeck(deck, prng);
    expect(shuffled).not.toBe(deck);
    expect(deck.map((c) => c.id)).toEqual(snapshot);
    expect(shuffled.map((c) => c.id).sort()).toEqual(snapshot.slice().sort());
  });

  it('is deterministic for the same seed', () => {
    const mkDeck = () => createDeck(createIdGenerator(createPRNG(1)));
    const a = shuffleDeck(mkDeck(), createPRNG(500));
    const b = shuffleDeck(mkDeck(), createPRNG(500));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});
