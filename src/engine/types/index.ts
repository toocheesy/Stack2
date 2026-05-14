export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export type PlayerType = 'human' | 'bot';

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  hand: Card[];
  captured: Card[];
  score: number;
}

export type GamePhase = 'playing' | 'jackpot' | 'roundEnd' | 'gameOver';

export interface CaptureRecord {
  points: number;
  cards: Card[];
  baseCard: Card;
}

export interface RoundStats {
  roundScore: number;
  highestCapture: CaptureRecord | null;
}

export interface GamePlayerStats {
  totalScore: number;
  highestCapture: CaptureRecord | null;
}

export type TurnAction = 'CAPTURE' | 'PLACE';

export type ComboSlot = 'base' | 'combo1' | 'combo2' | 'combo3';

export interface CaptureAttempt {
  base: Card;
  combo1?: Card[];
  combo2?: Card[];
  combo3?: Card[];
}

export type CardSource = 'hand' | 'board';

export interface CaptureGroup {
  card: Card;
  source: CardSource;
  originalIndex: number;
}

export interface Combination {
  base: Card | null;
  combo1: CaptureGroup[];
  combo2: CaptureGroup[];
  combo3: CaptureGroup[];
}

export type PlayerIndex = 0 | 1 | 2;

export interface Scores {
  player: number;
  bot1: number;
  bot2: number;
}

export interface GameSettings {
  targetScore: number;
  bot1Personality: Difficulty;
  bot2Personality: Difficulty;
  hintStripEnabled?: boolean;
  disableSeatingSwap?: boolean;
}

export interface GameState {
  deck: Card[];
  board: Card[];
  hands: [Card[], Card[], Card[]];
  scores: Scores;
  overallScores: Scores;
  combination: Combination;
  currentPlayer: PlayerIndex;
  lastAction: 'capture' | 'place' | null;
  lastCapturer: PlayerIndex | null;
  settings: GameSettings;
  currentRound: number;
  currentDealer: PlayerIndex;
  handNumber: number;
  gamePhase: GamePhase;
  roundStats: [RoundStats, RoundStats, RoundStats];
  gameStats: [GamePlayerStats, GamePlayerStats, GamePlayerStats];
  // Doctrine 2.7 — Forced-Placement Dump: true when only one player has
  // cards left and they have just placed. Captures are locked out until
  // a new hand is dealt or a new round starts.
  dumpActive: boolean;
}

export type CaptureType = 'pair' | 'sum';

export interface SlotValidation {
  isValid: boolean;
  captureType: CaptureType | null;
  details: string;
}

export interface ComboValidation {
  isValid: boolean;
  validSlots: SlotValidation[];
  allCapturedCards: Card[];
  totalPoints: number;
  errors: string[];
}

export interface ValidatedCapture {
  allCapturedCards: Card[];
  totalPoints: number;
}

export interface JackpotResult {
  player: PlayerIndex;
  points: number;
  cardCount: number;
  message: string;
}

export interface CaptureOption {
  type: CaptureType;
  boardCards: Card[];
  points: number;
}

export interface MultiSlotCaptureSlot {
  slot: Exclude<ComboSlot, 'base'>;
  cards: Card[];
  type: CaptureType;
}

export interface MultiSlotCapture {
  handCard: Card;
  slots: MultiSlotCaptureSlot[];
  totalPoints: number;
}

export type TurnResult =
  | { type: 'CONTINUE_TURN'; nextPlayer: PlayerIndex; dumpActive?: boolean }
  | { type: 'DEAL_NEW_HAND'; startingPlayer: PlayerIndex }
  | {
      type: 'END_ROUND';
      scores: Scores;
      jackpotResult: JackpotResult | null;
      newDealer: PlayerIndex;
    }
  | {
      type: 'END_GAME';
      scores: Scores;
      jackpotResult: JackpotResult | null;
      winner: PlayerIndex;
      winnerName: string;
    };

export const PLAYER_NAMES: Record<PlayerIndex, string> = {
  0: 'Player',
  1: 'Bot 1',
  2: 'Bot 2',
};

export const SCORE_KEYS: Record<PlayerIndex, keyof Scores> = {
  0: 'player',
  1: 'bot1',
  2: 'bot2',
};

export interface GameAction {
  type: string;
  playerId?: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const RANK_VALUES: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 0,
  Q: 0,
  K: 0,
};

export const SCORE_VALUES: Record<Rank, number> = {
  A: 15,
  '2': 5,
  '3': 5,
  '4': 5,
  '5': 5,
  '6': 5,
  '7': 5,
  '8': 5,
  '9': 5,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
};

export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
