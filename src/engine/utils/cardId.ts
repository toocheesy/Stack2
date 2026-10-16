import type { Rank, Suit } from '../types';

// A card's ID is its rank and suit: 5C is the five of clubs, 10H the ten of
// hearts. Unique in a one-deck game and readable (S-006, architecture rule 3).
const SUIT_LETTER: Record<Suit, string> = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
};

export function cardId(rank: Rank, suit: Suit): string {
  return `${rank}${SUIT_LETTER[suit]}`;
}
