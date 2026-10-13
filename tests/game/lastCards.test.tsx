// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameController } from '../../src/game/useGameController';
import { loadGame, saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { createGameTracker } from '../../src/engine/ai/cardTracker';
import { createPRNG } from '../../src/engine/utils/prng';
import { createIdGenerator } from '../../src/engine/utils/uuid';
import type { Card, GameSettings, GameState, PlayerIndex } from '../../src/engine/types';

// Same settings as tests/game/tutorialFreeze.test.tsx: both bots 'beginner'
// (Calvin, thinking delay 1500–3000 ms).
const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};

const SEED = 11;
const WELL_PAST = 10_000;

function mount(seed: number) {
  return renderHook(() => useGameController(seed, settings, null, false));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function advanceUntil(done: () => boolean, limitMs = WELL_PAST) {
  const step = 50;
  for (let t = 0; t < limitMs; t += step) {
    if (done()) return;
    await advance(step);
  }
  expect(done()).toBe(true);
}

function ids(cards: readonly Card[]): string[] {
  return cards.map((c) => c.id);
}

// A real game state where `player` is the last one holding cards: three
// cards from the deck in their hand (the first pairs a board card, so a
// legal capture exists), every other hand empty, 12+ cards still in the
// deck so the hand that follows is dealt.
function lastPlayerState(player: PlayerIndex, dumpActive = false): GameState {
  const base = createInitialState(settings, createPRNG(SEED), createIdGenerator(createPRNG(SEED + 1000)));
  const pairTarget = base.board[0];
  const match = base.deck.find((c) => c.rank === pairTarget.rank)!;
  const others = base.deck.filter((c) => c.id !== match.id && c.rank !== pairTarget.rank).slice(0, 2);
  const hand = [match, ...others];
  const deck = base.deck.filter((c) => !hand.some((h) => h.id === c.id));
  const hands: [Card[], Card[], Card[]] = [[], [], []];
  hands[player] = hand;
  return { ...base, hands, deck, currentPlayer: player, lastAction: null, dumpActive };
}

function movedOn(s: GameState): boolean {
  return s.handNumber > 1 || s.gamePhase === 'roundEnd';
}

describe('RULES.md L8: the last player holding cards', () => {
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

  it('human last: a capture is accepted, then a place puts the rest on the board and play moves on', async () => {
    const s = lastPlayerState(0);
    saveGame(s, createGameTracker(s.board), null);
    const { result } = mount(SEED);
    expect(result.current.state.currentPlayer).toBe(0);
    const [match, keep1, keep2] = result.current.state.hands[0];
    const target = result.current.state.board[0];

    act(() => {
      result.current.actions.addToCombo(match.id, 'hand', 'base');
      result.current.actions.addToCombo(target.id, 'board', 'combo1');
    });
    let refusal: string | null = 'unset';
    act(() => {
      refusal = result.current.actions.submitCombo();
    });
    expect(refusal).toBeNull();
    await advance(0);
    // L1: the capture continues the human's turn.
    expect(result.current.state.lastAction).toBe('capture');
    expect(result.current.state.currentPlayer).toBe(0);
    expect(ids(result.current.state.hands[0])).toEqual([keep1.id, keep2.id]);

    act(() => {
      result.current.actions.placeCard(keep1.id);
    });
    await advance(0);
    const after = result.current.state;
    expect(ids(after.board)).toEqual(expect.arrayContaining([keep1.id, keep2.id]));
    expect(movedOn(after)).toBe(true);
  });

  it('bot last: after its turn its hand is empty, play moves on, and its placed cards are in the card memory as on the board', async () => {
    const s = lastPlayerState(1);
    saveGame(s, createGameTracker(s.board), null);
    const { result } = mount(SEED);
    const originalHand = ids(result.current.state.hands[1]);
    expect(result.current.state.currentPlayer).toBe(1);

    await advanceUntil(() => result.current.state.hands[1].length === 0);
    const atEmpty = result.current.state;
    expect(atEmpty.lastAction).toBe('place');
    const putDown = originalHand.filter((id) => atEmpty.board.some((b) => b.id === id));
    expect(putDown.length).toBeGreaterThan(0);
    const saved = loadGame()!;
    for (const id of putDown) expect(saved.tracker.seenCards.get(id)).toBe('board');

    await advance(WELL_PAST);
    expect(movedOn(result.current.state)).toBe(true);
  });

  describe('a save made under the old lock (dumpActive true)', () => {
    for (const player of [0, 1] as PlayerIndex[]) {
      it(`current player ${player === 0 ? 'human' : 'bot'}: on mount the hand is on the board, dumpActive is false, play moves on`, async () => {
        const s = lastPlayerState(player, true);
        const hand = ids(s.hands[player]);
        saveGame(s, createGameTracker(s.board), null);
        const { result } = mount(SEED);

        expect(result.current.state.dumpActive).toBe(false);
        expect(ids(result.current.state.board)).toEqual(expect.arrayContaining(hand));
        await advance(WELL_PAST);
        const after = result.current.state;
        expect(after.dumpActive).toBe(false);
        expect(ids(after.board)).toEqual(expect.arrayContaining(hand));
        expect(movedOn(after)).toBe(true);
        expect(loadGame()!.game.dumpActive).toBe(false);
      });
    }
  });
});
