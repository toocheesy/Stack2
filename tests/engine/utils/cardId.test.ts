import { describe, expect, it } from 'vitest';
import { RANKS, SUITS } from '../../../src/engine/types';
import { cardId } from '../../../src/engine/utils/cardId';
import { createDeck, shuffleDeck } from '../../../src/engine/utils/deck';
import { createPRNG } from '../../../src/engine/utils/prng';

// S-006: a card's ID is its rank and suit (architecture rule 3).
describe('cardId', () => {
  it('is the rank followed by the suit letter', () => {
    expect(cardId('5', 'clubs')).toBe('5C');
    expect(cardId('10', 'hearts')).toBe('10H');
    expect(cardId('A', 'spades')).toBe('AS');
    expect(cardId('K', 'diamonds')).toBe('KD');
  });

  it('is unique across all 52 rank-and-suit pairs', () => {
    const ids = new Set<string>();
    for (const suit of SUITS) for (const rank of RANKS) ids.add(cardId(rank, suit));
    expect(ids.size).toBe(52);
  });
});

describe('createDeck IDs', () => {
  it('gives every card its rank-and-suit ID, and never a card_ ID', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
    for (const c of deck) {
      expect(c.id).toBe(cardId(c.rank, c.suit));
      expect(c.id.startsWith('card_')).toBe(false);
    }
  });

  it('holds 52 unique IDs, each matching its card, for seeds 1 to 1000', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const deck = shuffleDeck(createDeck(), createPRNG(seed));
      const ids = new Set(deck.map((c) => c.id));
      expect(ids.size).toBe(52);
      for (const c of deck) expect(c.id).toBe(cardId(c.rank, c.suit));
    }
  });
});
