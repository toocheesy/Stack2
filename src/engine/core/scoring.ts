import type { Card } from '../types';
import { SCORE_VALUES } from '../types';

export function calculateCardPoints(card: Card): number {
  return SCORE_VALUES[card.rank];
}

export function calculateCardsPoints(cards: readonly Card[]): number {
  let total = 0;
  for (const c of cards) total += calculateCardPoints(c);
  return total;
}
