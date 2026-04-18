import type { Card, GameState, PlayerIndex } from '../types';
import { PLAYER_NAMES, SCORE_KEYS, SCORE_VALUES } from '../types';

export function calculateCardPoints(card: Card): number {
  return SCORE_VALUES[card.rank];
}

export function calculateCardsPoints(cards: readonly Card[]): number {
  let total = 0;
  for (const c of cards) total += calculateCardPoints(c);
  return total;
}

export interface RankedPlayer {
  name: string;
  score: number;
  index: PlayerIndex;
  overall: number;
}

export function getRankedPlayers(state: GameState): RankedPlayer[] {
  const indices: PlayerIndex[] = [0, 1, 2];
  const ranked = indices.map((i) => ({
    name: PLAYER_NAMES[i],
    score: state.scores[SCORE_KEYS[i]],
    index: i,
    overall: state.overallScores[SCORE_KEYS[i]],
  }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
