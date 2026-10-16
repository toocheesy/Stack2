// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameController } from '../../src/game/useGameController';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings } from '../../src/engine/types';

// S-006: the controller reports the game seed, and first_capture carries it.
const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};

// Seeds that deal the player first with these settings (tutorialFreeze.test.tsx
// pins seed 1; the rest come from the same 1-40 scan).
const PLAYER_FIRST_SEEDS = [1, 2, 4, 10, 11, 16, 17, 22, 23, 24, 26, 27, 30, 38, 39];
const SAVED_SEED = 90210;

function mount(seed: number, currentLevelId: number | null) {
  // The tutorial flag keeps the bots from moving.
  return renderHook(() => useGameController(seed, settings, currentLevelId, true));
}

describe('the seed in analytics (S-006)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete window.gtag;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a new game reports the seed prop', () => {
    const { result, unmount } = mount(4321, null);
    expect(result.current.wasResumed).toBe(false);
    expect(result.current.seed).toBe(4321);
    unmount();
  });

  it('a resumed game reports the saved seed, not the seed prop', () => {
    const game = createInitialState(settings, createPRNG(1));
    saveGame('classic', {
      game,
      currentLevelId: null,
      seed: SAVED_SEED,
      dealStream: 1,
      botStream: botStreamSeed(1),
    });
    const { result, unmount } = mount(4321, null);
    expect(result.current.wasResumed).toBe(true);
    expect(result.current.seed).toBe(SAVED_SEED);
    unmount();
  });

  it('first_capture carries the seed of a new game', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    let captured = false;
    for (const seed of PLAYER_FIRST_SEEDS) {
      const { result, unmount } = mount(seed, null);
      const { hands, board } = result.current.state;
      expect(result.current.state.currentPlayer).toBe(0);
      // A pair: a hand card matching a board card's rank.
      const pair = hands[0].flatMap((h) => board.filter((b) => b.rank === h.rank).map((b) => ({ h, b })))[0];
      if (!pair) {
        unmount();
        continue;
      }
      let refusal: string | null = 'unset';
      act(() => {
        result.current.actions.addToCombo(pair.h.id, 'hand', 'base');
        result.current.actions.addToCombo(pair.b.id, 'board', 'combo1');
      });
      act(() => {
        refusal = result.current.actions.submitCombo();
      });
      expect(refusal).toBeNull();
      expect(gtag).toHaveBeenCalledWith(
        'event',
        'first_capture',
        expect.objectContaining({ mode: 'classic', seed }),
      );
      captured = true;
      unmount();
      break;
    }
    expect(captured).toBe(true);
  });
});
