import { describe, expect, it, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSavedGame } from '../../src/game/persistence';
import type { GameState } from '../../src/engine/types';
import {
  createGameTracker,
  recordCapture,
  recordPlacement,
  type CardTrackerState,
} from '../../src/engine/ai/cardTracker';

// ─── localStorage mock for Node test environment ────
const store = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (_i: number) => null as string | null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

const STORAGE_KEY = 'stacked-v2-game';

function fullState(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: [],
    board: [{ id: 'b1', rank: '2', suit: 'hearts', value: 2 }],
    hands: [[], [], []],
    scores: { player: 0, bot1: 0, bot2: 0 },
    overallScores: { player: 0, bot1: 0, bot2: 0 },
    combination: { base: null, combo1: [], combo2: [], combo3: [] },
    currentPlayer: 0,
    lastAction: null,
    lastCapturer: null,
    settings: {
      targetScore: 100,
      bot1Personality: 'beginner',
      bot2Personality: 'beginner',
    },
    currentRound: 1,
    currentDealer: 0,
    handNumber: 1,
    gamePhase: 'playing',
    roundStats: [
      { roundScore: 0, highestCapture: null },
      { roundScore: 0, highestCapture: null },
      { roundScore: 0, highestCapture: null },
    ],
    gameStats: [
      { totalScore: 0, highestCapture: null },
      { totalScore: 0, highestCapture: null },
      { totalScore: 0, highestCapture: null },
    ],
    dumpActive: false,
    ...overrides,
  };
}

function freshTracker(state: GameState = fullState()): CardTrackerState {
  return createGameTracker(state.board);
}

describe('persistence — saveGame / loadGame', () => {
  beforeEach(() => { store.clear(); });

  it('returns null when nothing saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('saveGame + loadGame round-trip preserves game state including dumpActive', () => {
    const s = fullState({ dumpActive: true });
    saveGame(s, freshTracker(s));
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.game.dumpActive).toBe(true);
  });

  it('clearSavedGame wipes the slot', () => {
    saveGame(fullState(), freshTracker());
    clearSavedGame();
    expect(loadGame()).toBeNull();
  });

  // ─── Sibling 1 — tracker persistence ─────────────────

  it('round-trips tracker counters (totalSeen, deckRemaining, gamePhase)', () => {
    const s = fullState();
    const tracker = freshTracker(s);
    saveGame(s, tracker);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.tracker.totalSeen).toBe(tracker.totalSeen);
    expect(loaded!.tracker.deckRemaining).toBe(tracker.deckRemaining);
    expect(loaded!.tracker.gamePhase).toBe(tracker.gamePhase);
  });

  it('round-trips seenCards entries (Map survives JSON boundary)', () => {
    const s = fullState();
    let tracker = createGameTracker(s.board);
    const extra = { id: 'placed-1', rank: '7' as const, suit: 'clubs' as const, value: 7 };
    tracker = recordPlacement(tracker, extra);
    saveGame(s, tracker);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.tracker.seenCards.has(extra.id)).toBe(true);
    expect(loaded!.tracker.seenCards.get(extra.id)).toBe('board');
    expect(loaded!.tracker.seenCards.size).toBe(tracker.seenCards.size);
  });

  it('round-trips valueCounts and playerCaptures after a recordCapture', () => {
    const s = fullState();
    let tracker = createGameTracker(s.board);
    const captured = [
      { id: 'c1', rank: '5' as const, suit: 'hearts' as const, value: 5 },
      { id: 'c2', rank: '5' as const, suit: 'clubs' as const, value: 5 },
    ];
    tracker = recordCapture(tracker, 1, captured);
    saveGame(s, tracker);
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.tracker.valueCounts['5']).toBe(tracker.valueCounts['5']);
    expect(loaded!.tracker.playerCaptures[1].length).toBe(2);
    expect(loaded!.tracker.playerCaptures[1].map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  // ─── Backward compat for legacy saves ────────────────

  it('legacy save (bare GameState, no version/tracker) is loadable with a fresh rebuilt tracker', () => {
    // Pre-Sibling-1 wire format: just the GameState as the JSON root.
    const legacy = fullState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const origWarn = console.warn;
    let warned = false;
    console.warn = () => { warned = true; };
    const loaded = loadGame();
    console.warn = origWarn;
    expect(loaded).not.toBeNull();
    expect(warned).toBe(true);
    // Tracker should be a fresh createGameTracker(legacy.board): totalSeen=13
    // (1 board card + 12 hand-deal seed).
    expect(loaded!.tracker.totalSeen).toBe(1 + 12);
    expect(loaded!.tracker.seenCards.has('b1')).toBe(true);
  });

  it('legacy save defaults dumpActive to false on the game side', () => {
    const legacy = fullState();
    const { dumpActive: _drop, ...rest } = legacy;
    void _drop;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    const origWarn = console.warn;
    console.warn = () => {};
    const loaded = loadGame();
    console.warn = origWarn;
    expect(loaded).not.toBeNull();
    expect(loaded!.game.dumpActive).toBe(false);
  });

  it('rejects malformed legacy save shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'a game' }));
    expect(loadGame()).toBeNull();
  });

  it('rejects corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadGame()).toBeNull();
  });
});
