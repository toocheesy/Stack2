import type { Card } from '../types';
import { RANK_VALUES, RANKS, SUITS } from '../types';
import type { PRNG } from './prng';
import type { IdGenerator } from './uuid';

export function createDeck(idGenerator: IdGenerator): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: idGenerator.generateCardId(),
        suit,
        rank,
        value: RANK_VALUES[rank],
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: readonly Card[], prng: PRNG): Card[] {
  return prng.shuffle(deck);
}
