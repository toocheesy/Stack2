import type { GameState, PlayerIndex, Scores, TurnResult } from '../types';
import { SCORE_KEYS } from '../types';
import { calculateCardsPoints } from './scoring';

export function findNextPlayerWithCards(
  state: GameState,
  skipCurrent: boolean,
): PlayerIndex | null {
  const offsets = skipCurrent ? [1, 2] : [0, 1, 2];
  for (const o of offsets) {
    const p = ((state.currentPlayer + o) % 3) as PlayerIndex;
    if (state.hands[p].length > 0) return p;
  }
  return null;
}

function anyPlayerHasCards(state: GameState): boolean {
  return state.hands.some((h) => h.length > 0);
}

// The overall scores once the round's last capturer takes the table (RULES.md Law 10).
function projectedScores(state: GameState): Scores {
  if (state.lastCapturer === null || state.board.length === 0) return state.overallScores;
  const key = SCORE_KEYS[state.lastCapturer];
  return { ...state.overallScores, [key]: state.overallScores[key] + calculateCardsPoints(state.board) };
}

export function determineTurnResult(state: GameState): TurnResult {
  if (anyPlayerHasCards(state)) {
    const skipCurrent = state.lastAction === 'place';
    const next = findNextPlayerWithCards(state, skipCurrent);
    if (next !== null) {
      return { type: 'CONTINUE_TURN', nextPlayer: next };
    }
  }

  if (state.deck.length >= 12) {
    // Position locks for the whole round — first player is always
    // (dealer + 1) % 3, regardless of who placed last in the previous
    // hand. Round-boundary rotation lives in startNewRound.
    // RULES.md Classic rule 3.
    const startingPlayer = ((state.currentDealer + 1) % 3) as PlayerIndex;
    return { type: 'DEAL_NEW_HAND', startingPlayer };
  }

  const projectedOverall = projectedScores(state);
  const target = state.settings.targetScore;

  const indices: PlayerIndex[] = [0, 1, 2];
  const maxScore = Math.max(...indices.map((i) => projectedOverall[SCORE_KEYS[i]]));
  const leaders = indices.filter((i) => projectedOverall[SCORE_KEYS[i]] === maxScore);

  if (maxScore >= target) {
    if (leaders.length === 1) {
      return { type: 'END_GAME', winner: leaders[0] };
    }
    // RULES.md Law 11 — tied leaders at/above target trigger overtime.
    // Game does NOT end. Continue into a new round; recursion is automatic
    // via re-entry into determineTurnResult at the next round boundary.
    return { type: 'END_ROUND', isOvertime: true };
  }

  return { type: 'END_ROUND', isOvertime: false };
}
