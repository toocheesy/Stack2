import type { Card, CaptureRecord, GameState, Rank, Scores } from '../engine/types';
import type { CardTrackerState, CardLocation, GamePhase } from '../engine/ai/cardTracker';
import { createGameTracker } from '../engine/ai/cardTracker';
import { cardId } from '../engine/utils/cardId';
import { botStreamSeed } from '../engine/utils/prng';

// Saves (S-006): schema version 4, one slot per mode. Classic and The Run each
// read, write and clear only their own key. An old single-slot save under
// LEGACY_KEY (schema 3, 2 or the bare-game shape) is converted once into the
// slot its currentLevelId names, then the old key is removed.

export type SaveMode = 'classic' | 'run';

const LEGACY_KEY = 'stacked-v2-game';
const SLOT_KEYS: Record<SaveMode, string> = {
  classic: 'stacked-save-classic',
  run: 'stacked-save-run',
};
const SCHEMA_VERSION = 4;

export function saveModeFor(currentLevelId: number | null): SaveMode {
  return currentLevelId === null ? 'classic' : 'run';
}

// ─── Wire format ────────────────────────────────────
//
// CardTrackerState contains a Map<string, CardLocation> for seenCards.
// JSON.stringify produces `{}` for Maps, so we convert to an array of
// entries at the persistence boundary. The internal tracker API
// (cardTracker.ts) keeps working with a real Map.

interface PersistedTracker {
  seenCardsEntries: Array<[string, CardLocation]>;
  valueCounts: Record<Rank, number>;
  playerCaptures: [Card[], Card[], Card[]];
  deckRemaining: number;
  totalSeen: number;
  gamePhase: GamePhase;
}

interface PersistedSnapshot {
  version: number;
  game: GameState;
  tracker: PersistedTracker;
  // null = Classic match; number = Run level id.
  currentLevelId: number | null;
  // The game seed, and where each stream stands (PRNG.getSeed()).
  seed: number;
  dealStream: number;
  botStream: number;
}

function toWire(tracker: CardTrackerState): PersistedTracker {
  return {
    seenCardsEntries: Array.from(tracker.seenCards.entries()),
    valueCounts: tracker.valueCounts,
    playerCaptures: tracker.playerCaptures,
    deckRemaining: tracker.deckRemaining,
    totalSeen: tracker.totalSeen,
    gamePhase: tracker.gamePhase,
  };
}

function fromWire(wire: PersistedTracker): CardTrackerState {
  return {
    seenCards: new Map(wire.seenCardsEntries),
    valueCounts: wire.valueCounts,
    playerCaptures: wire.playerCaptures,
    deckRemaining: wire.deckRemaining,
    totalSeen: wire.totalSeen,
    gamePhase: wire.gamePhase,
  };
}

// ─── Public API ─────────────────────────────────────

export interface SavedGame {
  game: GameState;
  tracker: CardTrackerState;
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
      tracker: toWire(save.tracker),
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
// and takes this one on conversion; a version-4 save carries its own.
export function loadGame(mode: SaveMode, mountSeed: number): SavedGame | null {
  convertLegacySave(mountSeed);
  try {
    const raw = localStorage.getItem(SLOT_KEYS[mode]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (
      parsed.version !== SCHEMA_VERSION ||
      !parsed.game ||
      !isValidGameShape(parsed.game) ||
      !parsed.tracker ||
      typeof parsed.seed !== 'number' ||
      typeof parsed.dealStream !== 'number' ||
      typeof parsed.botStream !== 'number'
    ) {
      clearSavedGame(mode);
      return null;
    }
    return {
      game: { ...parsed.game, dumpActive: parsed.game.dumpActive ?? false },
      tracker: fromWire(parsed.tracker),
      currentLevelId: typeof parsed.currentLevelId === 'number' ? parsed.currentLevelId : null,
      seed: parsed.seed,
      dealStream: parsed.dealStream,
      botStream: parsed.botStream,
    };
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
  tracker?: PersistedTracker;
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

  // Every card takes its ID from its own rank and suit. Old IDs are mapped to
  // new ones so the tracker's seen-cards map can be re-keyed; an old ID that
  // belonged to more than one card (the duplicate-ID bug) is dropped from it.
  const newIdsByOld = new Map<string, Set<string>>();
  const renew = (card: Card): Card => {
    if (!card || typeof card !== 'object' || !card.rank || !card.suit) {
      throw new Error('card without rank and suit');
    }
    const id = cardId(card.rank, card.suit);
    const seen = newIdsByOld.get(card.id) ?? new Set<string>();
    seen.add(id);
    newIdsByOld.set(card.id, seen);
    return { ...card, id };
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

  let tracker: CardTrackerState;
  if (snapshot.tracker) {
    const wire = snapshot.tracker;
    const playerCaptures = [
      renewAll(wire.playerCaptures?.[0]),
      renewAll(wire.playerCaptures?.[1]),
      renewAll(wire.playerCaptures?.[2]),
    ] as CardTrackerState['playerCaptures'];
    const seenCards = new Map<string, CardLocation>();
    for (const [oldId, location] of wire.seenCardsEntries ?? []) {
      const ids = newIdsByOld.get(oldId);
      if (ids && ids.size === 1) seenCards.set(Array.from(ids)[0], location);
    }
    tracker = {
      seenCards,
      valueCounts: wire.valueCounts,
      playerCaptures,
      deckRemaining: wire.deckRemaining,
      totalSeen: wire.totalSeen,
      gamePhase: wire.gamePhase,
    };
  } else {
    // The bare-game shape had no tracker: rebuild one from the board, as before.
    tracker = createGameTracker(game.board);
  }

  const currentLevelId = typeof snapshot.currentLevelId === 'number' ? snapshot.currentLevelId : null;
  // An old save has no seed: it takes the mount seed, and both streams start fresh from it.
  return {
    game,
    tracker,
    currentLevelId,
    seed: mountSeed,
    dealStream: mountSeed >>> 0,
    botStream: botStreamSeed(mountSeed),
  };
}
