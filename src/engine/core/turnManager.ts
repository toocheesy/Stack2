import type {
  GameState,
  JackpotResult,
  PlayerIndex,
  Scores,
  TurnResult,
} from '../types';
import { PLAYER_NAMES, SCORE_KEYS } from '../types';
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

function projectJackpot(state: GameState): {
  jackpotResult: JackpotResult | null;
  projectedOverall: Scores;
} {
  if (state.lastCapturer === null || state.board.length === 0) {
    return { jackpotResult: null, projectedOverall: state.overallScores };
  }
  const player = state.lastCapturer;
  const points = calculateCardsPoints(state.board);
  const cardCount = state.board.length;
  const jackpotResult: JackpotResult = {
    player,
    points,
    cardCount,
    message: `${PLAYER_NAMES[player]} sweeps ${cardCount} board cards for ${points} points`,
  };
  const key = SCORE_KEYS[player];
  const projectedOverall: Scores = {
    ...state.overallScores,
    [key]: state.overallScores[key] + points,
  };
  return { jackpotResult, projectedOverall };
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
    // Doctrine 5.7.
    const startingPlayer = ((state.currentDealer + 1) % 3) as PlayerIndex;
    return { type: 'DEAL_NEW_HAND', startingPlayer };
  }

  const { jackpotResult, projectedOverall } = projectJackpot(state);
  const target = state.settings.targetScore;
  const newDealer = ((state.currentDealer + 1) % 3) as PlayerIndex;

  const indices: PlayerIndex[] = [0, 1, 2];
  const maxScore = Math.max(...indices.map((i) => projectedOverall[SCORE_KEYS[i]]));
  const leaders = indices.filter((i) => projectedOverall[SCORE_KEYS[i]] === maxScore);

  if (maxScore >= target) {
    if (leaders.length === 1) {
      const winner = leaders[0];
      return {
        type: 'END_GAME',
        scores: projectedOverall,
        jackpotResult,
        winner,
        winnerName: PLAYER_NAMES[winner],
      };
    }
    // Doctrine 5.4 — tied leaders at/above target trigger overtime.
    // Game does NOT end. Continue into a new round; recursion is automatic
    // via re-entry into determineTurnResult at the next round boundary.
    return {
      type: 'END_ROUND',
      scores: projectedOverall,
      jackpotResult,
      newDealer,
      isOvertime: true,
    };
  }

  return {
    type: 'END_ROUND',
    scores: projectedOverall,
    jackpotResult,
    newDealer,
    isOvertime: false,
  };
}
