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
import { loadGame, saveGame } from '../../src/game/persistence';

// Sheets leave the page as soon as they close here (no exit animation).
MotionGlobalConfig.skipAnimations = true;
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import { C } from '../../src/config/colors';
import type { Card, Difficulty, GameSettings } from '../../src/engine/types';

// A game saves when it is dealt (D-007 release 4, ruling 110): a Quick Match
// that seats you first, left before anyone has moved, shows CONTINUE on the
// home and resumes the same deal (same hands, same table, same seats); a
// resumed game is not re-dealt or changed by the save at the deal; and a
// game from Classic Setup saves at its deal too.

const NAMES: Record<Difficulty, string> = { beginner: 'Calvin', intermediate: 'Nina', advanced: 'Rex', expert: 'Jett' };
const GLYPH: Record<Card['suit'], string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
// DD2 is 880ms in all.
const CURTAIN = 880;
const SAVE_KEY = 'stacked-save-classic';

const settings: GameSettings = { targetScore: 300, bot1Personality: 'beginner', bot2Personality: 'beginner' };
// Seed 1 seats the player first with these settings (tutorialFreeze.test.tsx).
const DEAL_SEED = 1;
const CLASSIC_SEED = 90210;

const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function gameStarts(): unknown[][] {
  return (window.gtag as Mock).mock.calls.filter((c) => c[0] === 'event' && c[1] === 'game_start');
}

/** The cards on show, by the width of the game's card face: 72 the hand, 54 the table. */
function facesOf(width: number): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('div'))
    .filter((d) => d.style.backgroundColor === rgb(C.cardFace) && d.style.width === `${width}px`)
    .map((f) => f.textContent!.match(/^(10|[2-9JQKA])[♠♥♦♣]/)![0]);
}
const label = (c: Card) => `${c.rank}${GLYPH[c.suit]}`;

/** The opponents' names in seat order. */
function seats(): string[] {
  return screen.getAllByText(/^(Calvin|Nina|Rex|Jett)$/).map((e) => e.textContent!);
}

function leaveGame() {
  fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
  expect(screen.getByText('Leave this game?')).toBeTruthy();
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Leave game'));
}

describe('a game saves when it is dealt (ruling 110)', () => {
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

  it('a Quick Match that seats you first, left before any move, shows CONTINUE and resumes the same deal', async () => {
    // A seed that seats the player first; the deal doesn't read the settings.
    const seed = Array.from({ length: 500 }, (_, k) => k).find((k) => createInitialState(settings, createPRNG(k)).currentPlayer === 0)!;
    expect(seed).toBeDefined();
    vi.spyOn(Math, 'random').mockReturnValue((seed + 0.5) / 1_000_000);

    render(<App />);
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'QUICK MATCH' }));
    // Saved at the tap, as it was dealt.
    const dealt = loadGame('classic', 0)!;
    expect(dealt).not.toBeNull();
    expect(dealt.seed).toBe(seed);
    expect(dealt.game.currentPlayer).toBe(0);
    expect(dealt.game.hands.map((h) => h.length)).toEqual([4, 4, 4]);
    expect(dealt.game.board).toHaveLength(4);
    expect(dealt.game.settings.targetScore).toBe(300);
    const raw = localStorage.getItem(SAVE_KEY);

    await advance(CURTAIN);
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(facesOf(72)).toEqual(dealt.game.hands[0].map(label));
    expect(facesOf(54)).toEqual(dealt.game.board.map(label));
    const seatsDealt = seats();
    expect(seatsDealt).toEqual([NAMES[dealt.game.settings.bot1Personality], NAMES[dealt.game.settings.bot2Personality]]);
    // Nobody has moved: the save is the deal.
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);

    leaveGame();
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeTruthy();
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);

    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    await advance(0);
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    expect(gameStarts()).toHaveLength(2);
    expect(gameStarts()[1][2]).toMatchObject({ mode: 'classic', resumed: true, seed });
    // The same deal: same hands, same table, same seats, your turn again.
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(facesOf(72)).toEqual(dealt.game.hands[0].map(label));
    expect(facesOf(54)).toEqual(dealt.game.board.map(label));
    expect(seats()).toEqual(seatsDealt);
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
  });

  it('CONTINUE on an existing save does not change it', async () => {
    const game = createInitialState(settings, createPRNG(DEAL_SEED));
    expect(game.currentPlayer).toBe(0);
    saveGame('classic', { game, currentLevelId: null, seed: CLASSIC_SEED, dealStream: DEAL_SEED, botStream: botStreamSeed(DEAL_SEED) });
    const raw = localStorage.getItem(SAVE_KEY);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(gameStarts()[0][2]).toMatchObject({ mode: 'classic', resumed: true, seed: CLASSIC_SEED });
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
    await advance(5_000);
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
    expect(facesOf(72)).toEqual(game.hands[0].map(label));
  });

  it('a game from Classic Setup is saved at its deal too', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'SET THE TABLE' }));
    await advance(CURTAIN);
    expect(screen.getByText('Classic Setup')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Calvin/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nina/ }));
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'DEAL ME IN' }));
    const dealt = loadGame('classic', 0)!;
    expect(dealt).not.toBeNull();
    expect(dealt.game.hands.map((h) => h.length)).toEqual([4, 4, 4]);
    // The two picked, in the seats the engine's coin flip gave them (RULES.md Classic rule 5).
    expect(dealt.game.settings.targetScore).toBe(300);
    expect([dealt.game.settings.bot1Personality, dealt.game.settings.bot2Personality].sort()).toEqual(['beginner', 'intermediate']);
  });
});
