import type {
  Card,
  GameSettings,
  GameState,
  JackpotResult,
  PlayerIndex,
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
    settings,
    currentRound: 1,
    currentDealer,
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
  return { ...state, deck, hands };
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
  return {
    ...state,
    scores: { ...state.scores, [key]: state.scores[key] + points },
    overallScores: {
      ...state.overallScores,
      [key]: state.overallScores[key] + points,
    },
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

  const scored = addScore(state, state.currentPlayer, validatedCapture.totalPoints);

  return {
    ...scored,
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
  const scored = addScore(state, player, points);
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
  };
}
