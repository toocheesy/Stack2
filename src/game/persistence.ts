import type { GameState } from '../engine/types';
import type { CardTrackerState, CardLocation, GamePhase } from '../engine/ai/cardTracker';
import { createGameTracker } from '../engine/ai/cardTracker';
import type { Rank, Card } from '../engine/types';

const STORAGE_KEY = 'stacked-v2-game';
const SCHEMA_VERSION = 2;

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

export interface LoadedSave {
  game: GameState;
  tracker: CardTrackerState;
}

export function saveGame(state: GameState, tracker: CardTrackerState): void {
  try {
    const snapshot: PersistedSnapshot = {
      version: SCHEMA_VERSION,
      game: state,
      tracker: toWire(tracker),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // storage full or unavailable
  }
}

export function loadGame(): LoadedSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot> & Partial<GameState>;

    // Schema v2+: wrapped shape with version, game, tracker.
    if (parsed && typeof parsed === 'object' && 'game' in parsed && parsed.game) {
      const game = parsed.game as GameState;
      if (!isValidGameShape(game)) return null;
      const tracker = parsed.tracker
        ? fromWire(parsed.tracker as PersistedTracker)
        : createGameTracker(game.board);
      // Same dumpActive default as before for pre-B1-fix saves at the GameState layer.
      const gameWithDefaults: GameState = { ...game, dumpActive: game.dumpActive ?? false };
      return { game: gameWithDefaults, tracker };
    }

    // Legacy schema (pre-Sibling-1): bare GameState JSON. Rebuild a
    // fresh tracker from the board (loses pre-save tracker history but
    // unblocks resume). Console.warn for visibility during playtest.
    const legacyGame = parsed as GameState;
    if (!isValidGameShape(legacyGame)) return null;
    console.warn(
      '[persistence] Legacy save detected (no tracker field). Rebuilding tracker from board; pre-save card history is lost.',
    );
    const gameWithDefaults: GameState = { ...legacyGame, dumpActive: legacyGame.dumpActive ?? false };
    return {
      game: gameWithDefaults,
      tracker: createGameTracker(gameWithDefaults.board),
    };
  } catch {
    clearSavedGame();
    return null;
  }
}

function isValidGameShape(data: Partial<GameState>): data is GameState {
  return !!(data.hands && data.board && data.scores && data.settings);
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
