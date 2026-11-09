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

import { LeaveSheet } from '../../src/components/LeaveSheet';

// QD1 Way Back phone A (D-007 rulings 78 and 80): the words, Keep playing on
// top, Leave game under it, and a dim over the whole screen.

describe('the leave sheet (QD1)', () => {
  afterEach(cleanup);

  it('open: the words from the board, Keep playing and Leave game', () => {
    const onKeepPlaying = vi.fn();
    const onLeave = vi.fn();
    render(<LeaveSheet open onKeepPlaying={onKeepPlaying} onLeave={onLeave} />);
    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('Leave this game?')).toBeTruthy();
    expect(screen.getByText('Your game is saved. Tap CONTINUE on the home screen to pick it up right where you left off.')).toBeTruthy();
    const buttons = Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toEqual(['Keep playing', 'Leave game']);
    fireEvent.click(screen.getByText('Keep playing'));
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Leave game'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('open: a fixed layer over the whole screen takes every tap', () => {
    const { baseElement } = render(<LeaveSheet open onKeepPlaying={() => {}} onLeave={() => {}} />);
    const layer = Array.from(baseElement.querySelectorAll<HTMLElement>('div')).find((d) => d.style.position === 'fixed' && d.style.inset === '0px');
    expect(layer).toBeTruthy();
    expect(layer!.contains(screen.getByRole('dialog'))).toBe(true);
  });

  it('closed: nothing is in the page', () => {
    render(<LeaveSheet open={false} onKeepPlaying={() => {}} onLeave={() => {}} />);
    expect(screen.queryByText('Leave this game?')).toBeNull();
  });
});
