// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { ClassicSetup } from '../../src/components/ClassicSetup';
import type { Difficulty } from '../../src/engine/types';

// Classic Setup, CS1 (D-007 release 2, part 1): Jett is pickable for every
// player (ruling 32), the summary and the button follow the picks, and
// starting sends the picked opponents and the target.

type OnStart = (targetScore: number, bot1: Difficulty, bot2: Difficulty) => void;

// A row's accessible name runs its initial, name, level, description and tag
// together; the name appears in no other button.
function row(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) });
}

describe('Classic Setup (CS1)', () => {
  let onStart: ReturnType<typeof vi.fn<OnStart>>;
  let onBack: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    localStorage.clear();
    onStart = vi.fn<OnStart>();
    onBack = vi.fn<() => void>();
    render(<ClassicSetup onStart={onStart} onBack={onBack} />);
  });

  afterEach(cleanup);

  it("CS1's words, with 300 picked and nothing else", () => {
    expect(screen.getByText('Classic Setup')).toBeTruthy();
    expect(screen.getByText('You against two opponents.')).toBeTruthy();
    expect(screen.getByText('TARGET SCORE')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '300' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '1000' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/First to the target wins, checked when a round ends\./)).toBeTruthy();
    expect(screen.getByText('A tie at the top plays one more round.')).toBeTruthy();
    expect(screen.getByText('PICK TWO OPPONENTS')).toBeTruthy();
    expect(screen.getByText('0 OF 2')).toBeTruthy();
    for (const [name, level, desc] of [['Calvin', 'EASY', 'Cautious, hesitant.'], ['Nina', 'MEDIUM', 'Balanced, calculating.'], ['Rex', 'HARD', 'Aggressive, combo-greedy.'], ['Jett', 'EXPERT', 'Patient, relentless.']]) {
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.getByText(level)).toBeTruthy();
      expect(screen.getByText(desc)).toBeTruthy();
    }
    expect(screen.getAllByText('PICK')).toHaveLength(4);
    expect(screen.queryByText('PICKED')).toBeNull();
    expect(screen.getByText('Pick two opponents to deal.')).toBeTruthy();
    const start = screen.getByRole('button', { name: 'PICK 2 OPPONENTS' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(start);
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.queryByText(/unlock/i)).toBeNull();
  });

  it('Jett can be picked', () => {
    fireEvent.click(row('Jett'));
    expect(row('Jett').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('PICKED')).toHaveLength(1);
    expect(screen.getByText('1 OF 2')).toBeTruthy();
  });

  it('the summary and the button follow the picks, and starting sends them with the target', () => {
    fireEvent.click(row('Nina'));
    fireEvent.click(row('Rex'));
    expect(screen.getByText('2 OF 2')).toBeTruthy();
    expect(screen.getByText('You vs Nina and Rex · first to 300 · seats by coin flip')).toBeTruthy();
    expect(screen.getAllByText('PICKED')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: '500' }));
    expect(screen.getByText('You vs Nina and Rex · first to 500 · seats by coin flip')).toBeTruthy();

    const start = screen.getByRole('button', { name: 'DEAL ME IN' }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledWith(500, 'intermediate', 'advanced');
  });

  it('a third pick replaces the first; unpicking goes back to waiting', () => {
    fireEvent.click(row('Calvin'));
    fireEvent.click(row('Nina'));
    fireEvent.click(row('Jett'));
    expect(screen.getByText('You vs Nina and Jett · first to 300 · seats by coin flip')).toBeTruthy();
    fireEvent.click(row('Jett'));
    expect(screen.getByText('Pick two opponents to deal.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PICK 2 OPPONENTS' })).toBeTruthy();
  });

  it('the way back', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});
