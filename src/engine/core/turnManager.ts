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
    if (skipCurrent && state.hands[state.currentPlayer].length > 0) {
      return { type: 'CONTINUE_TURN', nextPlayer: state.currentPlayer };
    }
  }

  if (state.deck.length >= 12) {
    const startingPlayer: PlayerIndex =
      state.lastAction === 'place'
        ? (((state.currentPlayer + 1) % 3) as PlayerIndex)
        : state.currentPlayer;
    return { type: 'DEAL_NEW_HAND', startingPlayer };
  }

  const { jackpotResult, projectedOverall } = projectJackpot(state);
  const target = state.settings.targetScore;

  const indices: PlayerIndex[] = [0, 1, 2];
  const qualifyingWinners = indices.filter(
    (i) => projectedOverall[SCORE_KEYS[i]] >= target,
  );

  if (qualifyingWinners.length > 0) {
    let winner = qualifyingWinners[0];
    for (const i of qualifyingWinners) {
      if (projectedOverall[SCORE_KEYS[i]] > projectedOverall[SCORE_KEYS[winner]]) {
        winner = i;
      }
    }
    return {
      type: 'END_GAME',
      scores: projectedOverall,
      jackpotResult,
      winner,
      winnerName: PLAYER_NAMES[winner],
    };
  }

  const newDealer = ((state.currentDealer + 1) % 3) as PlayerIndex;
  return {
    type: 'END_ROUND',
    scores: projectedOverall,
    jackpotResult,
    newDealer,
  };
}
