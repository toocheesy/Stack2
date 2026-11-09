// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// jsdom has no matchMedia, and the motion presets ask for it as their module loads.
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

import { NewGameSheet } from '../../src/components/NewGameSheet';

// Start a new game?, QD1 Way Back phone B (D-007 release 3, rulings 80 and
// 104): the words, and the two buttons' handlers.

describe('Start a new game? (QD1 phone B)', () => {
  afterEach(cleanup);

  it('the words from the board, Keep playing on top, New game below', () => {
    const onKeepPlaying = vi.fn();
    const onNewGame = vi.fn();
    render(<NewGameSheet open onKeepPlaying={onKeepPlaying} onNewGame={onNewGame} />);
    const dialog = screen.getByRole('dialog', { name: 'Start a new game?' });
    expect(dialog).toBeTruthy();
    expect(screen.getByText('QUICK MATCH')).toBeTruthy();
    expect(screen.getByText('Your saved game will end.')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Keep playing', 'New game']);
    fireEvent.click(screen.getByText('Keep playing'));
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(onNewGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('New game'));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('closed: nothing is in the page', () => {
    render(<NewGameSheet open={false} onKeepPlaying={() => {}} onNewGame={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Start a new game?')).toBeNull();
  });
});
