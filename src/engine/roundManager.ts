import type { GameState, PlayerIndex } from './types';
import { SCORE_KEYS } from './types';
import type { GameEvent } from './events';
import { applyJackpot, startNewRound } from './core/gameState';
import type { PRNG } from './utils/prng';
import type { IdGenerator } from './utils/uuid';

export interface RoundEndResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * Finds the winner if any player has reached the target score.
 * Tiebreaker: lastCapturer wins when scores are equal.
 */
export function findWinner(state: GameState): PlayerIndex | null {
  const target = state.settings.targetScore;
  const indices: PlayerIndex[] = [0, 1, 2];
  const qualifying = indices.filter(
    (i) => state.overallScores[SCORE_KEYS[i]] >= target,
  );

  if (qualifying.length === 0) return null;

  let winner = qualifying[0];
  for (const i of qualifying) {
    const iScore = state.overallScores[SCORE_KEYS[i]];
    const wScore = state.overallScores[SCORE_KEYS[winner]];
    if (iScore > wScore) {
      winner = i;
    } else if (iScore === wScore && state.lastCapturer === i) {
      winner = i;
    }
  }

  return winner;
}

/**
 * Resolves end-of-round: applies jackpot, checks game over, optionally
 * starts a new round. Returns the resulting state and emitted events.
 */
export function resolveRoundEnd(
  state: GameState,
  prng: PRNG,
  idGen: IdGenerator,
): RoundEndResult {
  const events: GameEvent[] = [];

  // 1. Apply jackpot
  const { state: afterJackpot, jackpotResult } = applyJackpot(state);
  let current: GameState = { ...afterJackpot, gamePhase: 'jackpot' };

  if (jackpotResult) {
    events.push({
      type: 'jackpot_resolved',
      winner: jackpotResult.player,
      cards: state.board,
      points: jackpotResult.points,
    });
  }

  // 2. Check game over
  const winner = findWinner(current);
  if (winner !== null) {
    current = { ...current, gamePhase: 'gameOver' };
    events.push({
      type: 'game_over',
      winner,
      gameStats: current.gameStats,
    });
    return { state: current, events };
  }

  // 3. Round end → start new round
  current = { ...current, gamePhase: 'roundEnd' };
  events.push({
    type: 'round_end',
    roundNumber: current.currentRound,
    roundStats: current.roundStats,
  });

  const next = startNewRound(current, prng, idGen);
  events.push({
    type: 'new_round_started',
    roundNumber: next.currentRound,
  });
  events.push({
    type: 'deck_count_changed',
    remainingCards: next.deck.length,
  });

  return { state: next, events };
}
