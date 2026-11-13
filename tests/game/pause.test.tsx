// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MOMENTS, landingMs, useGameController } from '../../src/game/useGameController';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { Card, GameSettings, GameState, PlayerIndex } from '../../src/engine/types';

// Paused means paused (D-007 release 2 part 3, section D), in the controller:
// a pause that opens while a moment's wait runs holds the moment where it
// stands (the last cards' hold, Take the Table), and play carries on from
// there once the pause closes. The bot gates are tests/game/tutorialFreeze.test.tsx.
// Seats are fixed: Rex (advanced) in seat 1, Nina (intermediate) in seat 2.

const settings: GameSettings = {
  targetScore: 100,
  bot1Personality: 'advanced',
  bot2Personality: 'intermediate',
};
const SEED = 22;
const WELL_PAST = 10_000;

function mount(paused: boolean) {
  return renderHook(({ paused }: { paused: boolean }) => useGameController(SEED, settings, paused), { initialProps: { paused } });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const ids = (cards: readonly Card[]) => cards.map((c) => c.id);

function arrange(over: {
  hand?: string[]; bot1?: string[]; bot2?: string[]; table?: string[];
  deck?: 'rest' | 'empty'; currentPlayer: PlayerIndex; lastCapturer?: PlayerIndex | null; handNumber?: number;
}): GameState {
  const base = createInitialState(settings, createPRNG(SEED));
  const pack = [...base.deck, ...base.board, ...base.hands[0], ...base.hands[1], ...base.hands[2]];
  const pick = (list?: string[]) => (list ?? []).map((id) => pack.find((c) => c.id === id)!);
  const hands: [Card[], Card[], Card[]] = [pick(over.hand), pick(over.bot1), pick(over.bot2)];
  const board = pick(over.table);
  const used = new Set([...hands.flat(), ...board].map((c) => c.id));
  const deck = over.deck === 'empty' ? [] : pack.filter((c) => !used.has(c.id));
  return {
    ...base,
    hands,
    board,
    deck,
    currentPlayer: over.currentPlayer,
    lastAction: null,
    lastCapturer: over.lastCapturer ?? null,
    handNumber: over.handNumber ?? 1,
    combination: { base: null, combo1: [], combo2: [], combo3: [] },
  };
}

function save(game: GameState) {
  saveGame('classic', { game, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
}

describe('the pause holds the moments (section D)', () => {
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

  it('RULES.md Law 8: a pause during the last cards\' hold keeps the deal back until it closes', async () => {
    save(arrange({ hand: ['4H', '7C'], bot1: [], bot2: [], table: ['3H', '5S'], currentPlayer: 0 }));
    const { result, rerender } = mount(false);
    act(() => { result.current.actions.placeCard('4H'); });
    await advance(500);
    expect(result.current.state.handNumber).toBe(1);
    expect(ids(result.current.lastCapture!.rest)).toEqual(['7C']);

    rerender({ paused: true });
    await advance(WELL_PAST);
    // The hold is over, but the game waits: hand 1, the line still up.
    expect(result.current.state.handNumber).toBe(1);
    expect(result.current.lastCapture).not.toBeNull();
    expect(ids(result.current.state.board)).toEqual(['3H', '5S', '4H', '7C']);

    rerender({ paused: false });
    await advance(50);
    expect(result.current.state.handNumber).toBe(2);
    expect(result.current.lastCapture).toBeNull();
  });

  it('a pause that opens and closes within the hold changes nothing: the deal comes when the hold ends', async () => {
    save(arrange({ hand: ['4H', '7C'], bot1: [], bot2: [], table: ['3H', '5S'], currentPlayer: 0 }));
    const { result, rerender } = mount(false);
    act(() => { result.current.actions.placeCard('4H'); });
    await advance(300);
    rerender({ paused: true });
    await advance(300);
    rerender({ paused: false });
    await advance(landingMs(1) - 600 - 50);
    expect(result.current.state.handNumber).toBe(1);
    await advance(100);
    expect(result.current.state.handNumber).toBe(2);
    // Hand 2 dealt once: nine cards in play, the rest in the deck.
    const s = result.current.state;
    expect(s.hands.map((h) => h.length)).toEqual([4, 4, 4]);
    expect(s.deck.length + 12 + s.board.length).toBe(52);
  });

  it('TT1: a pause during Take the Table holds the round end back until it closes', async () => {
    save(arrange({ hand: ['6H'], bot1: [], bot2: [], table: ['5C', '9D', 'KS'], deck: 'empty', currentPlayer: 0, lastCapturer: 2, handNumber: 4 }));
    const { result, rerender } = mount(false);
    act(() => { result.current.actions.placeCard('6H'); });
    await advance(1000);
    expect(result.current.jackpotInfo).not.toBeNull();
    expect(result.current.state.gamePhase).toBe('playing');

    rerender({ paused: true });
    await advance(WELL_PAST);
    // The take is scored, the moment on show, the sheet not yet risen.
    expect(result.current.state.gamePhase).toBe('playing');
    expect(result.current.state.overallScores.bot2).toBe(25);
    expect(result.current.jackpotInfo).not.toBeNull();

    rerender({ paused: false });
    await advance(50);
    expect(result.current.state.gamePhase).toBe('roundEnd');
    await advance(MOMENTS.takeTheTable.end - MOMENTS.takeTheTable.sheet);
    expect(result.current.jackpotInfo).toBeNull();
    // Scored once.
    expect(result.current.state.overallScores).toEqual({ player: 0, bot1: 0, bot2: 25 });
  });

  it('an opponent\'s last place: a pause during its hold keeps the deal back, and the hold-over bot does not move twice', async () => {
    save(arrange({ hand: [], bot1: ['4H', '7C'], bot2: [], table: ['3H', '5S'], currentPlayer: 1 }));
    const { result, rerender } = mount(false);
    for (let t = 0; t < WELL_PAST && result.current.state.hands[1].length > 0; t += 50) await advance(50);
    expect(result.current.state.hands[1]).toEqual([]);
    expect(result.current.state.handNumber).toBe(1);

    rerender({ paused: true });
    await advance(WELL_PAST);
    expect(result.current.state.handNumber).toBe(1);
    expect(ids(result.current.state.board).sort()).toEqual(['3H', '4H', '5S', '7C']);

    rerender({ paused: false });
    await advance(50);
    expect(result.current.state.handNumber).toBe(2);
    expect(result.current.state.hands.map((h) => h.length)).toEqual([4, 4, 4]);
  });
});
