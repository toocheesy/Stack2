// A headless full-game runner, for tests only (S-006). It drives all three
// seats with decideBotAction through the engine's own functions and
// determineTurnResult, in the controller's order (deal, turns, Take the Table,
// round end, new round, game end), and updates the card tracker the way
// useGameController does. The deal stream and the bot stream are the
// controller's two streams. A game can pause mid-round at the controller's
// save point and resume from a save.
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
import { botStreamSeed, createPRNG, type PRNG } from '../../../src/engine/utils/prng';
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
  points: number;
}

// Take the Table at a round's end.
export interface SweepRecord {
  round: number;
  player: PlayerIndex;
  points: number;
}

export interface GameLog {
  deals: DealRecord[];
  moves: MoveRecord[];
  sweeps: SweepRecord[];
  rounds: number;
  scores: Scores;
  // null when the game was paused before it ended.
  winner: PlayerIndex | null;
}

// Where a paused game stands: what the controller saves after a move.
export interface PausedGame {
  state: GameState;
  tracker: CardTrackerState;
  dealStream: number;
  botStream: number;
}

export interface RunResult extends GameLog {
  paused: PausedGame | null;
}

export interface RunOptions {
  // How seat 0 (the player) decides; the bots use the game settings.
  seatZero?: Difficulty;
  // Called after every move and after every end-of-round sweep, with the
  // IDs captured so far this round (since the resume, for a resumed game).
  onStep?: (state: GameState, capturedThisRound: readonly string[]) => void;
  // Called at every round end and at game end, after Take the Table.
  onRoundEnd?: (state: GameState, log: Pick<GameLog, 'moves' | 'sweeps'>) => void;
  // Pause once this many moves have been made and the round is still on.
  stopAfterMoves?: number;
  maxMoves?: number;
}

interface Run {
  state: GameState;
  tracker: CardTrackerState;
  dealPrng: PRNG;
  botPrng: PRNG;
  captured: string[];
  deals: DealRecord[];
  moves: MoveRecord[];
  sweeps: SweepRecord[];
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

export function playGame(seed: number, settings: GameSettings, options: RunOptions = {}): RunResult {
  const dealPrng = createPRNG(seed);
  const state = createInitialState(settings, dealPrng);
  return run(
    {
      state,
      tracker: createGameTracker(state.board),
      dealPrng,
      botPrng: createPRNG(botStreamSeed(seed)),
      captured: [],
      deals: [dealRecord(state)],
      moves: [],
      sweeps: [],
    },
    options,
  );
}

// Plays on from a save, as the controller does on mount.
export function resumeGame(
  saved: { game: GameState; tracker: CardTrackerState; dealStream: number; botStream: number },
  options: RunOptions = {},
): RunResult {
  return run(
    {
      state: saved.game,
      tracker: saved.tracker,
      dealPrng: createPRNG(saved.dealStream),
      botPrng: createPRNG(saved.botStream),
      captured: [],
      deals: [],
      moves: [],
      sweeps: [],
    },
    options,
  );
}

function run(r: Run, options: RunOptions): RunResult {
  const seatZero = options.seatZero ?? 'intermediate';
  const maxMoves = options.maxMoves ?? 5000;
  let winner: PlayerIndex | null = null;

  const step = () => options.onStep?.(r.state, r.captured);

  // Mirrors advanceRef.current in useGameController.
  const advance = (): void => {
    const result = determineTurnResult(r.state);
    switch (result.type) {
      case 'CONTINUE_TURN':
        r.state = { ...r.state, currentPlayer: result.nextPlayer, dumpActive: result.dumpActive ?? r.state.dumpActive };
        return;
      case 'DEAL_NEW_HAND':
        r.state = { ...dealNewHand(r.state), currentPlayer: result.startingPlayer };
        r.tracker = seedInitialDeal(r.tracker, r.state.hands.length * 4);
        r.deals.push(dealRecord(r.state));
        return;
      case 'END_ROUND':
      case 'END_GAME': {
        const boardBefore = r.state.board.slice();
        const { state: afterJackpot, jackpotResult } = applyJackpot(r.state);
        if (jackpotResult) {
          r.tracker = recordCapture(r.tracker, jackpotResult.player, boardBefore);
          r.captured = r.captured.concat(ids(boardBefore));
          r.sweeps.push({ round: r.state.currentRound, player: jackpotResult.player, points: jackpotResult.points });
        }
        r.state =
          result.type === 'END_ROUND'
            ? { ...afterJackpot, gamePhase: 'roundEnd', isOvertime: result.isOvertime }
            : { ...afterJackpot, gamePhase: 'gameOver' };
        if (result.type === 'END_GAME') winner = result.winner;
        step();
        options.onRoundEnd?.(r.state, { moves: r.moves, sweeps: r.sweeps });
        return;
      }
    }
  };

  // Mirrors runBotTurn in useGameController, for any seat.
  const takeTurn = (player: PlayerIndex): void => {
    const difficulty: Difficulty =
      player === 0 ? seatZero : player === 1 ? r.state.settings.bot1Personality : r.state.settings.bot2Personality;
    if (player !== 0) getBotThinkingDelay(difficulty, r.botPrng);
    const decision = decideBotAction(r.state, player, difficulty, r.tracker, r.botPrng);

    // Bot captures go through the same capture check as the player's.
    let combo: Combination | null = null;
    let points = 0;
    if (decision.action === 'capture' && decision.captureDetails) {
      const candidate = botCaptureToCombination(decision.handCard, decision.captureDetails.slots, r.state.board);
      const validation = validateFullCombo(r.state, candidate);
      if (validation.isValid) {
        combo = candidate;
        points = validation.totalPoints;
      }
    }

    if (combo && decision.captureDetails) {
      r.state = executeCapture(r.state, combo);
      r.tracker = recordCapture(r.tracker, player, decision.captureDetails.capturedCards);
      const taken = ids(decision.captureDetails.capturedCards);
      r.captured = r.captured.concat(taken);
      r.moves.push({ round: r.state.currentRound, player, action: 'capture', card: decision.handCard.id, captured: taken, points });
    } else {
      const handBefore = r.state.hands[player];
      r.state = placeCard(r.state, decision.handCard.id);
      for (const c of handBefore) {
        if (!r.state.hands[player].some((h) => h.id === c.id)) r.tracker = recordPlacement(r.tracker, c);
      }
      r.moves.push({ round: r.state.currentRound, player, action: 'place', card: decision.handCard.id, captured: [], points: 0 });
    }
    step();
  };

  const result = (paused: PausedGame | null): RunResult => ({
    deals: r.deals,
    moves: r.moves,
    sweeps: r.sweeps,
    rounds: r.state.currentRound,
    scores: { ...r.state.overallScores },
    winner,
    paused,
  });

  while (winner === null) {
    if (r.moves.length > maxMoves) throw new Error(`playGame: more than ${maxMoves} moves`);
    if (r.state.gamePhase === 'roundEnd') {
      r.state = startNewRound(r.state, r.dealPrng);
      r.captured = [];
      r.deals.push(dealRecord(r.state));
      continue;
    }
    const player = r.state.currentPlayer;
    if (r.state.hands[player].length > 0) takeTurn(player);
    advance();
    if (
      options.stopAfterMoves !== undefined &&
      r.moves.length >= options.stopAfterMoves &&
      r.state.gamePhase === 'playing'
    ) {
      return result({
        state: r.state,
        tracker: r.tracker,
        dealStream: r.dealPrng.getSeed(),
        botStream: r.botPrng.getSeed(),
      });
    }
  }

  return result(null);
}
