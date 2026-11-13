// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameController } from '../../src/game/useGameController';
import { loadGame, saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings } from '../../src/engine/types';

// S-006: a resumed game carries its own seed.

// Seed 1 deals the player first with these settings (see tutorialFreeze.test.tsx).
const SEED_PLAYER_FIRST = 1;
const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
function mount(seed: number, settings: GameSettings) {
  // The tutorial flag keeps the bots from moving, so the state stays put.
  return renderHook(() => useGameController(seed, settings, true));
}

describe('the Classic save slot (S-006)', () => {
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

  it('a resumed Classic game keeps its own seed and streams, not the mount seed', () => {
    const game = createInitialState(classicSettings, createPRNG(SEED_PLAYER_FIRST));
    const dealStream = 0xabcdef;
    saveGame('classic', {
      game,
      seed: SEED_PLAYER_FIRST,
      dealStream,
      botStream: 0x123456,
    });

    const { result, unmount } = mount(424242, classicSettings);
    expect(result.current.wasResumed).toBe(true);
    expect(result.current.state.currentPlayer).toBe(0);
    act(() => {
      result.current.actions.placeCard(result.current.state.hands[0][0].id);
    });

    const after = loadGame('classic')!;
    expect(after.seed).toBe(SEED_PLAYER_FIRST);
    // No deal happened, so the deal stream stands where the save left it.
    expect(after.dealStream).toBe(dealStream);
    expect(after.game.board.map((c) => c.id)).toContain(game.hands[0][0].id);
    unmount();
  });
});
