import type { Card, PlayerIndex, Rank } from '../types';
import { RANKS } from '../types';

export type CardLocation = 'board' | 'captured_p0' | 'captured_p1' | 'captured_p2';
export type GamePhase = 'early' | 'mid' | 'late' | 'endgame';

export interface CardTrackerState {
  seenCards: Map<string, CardLocation>;
  valueCounts: Record<Rank, number>;
  playerCaptures: [Card[], Card[], Card[]];
  deckRemaining: number;
  totalSeen: number;
  gamePhase: GamePhase;
}

const DECK_SIZE = 52;

function emptyValueCounts(): Record<Rank, number> {
  const counts = {} as Record<Rank, number>;
  for (const r of RANKS) counts[r] = 0;
  return counts;
}

export function createCardTracker(): CardTrackerState {
  return {
    seenCards: new Map(),
    valueCounts: emptyValueCounts(),
    playerCaptures: [[], [], []],
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

function cloneState(tracker: CardTrackerState): CardTrackerState {
  return {
    seenCards: new Map(tracker.seenCards),
    valueCounts: { ...tracker.valueCounts },
    playerCaptures: [
      tracker.playerCaptures[0].slice(),
      tracker.playerCaptures[1].slice(),
      tracker.playerCaptures[2].slice(),
    ],
    deckRemaining: tracker.deckRemaining,
    totalSeen: tracker.totalSeen,
    gamePhase: tracker.gamePhase,
  };
}

function locationFor(playerIndex: PlayerIndex): CardLocation {
  return `captured_p${playerIndex}` as CardLocation;
}

export function recordCapture(
  tracker: CardTrackerState,
  playerIndex: PlayerIndex,
  cards: readonly Card[],
): CardTrackerState {
  const next = cloneState(tracker);
  const location = locationFor(playerIndex);
  for (const c of cards) {
    const known = next.seenCards.has(c.id);
    next.seenCards.set(c.id, location);
    if (!known) {
      next.valueCounts[c.rank] += 1;
      next.totalSeen += 1;
    }
    next.playerCaptures[playerIndex].push(c);
  }
  next.deckRemaining = Math.max(0, DECK_SIZE - next.totalSeen);
  next.gamePhase = updateGamePhase(next);
  return next;
}

export function recordPlacement(
  tracker: CardTrackerState,
  card: Card,
): CardTrackerState {
  const next = cloneState(tracker);
  if (!next.seenCards.has(card.id)) {
    next.valueCounts[card.rank] += 1;
    next.totalSeen += 1;
  }
  next.seenCards.set(card.id, 'board');
  next.deckRemaining = Math.max(0, DECK_SIZE - next.totalSeen);
  next.gamePhase = updateGamePhase(next);
  return next;
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
