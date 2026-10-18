// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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

import App from '../../src/App';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings } from '../../src/engine/types';

// S-021: the Classic card's PLAY and CONTINUE are real buttons the keyboard
// can reach, and its tagline says the game runs to the score the player picks
// (RULES.md Law 11 and Classic rule 6). Enter and Space aren't pressed here (no user-event
// package); they're checked in the browser.

const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
const DEAL_SEED = 1;

function saveClassic() {
  saveGame('classic', {
    game: createInitialState(classicSettings, createPRNG(DEAL_SEED)),
    currentLevelId: null,
    seed: DEAL_SEED,
    dealStream: DEAL_SEED,
    botStream: botStreamSeed(DEAL_SEED),
  });
}

describe('the Classic card on the home screen (S-021)', () => {
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

  it('the tagline says the game is played to the score you pick', () => {
    render(<App />);
    expect(screen.getByText('Play to the score you pick.')).toBeTruthy();
    expect(screen.queryByText('Best of three rounds.')).toBeNull();
  });

  it('PLAY is a button that takes focus, and clicking it opens Classic Setup', () => {
    render(<App />);
    const play = screen.getByRole('button', { name: /^PLAY/ });
    act(() => { play.focus(); });
    expect(document.activeElement).toBe(play);
    fireEvent.click(play);
    expect(screen.getByText('Classic Setup')).toBeTruthy();
  });

  it('with a Classic save, CONTINUE and PLAY are both buttons that take focus', () => {
    saveClassic();
    render(<App />);
    const cont = screen.getByRole('button', { name: 'CONTINUE' });
    const play = screen.getByRole('button', { name: /^PLAY/ });
    act(() => { cont.focus(); });
    expect(document.activeElement).toBe(cont);
    act(() => { play.focus(); });
    expect(document.activeElement).toBe(play);
  });
});
