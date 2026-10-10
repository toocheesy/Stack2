// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameController } from '../../src/game/useGameController';
import type { GameSettings, GameState } from '../../src/engine/types';

// Same settings as src/engine/core/__tests__/gameLogic.test.ts. Both bots
// 'beginner' (Calvin), whose thinking delay is 1500–3000 ms.
const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};

// Seeds, found by running the hook over seeds 1–40 with the tutorial closed:
//   SEED_PLAYER_FIRST  1 — the player moves first; the next player is bot 1.
//   SEED_BOT_PLACES    6 — bot 1 moves first and places on its first move.
//   SEED_BOT_CAPTURES  7 — bot 1 moves first and captures on its first move.
const SEED_PLAYER_FIRST = 1;
const SEED_BOT_PLACES = 6;
const SEED_BOT_CAPTURES = 7;

// Longer than any bot delay plus the 2000 ms combo show and 500 ms post-move wait.
const WELL_PAST = 10_000;

function mount(seed: number, tutorialActive: boolean) {
  return renderHook(
    ({ tutorial }: { tutorial: boolean }) => useGameController(seed, settings, null, tutorial),
    { initialProps: { tutorial: tutorialActive } },
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// Advance in small steps until `done` is true, or fail after `limitMs`.
async function advanceUntil(done: () => boolean, limitMs = WELL_PAST) {
  const step = 50;
  for (let t = 0; t < limitMs; t += step) {
    if (done()) return;
    await advance(step);
  }
  expect(done()).toBe(true);
}

function ids(cards: readonly { id: string }[]): string[] {
  return cards.map((c) => c.id);
}

function snapshot(s: GameState) {
  return {
    hands: s.hands.map(ids),
    board: ids(s.board),
    scores: { ...s.scores },
    currentPlayer: s.currentPlayer,
  };
}

describe('tutorial freeze: useGameController', () => {
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

  it('mount with the tutorial open: a bot due to move first never moves', async () => {
    const { result } = mount(SEED_BOT_PLACES, true);
    const bot = result.current.state.currentPlayer;
    expect(bot).not.toBe(0);
    const before = snapshot(result.current.state);

    await advance(WELL_PAST);

    expect(ids(result.current.state.hands[bot])).toEqual(before.hands[bot]);
    expect(result.current.botViz).toBeNull();
  });

  it('G1: a bot turn due after the player places never starts while the tutorial is open', async () => {
    const { result } = mount(SEED_PLAYER_FIRST, true);
    expect(result.current.state.currentPlayer).toBe(0);
    const playerCard = result.current.state.hands[0][0];

    act(() => {
      result.current.actions.placeCard(playerCard.id);
    });
    const bot = result.current.state.currentPlayer;
    expect(bot).not.toBe(0);
    const botHand = ids(result.current.state.hands[bot]);

    // 1 ms in: without G1 the bot would already be "thinking".
    await advance(1);
    expect(result.current.botViz).toBeNull();

    await advance(WELL_PAST);
    expect(ids(result.current.state.hands[bot])).toEqual(botHand);
    expect(result.current.botViz).toBeNull();
  });

  it('G2: opening the tutorial during the thinking delay stops the move', async () => {
    const { result, rerender } = mount(SEED_BOT_PLACES, false);
    const bot = result.current.state.currentPlayer;
    expect(bot).not.toBe(0);
    expect(result.current.botViz).toEqual({ type: 'thinking', playerIndex: bot });
    const before = snapshot(result.current.state);

    rerender({ tutorial: true });
    await advance(WELL_PAST);

    expect(ids(result.current.state.hands[bot])).toEqual(before.hands[bot]);
    expect(ids(result.current.state.board)).toEqual(before.board);
    expect(result.current.botViz).toBeNull();
  });

  it('G3: opening the tutorial while a bot capture is on show stops the capture', async () => {
    const { result, rerender } = mount(SEED_BOT_CAPTURES, false);
    const bot = result.current.state.currentPlayer;
    expect(bot).not.toBe(0);

    await advanceUntil(() => result.current.botCombo !== null);
    expect(result.current.botCombo!.playerIndex).toBe(bot);
    const atShow = snapshot(result.current.state);

    rerender({ tutorial: true });
    await advance(WELL_PAST);

    expect(result.current.botCombo).toBeNull();
    expect(ids(result.current.state.board)).toEqual(atShow.board);
    expect(ids(result.current.state.hands[bot])).toEqual(atShow.hands[bot]);
    expect(result.current.state.scores).toEqual(atShow.scores);
    expect(result.current.botViz).toBeNull();
  });

  it('G4: opening the tutorial in the 500 ms after a bot places keeps the turn with that bot', async () => {
    const { result, rerender } = mount(SEED_BOT_PLACES, false);
    const bot = result.current.state.currentPlayer;
    expect(bot).not.toBe(0);
    // Early in the hand: every player still holds cards, so after a place
    // determineTurnResult passes the turn (CONTINUE_TURN to the next player).
    expect(result.current.state.hands.every((h) => h.length > 0)).toBe(true);

    await advanceUntil(() => result.current.state.lastAction === 'place');
    expect(result.current.state.currentPlayer).toBe(bot);

    rerender({ tutorial: true });
    await advance(WELL_PAST);

    expect(result.current.state.currentPlayer).toBe(bot);
    expect(result.current.botViz).toBeNull();
  });

  it('resume: closing the tutorial after G1 froze a bot lets that bot move from the frozen state', async () => {
    const { result, rerender } = mount(SEED_PLAYER_FIRST, true);
    act(() => {
      result.current.actions.placeCard(result.current.state.hands[0][0].id);
    });
    const bot = result.current.state.currentPlayer;
    expect(bot).not.toBe(0);
    await advance(WELL_PAST);
    const frozen = snapshot(result.current.state);
    expect(result.current.botViz).toBeNull();

    rerender({ tutorial: false });
    await advance(WELL_PAST);

    const after = result.current.state;
    expect(after.hands[bot].length).toBeLessThan(frozen.hands[bot].length);
    // Every card still in the bot's hand was in its frozen hand: the move
    // started from the state it froze at.
    for (const id of ids(after.hands[bot])) expect(frozen.hands[bot]).toContain(id);
    expect(after.lastAction).not.toBeNull();
  });

  it('resume: closing the tutorial after G3 stopped a capture lets that bot move from the frozen state', async () => {
    const { result, rerender } = mount(SEED_BOT_CAPTURES, false);
    const bot = result.current.state.currentPlayer;
    await advanceUntil(() => result.current.botCombo !== null);
    rerender({ tutorial: true });
    await advance(WELL_PAST);
    const frozen = snapshot(result.current.state);
    expect(result.current.state.lastAction).toBeNull();

    rerender({ tutorial: false });
    await advance(WELL_PAST);

    const after = result.current.state;
    expect(after.hands[bot].length).toBeLessThan(frozen.hands[bot].length);
    for (const id of ids(after.hands[bot])) expect(frozen.hands[bot]).toContain(id);
    expect(after.lastAction).not.toBeNull();
  });
});
