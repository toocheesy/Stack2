import type { GameState } from '../engine/types';

// Saves (S-006): Classic's slot. Version 7 (S-032) holds the game, its seed
// and where each stream stands. A save at any other version is removed on
// load, not converted: S-032 deleted every older save, once. Every later
// change to what a save holds bumps the version and converts older saves.

export type SaveMode = 'classic';

const SLOT_KEYS: Record<SaveMode, string> = {
  classic: 'stacked-save-classic',
};
const SCHEMA_VERSION = 7;

interface PersistedSnapshot {
  version: number;
  game: GameState;
  // The game seed, and where each stream stands (PRNG.getSeed()).
  seed: number;
  dealStream: number;
  botStream: number;
}

// ─── Public API ─────────────────────────────────────

export interface SavedGame {
  game: GameState;
  seed: number;
  dealStream: number;
  botStream: number;
}

export function saveGame(mode: SaveMode, save: SavedGame): void {
  try {
    const snapshot: PersistedSnapshot = {
      version: SCHEMA_VERSION,
      game: save.game,
      seed: save.seed,
      dealStream: save.dealStream,
      botStream: save.botStream,
    };
    localStorage.setItem(SLOT_KEYS[mode], JSON.stringify(snapshot));
  } catch {
    // storage full or unavailable
  }
}

export function loadGame(mode: SaveMode): SavedGame | null {
  try {
    const raw = localStorage.getItem(SLOT_KEYS[mode]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (
      parsed.version !== SCHEMA_VERSION ||
      !parsed.game ||
      !isValidGameShape(parsed.game) ||
      typeof parsed.seed !== 'number' ||
      typeof parsed.dealStream !== 'number' ||
      typeof parsed.botStream !== 'number'
    ) {
      clearSavedGame(mode);
      return null;
    }
    return { game: parsed.game, seed: parsed.seed, dealStream: parsed.dealStream, botStream: parsed.botStream };
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
