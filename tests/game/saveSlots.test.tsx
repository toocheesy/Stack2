// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameController } from '../../src/game/useGameController';
import { loadGame, saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings } from '../../src/engine/types';

// S-006: two save slots. A Classic save and a Run save live side by side,
// each mode touches only its own, and a resumed game carries its own seed.

// Seed 1 deals the player first with these settings (see tutorialFreeze.test.tsx).
const SEED_PLAYER_FIRST = 1;
const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
const runSettings: GameSettings = {
  targetScore: 200,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
  hintStripEnabled: true,
  disableSeatingSwap: true,
};
const RUN_LEVEL = 3;
const RUN_SEED = 5;

function runSave() {
  const game = createInitialState(runSettings, createPRNG(RUN_SEED));
  return {
    game,
    currentLevelId: RUN_LEVEL,
    seed: RUN_SEED,
    dealStream: createPRNG(RUN_SEED).getSeed(),
    botStream: botStreamSeed(RUN_SEED),
  };
}

function mount(seed: number, settings: GameSettings, currentLevelId: number | null) {
  // The tutorial flag keeps the bots from moving, so the state stays put.
  return renderHook(() => useGameController(seed, settings, currentLevelId, true));
}

describe('two save slots (S-006)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a new Classic game writes the Classic slot and leaves the Run save intact', () => {
    saveGame('run', runSave());
    const runRaw = localStorage.getItem('stacked-save-run');
    expect(runRaw).not.toBeNull();

    const { result, unmount } = mount(SEED_PLAYER_FIRST, classicSettings, null);
    expect(result.current.wasResumed).toBe(false);
    expect(result.current.state.currentPlayer).toBe(0);
    act(() => {
      result.current.actions.placeCard(result.current.state.hands[0][0].id);
    });

    const classic = loadGame('classic', 0)!;
    expect(classic).not.toBeNull();
    expect(classic.seed).toBe(SEED_PLAYER_FIRST);
    expect(classic.currentLevelId).toBeNull();
    expect(localStorage.getItem('stacked-save-run')).toBe(runRaw);
    expect(loadGame('run', 0)!.currentLevelId).toBe(RUN_LEVEL);
    unmount();
  });

  it('mounting the Run resumes the Run slot and leaves the Classic slot alone', () => {
    const classicGame = createInitialState(classicSettings, createPRNG(SEED_PLAYER_FIRST));
    saveGame('classic', {
      game: classicGame,
      currentLevelId: null,
      seed: SEED_PLAYER_FIRST,
      dealStream: SEED_PLAYER_FIRST,
      botStream: botStreamSeed(SEED_PLAYER_FIRST),
    });
    const classicRaw = localStorage.getItem('stacked-save-classic');
    const save = runSave();
    saveGame('run', save);

    const { result, unmount } = mount(777, runSettings, RUN_LEVEL);
    expect(result.current.wasResumed).toBe(true);
    expect(result.current.state.board.map((c) => c.id)).toEqual(save.game.board.map((c) => c.id));
    expect(localStorage.getItem('stacked-save-classic')).toBe(classicRaw);
    unmount();
  });

  it('a resumed Classic game keeps its own seed and streams, not the mount seed', () => {
    const game = createInitialState(classicSettings, createPRNG(SEED_PLAYER_FIRST));
    const dealStream = 0xabcdef;
    saveGame('classic', {
      game,
      currentLevelId: null,
      seed: SEED_PLAYER_FIRST,
      dealStream,
      botStream: 0x123456,
    });

    const { result, unmount } = mount(424242, classicSettings, null);
    expect(result.current.wasResumed).toBe(true);
    expect(result.current.state.currentPlayer).toBe(0);
    act(() => {
      result.current.actions.placeCard(result.current.state.hands[0][0].id);
    });

    const after = loadGame('classic', 0)!;
    expect(after.seed).toBe(SEED_PLAYER_FIRST);
    // No deal happened, so the deal stream stands where the save left it.
    expect(after.dealStream).toBe(dealStream);
    expect(after.game.board.map((c) => c.id)).toContain(game.hands[0][0].id);
    unmount();
  });
});
