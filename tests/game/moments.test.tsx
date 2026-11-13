// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MOMENTS, landingMs, useGameController } from '../../src/game/useGameController';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { Card, GameSettings, GameState, PlayerIndex } from '../../src/engine/types';

// D-007 release 2, part 2: when play moves on around the moments. The state
// changes the instant a move is made (the engine's reads stay true); only the
// next turn, the next deal and the round end wait for the motion.
// Seats are fixed: Rex (advanced) in seat 1, Nina (intermediate) in seat 2.

const settings: GameSettings = {
  targetScore: 100,
  bot1Personality: 'advanced',
  bot2Personality: 'intermediate',
  disableSeatingSwap: true,
};
const SEED = 21;
const WELL_PAST = 10_000;

function mount() {
  return renderHook(() => useGameController(SEED, settings, false));
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

describe('when play moves on around the moments', () => {
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

  it('YC1: a capture that empties your hand hands the turn on as it lands, not before', async () => {
    save(arrange({ hand: ['5H'], bot1: ['2D', '3D'], bot2: [], table: ['5C', '9D'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => {
      result.current.actions.addToCombo('5H', 'hand', 'base');
      result.current.actions.addToCombo('5C', 'board', 'combo1');
      result.current.actions.submitCombo();
    });
    // The capture is made at once; the last move carries the game before it.
    expect(result.current.state.hands[0]).toEqual([]);
    expect(result.current.state.overallScores.player).toBe(10);
    const last = result.current.lastCapture!;
    expect(ids(last.before.hands[0])).toEqual(['5H']);
    expect(ids(last.before.board)).toEqual(['5C', '9D']);
    expect(last.before.overallScores.player).toBe(0);
    expect(last.id).toBeGreaterThan(0);

    await advance(MOMENTS.yourCapture.land - 50);
    expect(result.current.state.currentPlayer).toBe(0);
    expect(result.current.botViz).toBeNull();
    await advance(100);
    expect(result.current.state.currentPlayer).toBe(1);
    expect(result.current.botViz).toEqual({ type: 'thinking', playerIndex: 1 });
  });

  it('a capture with cards left goes on at once, and each move gets a new id', async () => {
    save(arrange({ hand: ['5H', '7C'], bot1: ['2D'], bot2: [], table: ['5C', '9D'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => {
      result.current.actions.addToCombo('5H', 'hand', 'base');
      result.current.actions.addToCombo('5C', 'board', 'combo1');
      result.current.actions.submitCombo();
    });
    await advance(0);
    const first = result.current.lastCapture!.id;
    expect(result.current.state.lastAction).toBe('capture');
    expect(result.current.state.currentPlayer).toBe(0);
    act(() => { result.current.actions.placeCard('7C'); });
    await advance(0);
    expect(result.current.lastCapture!.id).toBe(first + 1);
    expect(result.current.lastCapture!.placed!.id).toBe('7C');
  });

  it('RULES.md Law 8: after your last place the deal waits for the cards to land and the line to hold', async () => {
    save(arrange({ hand: ['4H', '7C'], bot1: [], bot2: [], table: ['3H', '5S'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => { result.current.actions.placeCard('4H'); });
    await advance(0);
    expect(ids(result.current.state.board)).toEqual(['3H', '5S', '4H', '7C']);
    expect(result.current.state.handNumber).toBe(1);
    expect(ids(result.current.lastCapture!.rest)).toEqual(['7C']);

    await advance(landingMs(1) - 50);
    expect(result.current.state.handNumber).toBe(1);
    expect(result.current.lastCapture).not.toBeNull();
    await advance(100);
    expect(result.current.state.handNumber).toBe(2);
    expect(result.current.lastCapture).toBeNull();
  });

  it("RULES.md Law 8: an opponent's last place waits the same way", async () => {
    save(arrange({ hand: [], bot1: ['4H', '7C'], bot2: [], table: ['3H', '5S'], currentPlayer: 1 }));
    const { result } = mount();
    await advanceUntil(() => result.current.state.hands[1].length === 0);
    expect(result.current.state.handNumber).toBe(1);
    expect(result.current.lastCapture!.rest).toHaveLength(1);
    await advance(landingMs(1) - 100);
    expect(result.current.state.handNumber).toBe(1);
    await advance(200);
    expect(result.current.state.handNumber).toBe(2);
  });

  it('TT1: Take the Table carries the cards and the scores before; the sheet rises at 2,120 ms and the moment ends at 2,500', async () => {
    save(arrange({ hand: ['6H'], bot1: [], bot2: [], table: ['5C', '9D', 'KS'], deck: 'empty', currentPlayer: 0, lastCapturer: 2, handNumber: 4 }));
    const { result } = mount();
    act(() => { result.current.actions.placeCard('6H'); });
    await advance(0);
    const tt = result.current.jackpotInfo!;
    expect(tt).not.toBeNull();
    expect(tt.winner).toBe(2);
    expect(ids(tt.cards)).toEqual(['5C', '9D', 'KS', '6H']);
    expect(tt.points).toBe(5 + 5 + 10 + 5);
    expect(tt.cardCount).toBe(4);
    expect(tt.scoresBefore).toEqual({ player: 0, bot1: 0, bot2: 0 });
    // The take is scored at once; the round end waits for the moment.
    expect(result.current.state.overallScores.bot2).toBe(25);
    expect(result.current.state.board).toEqual([]);
    expect(result.current.state.roundStats[2].tookTheTable).toBe(true);
    expect(result.current.state.gamePhase).toBe('playing');

    await advance(MOMENTS.takeTheTable.sheet - 50);
    expect(result.current.state.gamePhase).toBe('playing');
    await advance(100);
    expect(result.current.state.gamePhase).toBe('roundEnd');
    expect(result.current.jackpotInfo).not.toBeNull();
    await advance(MOMENTS.takeTheTable.end - MOMENTS.takeTheTable.sheet);
    expect(result.current.jackpotInfo).toBeNull();
  });

  it('no Take the Table moment when nobody captured this round (RULES.md Law 10)', async () => {
    save(arrange({ hand: ['6H'], bot1: [], bot2: [], table: ['5C', '9D'], deck: 'empty', currentPlayer: 0, lastCapturer: null, handNumber: 4 }));
    const { result } = mount();
    act(() => { result.current.actions.placeCard('6H'); });
    await advance(0);
    expect(result.current.jackpotInfo).toBeNull();
    await advance(600);
    expect(result.current.state.gamePhase).toBe('roundEnd');
    expect(result.current.jackpotInfo).toBeNull();
    expect(result.current.state.roundStats.map((r) => r.tookTheTable)).toEqual([false, false, false]);
  });

  it('a save made between your move and its advance moves on at mount', async () => {
    save({ ...arrange({ hand: [], bot1: ['2D', '3D'], bot2: [], table: ['5C', '9D'], currentPlayer: 0 }), lastAction: 'capture', lastCapturer: 0 });
    const { result } = mount();
    await advance(0);
    expect(result.current.state.currentPlayer).toBe(1);
    expect(result.current.botViz).toEqual({ type: 'thinking', playerIndex: 1 });
  });
});
