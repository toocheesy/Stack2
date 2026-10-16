import type { Card, CaptureRecord, GameState, Scores } from '../engine/types';
import { cardId } from '../engine/utils/cardId';
import { botStreamSeed } from '../engine/utils/prng';

// Saves (S-006): one slot per mode. Classic and The Run each read, write and
// clear only their own key. Schema version 5 (S-008) holds the game, its mode,
// its seed and where each stream stands; the bots' card memory is read from
// the game state and no longer saved. A version-4 save in a slot converts on
// load. An old single-slot save under LEGACY_KEY (schema 3, 2 or the bare-game
// shape) is converted once into the slot its currentLevelId names, then the
// old key is removed.

export type SaveMode = 'classic' | 'run';

const LEGACY_KEY = 'stacked-v2-game';
const SLOT_KEYS: Record<SaveMode, string> = {
  classic: 'stacked-save-classic',
  run: 'stacked-save-run',
};
const SCHEMA_VERSION = 5;
// Version 4 (S-006) carried the bots' card memory as well; dropping it is the whole conversion.
const PREVIOUS_VERSION = 4;

export function saveModeFor(currentLevelId: number | null): SaveMode {
  return currentLevelId === null ? 'classic' : 'run';
}

interface PersistedSnapshot {
  version: number;
  game: GameState;
  // null = Classic match; number = Run level id.
  currentLevelId: number | null;
  // The game seed, and where each stream stands (PRNG.getSeed()).
  seed: number;
  dealStream: number;
  botStream: number;
}

// ─── Public API ─────────────────────────────────────

export interface SavedGame {
  game: GameState;
  currentLevelId: number | null;
  seed: number;
  dealStream: number;
  botStream: number;
}

export function saveGame(mode: SaveMode, save: SavedGame): void {
  try {
    const snapshot: PersistedSnapshot = {
      version: SCHEMA_VERSION,
      game: save.game,
      currentLevelId: save.currentLevelId,
      seed: save.seed,
      dealStream: save.dealStream,
      botStream: save.botStream,
    };
    localStorage.setItem(SLOT_KEYS[mode], JSON.stringify(snapshot));
  } catch {
    // storage full or unavailable
  }
}

// mountSeed: the seed the controller was mounted with. An old save has no seed
// and takes this one on conversion; a version-4 or version-5 save carries its own.
export function loadGame(mode: SaveMode, mountSeed: number): SavedGame | null {
  convertLegacySave(mountSeed);
  try {
    const raw = localStorage.getItem(SLOT_KEYS[mode]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (
      (parsed.version !== SCHEMA_VERSION && parsed.version !== PREVIOUS_VERSION) ||
      !parsed.game ||
      !isValidGameShape(parsed.game) ||
      typeof parsed.seed !== 'number' ||
      typeof parsed.dealStream !== 'number' ||
      typeof parsed.botStream !== 'number'
    ) {
      clearSavedGame(mode);
      return null;
    }
    const save: SavedGame = {
      game: { ...parsed.game, dumpActive: parsed.game.dumpActive ?? false },
      currentLevelId: typeof parsed.currentLevelId === 'number' ? parsed.currentLevelId : null,
      seed: parsed.seed,
      dealStream: parsed.dealStream,
      botStream: parsed.botStream,
    };
    // A version-4 save: its tracker is left behind and the slot is rewritten now.
    if (parsed.version !== SCHEMA_VERSION) saveGame(mode, save);
    return save;
  } catch {
    clearSavedGame(mode);
    return null;
  }
}

function isValidGameShape(data: Partial<GameState>): data is GameState {
  return !!(data.hands && data.board && data.settings);
}

export function clearSavedGame(mode: SaveMode): void {
  try {
    localStorage.removeItem(SLOT_KEYS[mode]);
  } catch {
    // ignore
  }
}

// ─── Conversion of the old single-slot save ─────────

interface OldRoundStats {
  roundScore?: number;
  highestCapture?: CaptureRecord | null;
}

interface OldGameStats {
  highestCapture?: CaptureRecord | null;
}

// What an old save's game may hold: today's fields plus the ones being dropped.
type OldGameState = Omit<GameState, 'roundStats' | 'gameStats'> & {
  scores?: Scores;
  roundStats?: OldRoundStats[];
  gameStats?: OldGameStats[];
};

interface OldSnapshot {
  version?: number;
  game?: OldGameState;
  currentLevelId?: number | null;
}

// Reads the old key once. A convertible save lands in the slot its
// currentLevelId names unless that slot already holds a save; the old key
// goes either way. An unreadable old save is dropped, as it was before.
function convertLegacySave(mountSeed: number): void {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const converted = convertOldSave(JSON.parse(raw), mountSeed);
    if (converted) {
      const mode = saveModeFor(converted.currentLevelId);
      if (!localStorage.getItem(SLOT_KEYS[mode])) saveGame(mode, converted);
    }
  } catch {
    // unreadable: dropped, as today
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

function emptyScores(): Scores {
  return { player: 0, bot1: 0, bot2: 0 };
}

function convertOldSave(parsed: unknown, mountSeed: number): SavedGame | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const wrapped = 'game' in parsed && !!(parsed as OldSnapshot).game;
  const snapshot: OldSnapshot = wrapped ? (parsed as OldSnapshot) : { game: parsed as OldGameState };
  const old = snapshot.game!;
  if (!isValidGameShape(old as Partial<GameState>)) return null;

  // Every card takes its ID from its own rank and suit. The old save's
  // tracker, if it had one, is left behind: the memory is read from the game.
  const renew = (card: Card): Card => {
    if (!card || typeof card !== 'object' || !card.rank || !card.suit) {
      throw new Error('card without rank and suit');
    }
    return { ...card, id: cardId(card.rank, card.suit) };
  };
  const renewAll = (cards: Card[] | undefined): Card[] => (cards ?? []).map(renew);
  const renewRecord = (record: CaptureRecord | null | undefined): CaptureRecord | null =>
    record ? { ...record, cards: renewAll(record.cards), baseCard: renew(record.baseCard) } : null;
  const renewGroups = (groups: GameState['combination']['combo1'] | undefined) =>
    (groups ?? []).map((g) => ({ ...g, card: renew(g.card) }));

  const combination = old.combination ?? { base: null, combo1: [], combo2: [], combo3: [] };
  const roundStats = [0, 1, 2].map((i) => ({
    pointsThisRound: old.roundStats?.[i]?.roundScore ?? 0,
    highestCapture: renewRecord(old.roundStats?.[i]?.highestCapture),
  })) as GameState['roundStats'];
  const gameStats = [0, 1, 2].map((i) => ({
    highestCapture: renewRecord(old.gameStats?.[i]?.highestCapture),
  })) as GameState['gameStats'];

  const game: GameState = {
    deck: renewAll(old.deck),
    board: renewAll(old.board),
    hands: [renewAll(old.hands[0]), renewAll(old.hands[1]), renewAll(old.hands[2])],
    overallScores: old.overallScores ?? old.scores ?? emptyScores(),
    combination: {
      base: combination.base ? renew(combination.base) : null,
      combo1: renewGroups(combination.combo1),
      combo2: renewGroups(combination.combo2),
      combo3: renewGroups(combination.combo3),
    },
    currentPlayer: old.currentPlayer,
    lastAction: old.lastAction ?? null,
    lastCapturer: old.lastCapturer ?? null,
    settings: old.settings,
    currentRound: old.currentRound,
    currentDealer: old.currentDealer,
    handNumber: old.handNumber,
    gamePhase: old.gamePhase,
    roundStats,
    gameStats,
    dumpActive: old.dumpActive ?? false,
    isOvertime: old.isOvertime ?? false,
  };

  const currentLevelId = typeof snapshot.currentLevelId === 'number' ? snapshot.currentLevelId : null;
  // An old save has no seed: it takes the mount seed, and both streams start fresh from it.
  return {
    game,
    currentLevelId,
    seed: mountSeed,
    dealStream: mountSeed >>> 0,
    botStream: botStreamSeed(mountSeed),
  };
}
