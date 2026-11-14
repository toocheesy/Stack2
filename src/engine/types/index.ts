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

export type GamePhase = 'playing' | 'roundEnd' | 'gameOver';

export interface CaptureRecord {
  points: number;
  // Every captured card, base first.
  cards: Card[];
  baseCard: Card;
  // Each filled combo's cards in slot order (combo1, combo2, combo3), the
  // base not included (D-007 ruling 96).
  combos: Card[][];
}

export interface RoundStats {
  // A per-round extra for the round-end screen only (S-006). Nothing else reads it.
  pointsThisRound: number;
  highestCapture: CaptureRecord | null;
  // RULES.md Law 10: true for the one player who took the table this round
  // (D-007 ruling 97). A take is not a capture for highestCapture.
  tookTheTable: boolean;
}

export interface GamePlayerStats {
  highestCapture: CaptureRecord | null;
}

export type ComboSlot = 'base' | 'combo1' | 'combo2' | 'combo3';

export type CardSource = 'hand' | 'board';

export interface CaptureGroup {
  card: Card;
  source: CardSource;
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
}

export interface GameState {
  deck: Card[];
  board: Card[];
  hands: [Card[], Card[], Card[]];
  // The one score per player through all rounds, reset only when a game ends (S-006).
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
  // RULES.md Law 11 — true during gamePhase === 'roundEnd' when the round-end
  // was triggered by tied leaders at/above target (overtime continuation).
  isOvertime: boolean;
}

export type CaptureType = 'pair' | 'sum';

export interface SlotValidation {
  isValid: boolean;
  details: string;
}

export interface ComboValidation {
  isValid: boolean;
  allCapturedCards: Card[];
  totalPoints: number;
  errors: string[];
}

export interface JackpotResult {
  player: PlayerIndex;
  points: number;
  cardCount: number;
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
  slots: MultiSlotCaptureSlot[];
  totalPoints: number;
}

export type TurnResult =
  | { type: 'CONTINUE_TURN'; nextPlayer: PlayerIndex }
  | { type: 'DEAL_NEW_HAND'; startingPlayer: PlayerIndex }
  | {
      type: 'END_ROUND';
      isOvertime: boolean; // RULES.md Law 11 — true when round-end was a tie at/above target
    }
  | {
      type: 'END_GAME';
      winner: PlayerIndex;
    };

export const SCORE_KEYS: Record<PlayerIndex, keyof Scores> = {
  0: 'player',
  1: 'bot1',
  2: 'bot2',
};

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
