import type { GameState, Rank } from '../types';
import { RANKS } from '../types';

export type GamePhase = 'early' | 'mid' | 'late' | 'endgame';

// The bots' memory of played cards (S-008): for each rank, how many of its
// four cards have been seen; the totals; the phase. It is worked out from the
// game state each turn by readCardMemory and never stored.
export interface CardTrackerState {
  valueCounts: Record<Rank, number>;
  deckRemaining: number;
  totalSeen: number;
  gamePhase: GamePhase;
}

const DECK_SIZE = 52;
const CARDS_PER_RANK = 4;

function emptyValueCounts(): Record<Rank, number> {
  const counts = {} as Record<Rank, number>;
  for (const r of RANKS) counts[r] = 0;
  return counts;
}

// An empty memory, nothing seen. Used by tests.
export function createCardTracker(): CardTrackerState {
  return {
    valueCounts: emptyValueCounts(),
    deckRemaining: DECK_SIZE,
    totalSeen: 0,
    gamePhase: 'early',
  };
}

export function updateGamePhase(tracker: CardTrackerState): GamePhase {
  const pct = tracker.totalSeen / DECK_SIZE;
  if (pct < 0.25) return 'early';
  if (pct < 0.5) return 'mid';
  if (pct < 0.75) return 'late';
  return 'endgame';
}

// The memory read from the game state. A card counts as seen once it has left
// the deck and every hand: it is on the board or captured this round. Each
// round deals a fresh deck (RULES.md Classic rule 2), so the memory starts afresh with it,
// and a bot never counts its own hand as seen.
export function readCardMemory(state: GameState): CardTrackerState {
  const valueCounts = emptyValueCounts();
  for (const r of RANKS) valueCounts[r] = CARDS_PER_RANK;
  for (const c of state.deck) valueCounts[c.rank] -= 1;
  for (const hand of state.hands) {
    for (const c of hand) valueCounts[c.rank] -= 1;
  }
  const memory: CardTrackerState = {
    valueCounts,
    deckRemaining: state.deck.length,
    totalSeen: DECK_SIZE - state.deck.length,
    gamePhase: 'early',
  };
  memory.gamePhase = updateGamePhase(memory);
  return memory;
}

export function getRemainingOfRank(
  tracker: CardTrackerState,
  rank: Rank,
): number {
  return Math.max(0, 4 - tracker.valueCounts[rank]);
}

export function estimateDeckComposition(
  tracker: CardTrackerState,
): Record<Rank, number> {
  const result = {} as Record<Rank, number>;
  for (const r of RANKS) {
    result[r] = getRemainingOfRank(tracker, r);
  }
  return result;
}
