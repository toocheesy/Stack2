import type {
  Card,
  CaptureRecord,
  GamePlayerStats,
  GameSettings,
  GameState,
  JackpotResult,
  PlayerIndex,
  RoundStats,
  Scores,
  ValidatedCapture,
} from '../types';
import { PLAYER_NAMES, SCORE_KEYS } from '../types';
import type { PRNG } from '../utils/prng';
import type { IdGenerator } from '../utils/uuid';
import { createDeck, shuffleDeck } from '../utils/deck';
import { calculateCardsPoints } from './scoring';

const HAND_SIZE = 4;
const BOARD_SIZE = 4;

function emptyScores(): Scores {
  return { player: 0, bot1: 0, bot2: 0 };
}

function emptyCombination(): GameState['combination'] {
  return { base: null, combo1: [], combo2: [], combo3: [] };
}

function emptyRoundStats(): RoundStats {
  return { roundScore: 0, highestCapture: null };
}

function emptyGameStats(): GamePlayerStats {
  return { totalScore: 0, highestCapture: null };
}

function maybeUpdateHighest(
  state: GameState,
  playerIndex: PlayerIndex,
  capture: CaptureRecord,
): GameState {
  const roundStats = [...state.roundStats] as [RoundStats, RoundStats, RoundStats];
  const gameStats = [...state.gameStats] as [GamePlayerStats, GamePlayerStats, GamePlayerStats];

  if (!roundStats[playerIndex].highestCapture || capture.points > roundStats[playerIndex].highestCapture.points) {
    roundStats[playerIndex] = { ...roundStats[playerIndex], highestCapture: capture };
  }
  if (!gameStats[playerIndex].highestCapture || capture.points > gameStats[playerIndex].highestCapture.points) {
    gameStats[playerIndex] = { ...gameStats[playerIndex], highestCapture: capture };
  }

  return { ...state, roundStats, gameStats };
}

function deal(deck: Card[], count: number): { taken: Card[]; remaining: Card[] } {
  return {
    taken: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

export function createInitialState(
  settings: GameSettings,
  prng: PRNG,
  idGenerator: IdGenerator,
): GameState {
  // Randomize bot seating: 50/50 coin flip swaps bot1 ↔ bot2
  const swapBots = prng.next() < 0.5;
  const finalSettings = swapBots
    ? { ...settings, bot1Personality: settings.bot2Personality, bot2Personality: settings.bot1Personality }
    : settings;

  const shuffled = shuffleDeck(createDeck(idGenerator), prng);
  let deck = shuffled;

  const hands: [Card[], Card[], Card[]] = [[], [], []];
  for (let p = 0; p < 3; p++) {
    const { taken, remaining } = deal(deck, HAND_SIZE);
    hands[p] = taken;
    deck = remaining;
  }
  const { taken: board, remaining: afterBoard } = deal(deck, BOARD_SIZE);
  deck = afterBoard;

  const currentDealer = prng.nextInt(0, 2) as PlayerIndex;
  const currentPlayer = ((currentDealer + 1) % 3) as PlayerIndex;

  return {
    deck,
    board,
    hands,
    scores: emptyScores(),
    overallScores: emptyScores(),
    combination: emptyCombination(),
    currentPlayer,
    lastAction: null,
    lastCapturer: null,
    settings: finalSettings,
    currentRound: 1,
    currentDealer,
    handNumber: 1,
    gamePhase: 'playing',
    roundStats: [emptyRoundStats(), emptyRoundStats(), emptyRoundStats()],
    gameStats: [emptyGameStats(), emptyGameStats(), emptyGameStats()],
  };
}

export function dealNewHand(state: GameState): GameState {
  let deck = state.deck.slice();
  const hands: [Card[], Card[], Card[]] = [
    state.hands[0].slice(),
    state.hands[1].slice(),
    state.hands[2].slice(),
  ];
  for (let p = 0; p < 3; p++) {
    const { taken, remaining } = deal(deck, HAND_SIZE);
    hands[p] = hands[p].concat(taken);
    deck = remaining;
  }
  return { ...state, deck, hands, handNumber: state.handNumber + 1 };
}

export function nextPlayer(state: GameState): GameState {
  return {
    ...state,
    currentPlayer: ((state.currentPlayer + 1) % 3) as PlayerIndex,
  };
}

export function addScore(
  state: GameState,
  playerIndex: PlayerIndex,
  points: number,
): GameState {
  const key = SCORE_KEYS[playerIndex];
  const roundStats = [...state.roundStats] as [RoundStats, RoundStats, RoundStats];
  roundStats[playerIndex] = {
    ...roundStats[playerIndex],
    roundScore: roundStats[playerIndex].roundScore + points,
  };
  const gameStats = [...state.gameStats] as [GamePlayerStats, GamePlayerStats, GamePlayerStats];
  gameStats[playerIndex] = {
    ...gameStats[playerIndex],
    totalScore: gameStats[playerIndex].totalScore + points,
  };
  return {
    ...state,
    scores: { ...state.scores, [key]: state.scores[key] + points },
    overallScores: {
      ...state.overallScores,
      [key]: state.overallScores[key] + points,
    },
    roundStats,
    gameStats,
  };
}

export function resetCombination(state: GameState): GameState {
  return { ...state, combination: emptyCombination() };
}

function removeCardsById(cards: readonly Card[], ids: Set<string>): Card[] {
  return cards.filter((c) => !ids.has(c.id));
}

export function executeCapture(
  state: GameState,
  validatedCapture: ValidatedCapture,
): GameState {
  const ids = new Set(validatedCapture.allCapturedCards.map((c) => c.id));
  const hands: [Card[], Card[], Card[]] = [
    state.hands[0],
    state.hands[1],
    state.hands[2],
  ];
  hands[state.currentPlayer] = removeCardsById(hands[state.currentPlayer], ids);
  const board = removeCardsById(state.board, ids);

  let result = addScore(state, state.currentPlayer, validatedCapture.totalPoints);

  const baseCard = state.combination.base ?? validatedCapture.allCapturedCards[0];
  if (baseCard) {
    result = maybeUpdateHighest(result, state.currentPlayer, {
      points: validatedCapture.totalPoints,
      cards: validatedCapture.allCapturedCards,
      baseCard,
    });
  }

  return {
    ...result,
    hands,
    board,
    lastAction: 'capture',
    lastCapturer: state.currentPlayer,
    combination: emptyCombination(),
  };
}

export function placeCard(state: GameState, cardId: string): GameState {
  const hand = state.hands[state.currentPlayer];
  const card = hand.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`placeCard: card ${cardId} not in current player's hand`);
  }
  const hands: [Card[], Card[], Card[]] = [
    state.hands[0],
    state.hands[1],
    state.hands[2],
  ];
  hands[state.currentPlayer] = hand.filter((c) => c.id !== cardId);
  const board = state.board.concat(card);
  return {
    ...state,
    hands,
    board,
    lastAction: 'place',
    combination: emptyCombination(),
  };
}

export function applyJackpot(state: GameState): {
  state: GameState;
  jackpotResult: JackpotResult | null;
} {
  if (state.lastCapturer === null || state.board.length === 0) {
    return { state, jackpotResult: null };
  }
  const player = state.lastCapturer;
  const points = calculateCardsPoints(state.board);
  const cardCount = state.board.length;
  const message = `${PLAYER_NAMES[player]} sweeps ${cardCount} board cards for ${points} points`;
  let scored = addScore(state, player, points);
  scored = maybeUpdateHighest(scored, player, {
    points,
    cards: state.board.slice(),
    baseCard: state.board[0],
  });
  return {
    state: { ...scored, board: [] },
    jackpotResult: { player, points, cardCount, message },
  };
}

export function startNewRound(
  state: GameState,
  prng: PRNG,
  idGenerator: IdGenerator,
): GameState {
  const shuffled = shuffleDeck(createDeck(idGenerator), prng);
  let deck = shuffled;
  const hands: [Card[], Card[], Card[]] = [[], [], []];
  for (let p = 0; p < 3; p++) {
    const { taken, remaining } = deal(deck, HAND_SIZE);
    hands[p] = taken;
    deck = remaining;
  }
  const { taken: board, remaining } = deal(deck, BOARD_SIZE);
  deck = remaining;

  const newDealer = ((state.currentDealer + 1) % 3) as PlayerIndex;
  const currentPlayer = ((newDealer + 1) % 3) as PlayerIndex;

  return {
    ...state,
    deck,
    board,
    hands,
    scores: emptyScores(),
    combination: emptyCombination(),
    currentPlayer,
    lastAction: null,
    lastCapturer: null,
    currentRound: state.currentRound + 1,
    currentDealer: newDealer,
    handNumber: 1,
    gamePhase: 'playing' as const,
    roundStats: [emptyRoundStats(), emptyRoundStats(), emptyRoundStats()],
  };
}
