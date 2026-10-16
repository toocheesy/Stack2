// A headless full-game runner, for tests only (S-006). It drives all three
// seats with decideBotAction through the engine's own functions and
// determineTurnResult, in the controller's order (deal, turns, Take the Table,
// round end, new round, game end), and updates the card tracker the way
// useGameController does. The deal stream and the bot stream are the
// controller's two streams.
import type {
  Combination,
  Difficulty,
  GameSettings,
  GameState,
  PlayerIndex,
  Scores,
} from '../../../src/engine/types';
import {
  applyJackpot,
  createInitialState,
  dealNewHand,
  executeCapture,
  placeCard,
  startNewRound,
} from '../../../src/engine/core/gameState';
import { botCaptureToCombination, validateFullCombo } from '../../../src/engine/core/captureValidator';
import { determineTurnResult } from '../../../src/engine/core/turnManager';
import { botStreamSeed, createPRNG } from '../../../src/engine/utils/prng';
import {
  createGameTracker,
  recordCapture,
  recordPlacement,
  seedInitialDeal,
  type CardTrackerState,
} from '../../../src/engine/ai/cardTracker';
import { decideBotAction, getBotThinkingDelay } from '../../../src/engine/ai/botDecision';

export interface DealRecord {
  round: number;
  hand: number;
  deck: string[];
  board: string[];
  hands: [string[], string[], string[]];
}

export interface MoveRecord {
  round: number;
  player: PlayerIndex;
  action: 'capture' | 'place';
  card: string;
  captured: string[];
}

export interface GameLog {
  deals: DealRecord[];
  moves: MoveRecord[];
  rounds: number;
  scores: Scores;
  winner: PlayerIndex;
}

export interface RunOptions {
  // How seat 0 (the player) decides; the bots use the game settings.
  seatZero?: Difficulty;
  // Called after every move and after every end-of-round sweep, with the
  // IDs captured so far this round.
  onStep?: (state: GameState, capturedThisRound: readonly string[]) => void;
  maxMoves?: number;
}

function ids(cards: readonly { id: string }[]): string[] {
  return cards.map((c) => c.id);
}

function dealRecord(state: GameState): DealRecord {
  return {
    round: state.currentRound,
    hand: state.handNumber,
    deck: ids(state.deck),
    board: ids(state.board),
    hands: [ids(state.hands[0]), ids(state.hands[1]), ids(state.hands[2])],
  };
}

export function playGame(seed: number, settings: GameSettings, options: RunOptions = {}): GameLog {
  const seatZero = options.seatZero ?? 'intermediate';
  const maxMoves = options.maxMoves ?? 5000;
  const dealPrng = createPRNG(seed);
  const botPrng = createPRNG(botStreamSeed(seed));

  let state = createInitialState(settings, dealPrng);
  let tracker: CardTrackerState = createGameTracker(state.board);
  let captured: string[] = [];
  const deals: DealRecord[] = [dealRecord(state)];
  const moves: MoveRecord[] = [];
  let winner: PlayerIndex | null = null;

  const step = () => options.onStep?.(state, captured);

  // Mirrors advanceRef.current in useGameController.
  const advance = (): void => {
    const result = determineTurnResult(state);
    switch (result.type) {
      case 'CONTINUE_TURN':
        state = { ...state, currentPlayer: result.nextPlayer, dumpActive: result.dumpActive ?? state.dumpActive };
        return;
      case 'DEAL_NEW_HAND':
        state = { ...dealNewHand(state), currentPlayer: result.startingPlayer };
        tracker = seedInitialDeal(tracker, state.hands.length * 4);
        deals.push(dealRecord(state));
        return;
      case 'END_ROUND':
      case 'END_GAME': {
        const boardBefore = state.board.slice();
        const { state: afterJackpot, jackpotResult } = applyJackpot(state);
        if (jackpotResult) {
          tracker = recordCapture(tracker, jackpotResult.player, boardBefore);
          captured = captured.concat(ids(boardBefore));
        }
        state =
          result.type === 'END_ROUND'
            ? { ...afterJackpot, gamePhase: 'roundEnd', isOvertime: result.isOvertime }
            : { ...afterJackpot, gamePhase: 'gameOver' };
        if (result.type === 'END_GAME') winner = result.winner;
        step();
        return;
      }
    }
  };

  // Mirrors runBotTurn in useGameController, for any seat.
  const takeTurn = (player: PlayerIndex): void => {
    const difficulty: Difficulty =
      player === 0 ? seatZero : player === 1 ? state.settings.bot1Personality : state.settings.bot2Personality;
    if (player !== 0) getBotThinkingDelay(difficulty, botPrng);
    const decision = decideBotAction(state, player, difficulty, tracker, botPrng);

    // Bot captures go through the same capture check as the player's.
    let combo: Combination | null = null;
    if (decision.action === 'capture' && decision.captureDetails) {
      const candidate = botCaptureToCombination(decision.handCard, decision.captureDetails.slots, state.board);
      if (validateFullCombo(state, candidate).isValid) combo = candidate;
    }

    if (combo && decision.captureDetails) {
      state = executeCapture(state, combo);
      tracker = recordCapture(tracker, player, decision.captureDetails.capturedCards);
      const taken = ids(decision.captureDetails.capturedCards);
      captured = captured.concat(taken);
      moves.push({ round: state.currentRound, player, action: 'capture', card: decision.handCard.id, captured: taken });
    } else {
      const handBefore = state.hands[player];
      state = placeCard(state, decision.handCard.id);
      for (const c of handBefore) {
        if (!state.hands[player].some((h) => h.id === c.id)) tracker = recordPlacement(tracker, c);
      }
      moves.push({ round: state.currentRound, player, action: 'place', card: decision.handCard.id, captured: [] });
    }
    step();
  };

  while (winner === null) {
    if (moves.length > maxMoves) throw new Error(`playGame: more than ${maxMoves} moves for seed ${seed}`);
    if (state.gamePhase === 'roundEnd') {
      state = startNewRound(state, dealPrng);
      captured = [];
      deals.push(dealRecord(state));
      continue;
    }
    const player = state.currentPlayer;
    if (state.hands[player].length > 0) takeTurn(player);
    advance();
  }

  return { deals, moves, rounds: state.currentRound, scores: { ...state.overallScores }, winner };
}
