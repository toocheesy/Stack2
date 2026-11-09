// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// jsdom has no matchMedia, and the app asks for it as its modules load.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import { MotionGlobalConfig } from 'motion/react';
import App from '../../src/App';
import { saveGame } from '../../src/game/persistence';

// Sheets leave the page as soon as they close here (no exit animation), so
// the page reflects the state after each tap.
MotionGlobalConfig.skipAnimations = true;
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { Difficulty, GameSettings, GameState } from '../../src/engine/types';

// Quick Match (D-007 release 3, rulings 40, 40a, 46, 104, 106; S-033),
// through the whole app: QUICK MATCH with no save deals a Classic game to
// 300 against two different opponents of the four, any of the six pairs,
// with one game_start; the game waits under DD2's curtain and an opponent
// seated first moves only once it has ended; with a save, "Start a new
// game?" asks first and the save is kept until New game; CONTINUE still
// resumes the save, with no curtain.

const OPPONENTS: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const NAMES: Record<Difficulty, string> = { beginner: 'Calvin', intermediate: 'Nina', advanced: 'Rex', expert: 'Jett' };
const SIX_PAIRS = ['Calvin+Nina', 'Calvin+Rex', 'Calvin+Jett', 'Nina+Rex', 'Nina+Jett', 'Rex+Jett'].map((p) => p.split('+').sort().join('+')).sort();
// DD2 is 880ms in all.
const CURTAIN = 880;
// Longer than any bot delay plus the capture replay and the wait after a move.
const WELL_PAST = 10_000;

// A saved game to 100, so a Quick Match's board (to 300) reads differently.
const savedSettings: GameSettings = { targetScore: 100, bot1Personality: 'beginner', bot2Personality: 'beginner' };
const DEAL_SEED = 1;
const CLASSIC_SEED = 90210;

function saveClassic(game: GameState) {
  saveGame('classic', { game, currentLevelId: null, seed: CLASSIC_SEED, dealStream: DEAL_SEED, botStream: botStreamSeed(DEAL_SEED) });
}

function savedSeed(): number | null {
  const raw = localStorage.getItem('stacked-save-classic');
  return raw ? (JSON.parse(raw) as { seed: number }).seed : null;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function quickMatch() {
  fireEvent.click(screen.getByRole('button', { name: 'QUICK MATCH' }));
}

/** The opponents on the seats, by name. */
function seated(): string[] {
  return OPPONENTS.map((d) => NAMES[d]).filter((name) => screen.queryAllByText(name).length > 0);
}

function botCardCounts(): string[] {
  return screen.getAllByText(/^\d CARDS?$/).map((e) => e.textContent!);
}

function gameStarts(): unknown[][] {
  return (window.gtag as Mock).mock.calls.filter((c) => c[0] === 'event' && c[1] === 'game_start');
}

describe('Quick Match', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.gtag = vi.fn() as (...args: unknown[]) => void;
  });

  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('with no save, QUICK MATCH deals a Classic game to 300 against two different opponents of the four, and game_start fires once with mode classic', async () => {
    render(<App />);
    quickMatch();
    expect(screen.queryByRole('dialog')).toBeNull();
    await advance(CURTAIN);
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    expect(screen.getAllByText('CLASSIC · 300 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    const pair = seated();
    expect(pair).toHaveLength(2);
    expect(SIX_PAIRS).toContain(pair.sort().join('+'));
    expect(gameStarts()).toHaveLength(1);
    expect(gameStarts()[0][2]).toMatchObject({ mode: 'classic', resumed: false });
  });

  it('over many runs every one of the six pairs turns up', async () => {
    const seen = new Set<string>();
    // The pair comes from the seed's random source; these six draws land on each of the six.
    for (const draw of [0.05, 0.2, 0.4, 0.55, 0.7, 0.9]) {
      const random = vi.spyOn(Math, 'random').mockReturnValue(draw);
      render(<App />);
      quickMatch();
      await advance(CURTAIN);
      const pair = seated();
      expect(pair).toHaveLength(2);
      seen.add(pair.sort().join('+'));
      random.mockRestore();
      cleanup();
      localStorage.clear();
    }
    expect([...seen].sort()).toEqual(SIX_PAIRS);
  });

  it('the hold: an opponent seated first does not move until the curtain has ended, then does', async () => {
    // A seed that seats an opponent first; the deal doesn't read the settings.
    const seed = Array.from({ length: 500 }, (_, k) => k).find((k) => createInitialState(savedSettings, createPRNG(k)).currentPlayer !== 0)!;
    expect(seed).toBeDefined();
    vi.spyOn(Math, 'random').mockReturnValue((seed + 0.5) / 1_000_000);

    render(<App />);
    quickMatch();
    // Dealt at the tap, under the leaving home, and waiting: both opponents hold four cards and nobody is thinking.
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    expect(screen.getAllByText('CLASSIC · 300 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('YOUR TURN')).toBeNull();
    expect(botCardCounts()).toEqual(['4 CARDS', '4 CARDS']);
    expect(screen.queryByText('THINKING ···')).toBeNull();
    await advance(CURTAIN - 1);
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    expect(botCardCounts()).toEqual(['4 CARDS', '4 CARDS']);
    expect(screen.queryByText('THINKING ···')).toBeNull();
    expect(savedSeed()).toBeNull();

    await advance(1);
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    // The opponent moves: its hand is one card down, the other's still full.
    for (let t = 0; t < WELL_PAST && !botCardCounts().includes('3 CARDS'); t += 50) await advance(50);
    expect(botCardCounts().sort()).toEqual(['3 CARDS', '4 CARDS']);
    expect(savedSeed()).toBe(seed);
  });

  it('with a save, QUICK MATCH opens "Start a new game?" and the save is still there; Keep playing keeps it', async () => {
    saveClassic(createInitialState(savedSettings, createPRNG(DEAL_SEED)));
    render(<App />);
    quickMatch();
    const dialog = screen.getByRole('dialog', { name: 'Start a new game?' });
    expect(within(dialog).getByText('QUICK MATCH')).toBeTruthy();
    expect(within(dialog).getByText('Your saved game will end.')).toBeTruthy();
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep playing', 'New game']);
    expect(savedSeed()).toBe(CLASSIC_SEED);
    expect(screen.queryByText(/CLASSIC · /)).toBeNull();

    fireEvent.click(within(dialog).getByText('Keep playing'));
    await advance(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeTruthy();
    expect(savedSeed()).toBe(CLASSIC_SEED);
    expect(gameStarts()).toHaveLength(0);
  });

  it('New game ends the saved game and starts the Quick Match with DD2', async () => {
    saveClassic(createInitialState(savedSettings, createPRNG(DEAL_SEED)));
    render(<App />);
    quickMatch();
    fireEvent.click(within(screen.getByRole('dialog')).getByText('New game'));
    await advance(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    // The save is gone, the new game is dealt under the curtain, and the leaving home still shows CONTINUE as it did at the tap.
    expect(savedSeed()).toBeNull();
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    expect(screen.getByText('CONTINUE')).toBeTruthy();
    expect(screen.getAllByText('CLASSIC · 300 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    await advance(CURTAIN);
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    expect(screen.queryByText('CONTINUE')).toBeNull();
    expect(screen.getAllByText('CLASSIC · 300 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    expect(gameStarts()).toHaveLength(1);
    expect(gameStarts()[0][2]).toMatchObject({ mode: 'classic', resumed: false });
  });

  it('CONTINUE still resumes the saved game, with no curtain', () => {
    const game = createInitialState(savedSettings, createPRNG(DEAL_SEED));
    saveClassic(game);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    expect(screen.getAllByText('CLASSIC · 100 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    expect(gameStarts()).toHaveLength(1);
    expect(gameStarts()[0][2]).toMatchObject({ mode: 'classic', resumed: true, seed: CLASSIC_SEED });
    expect(savedSeed()).toBe(CLASSIC_SEED);
  });
});
