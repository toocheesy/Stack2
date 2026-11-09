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

import { TutorialOverlay, type TutorialMark } from '../../src/components/TutorialOverlay';

// TU2 Plum Coach (D-007 rulings 79 and 80): the layer that takes every tap,
// the nine steps' words, STEP N OF 9, the dots, Skip, Back (not on step 1)
// and Next (Done on step 9), and the sample capture on steps 3 to 6.

const noop = () => {};

function el(): HTMLDivElement {
  const d = document.createElement('div');
  document.body.appendChild(d);
  return d;
}

function mark(title: string, copy: string, side: 'top' | 'bottom', sample = false): TutorialMark {
  return { title, copy, refs: [{ current: el() }], side, sample };
}

// TU2's nine steps, as GameView lists them.
const STEPS: TutorialMark[] = [
  mark('Your hand.', 'Your cards. Drag one into the capture tray to start a capture, or onto the table to place it.', 'top'),
  mark('The table.', 'The shared cards. Capture them to score.', 'bottom'),
  mark('The capture tray.', 'Put a base card here, from your hand or the table. Then fill up to three combos with cards that add up to it, or match it.', 'top', true),
  mark('HAND and TABLE.', 'Every combo needs a card from the other side of your base.', 'top', true),
  mark('SUBMIT.', 'Your points show before you press it. A capture keeps your turn going; placing a card ends it.', 'top', true),
  mark('RESET.', 'Wrong card? RESET sends everything back where it came from.', 'top', true),
  mark('Your opponents.', 'Two opponents race you to the target. Their moves pop up from their seats.', 'bottom'),
  mark('The message line.', 'It tells you the rule that matters right now.', 'bottom'),
  mark('The top bar.', "The target score, and the round and hand you're on. The back arrow leaves the game; it stays saved.", 'bottom'),
];

// The blocking layer: fixed, full-screen, zIndex 400, pointerEvents auto.
function findBlockingLayer(root: ParentNode): HTMLElement | null {
  for (const e of Array.from(root.querySelectorAll<HTMLElement>('div'))) {
    const s = e.style;
    if (s.position === 'fixed' && s.zIndex === '400' && s.pointerEvents === 'auto' && s.inset === '0px') return e;
  }
  return null;
}

function renderAt(step: number, handlers: Partial<{ onNext(): void; onPrev(): void; onSkip(): void; onJump(step: number): void }> = {}, visible = true) {
  const trayRef = { current: el() };
  return render(
    <TutorialOverlay
      visible={visible}
      currentStep={step}
      totalSteps={STEPS.length}
      marks={STEPS}
      trayRef={trayRef}
      onNext={handlers.onNext ?? noop}
      onPrev={handlers.onPrev ?? noop}
      onSkip={handlers.onSkip ?? noop}
      onJump={handlers.onJump ?? noop}
    />,
  );
}

describe('TutorialOverlay (TU2)', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('visible: a fixed, full-screen layer with zIndex 400 and pointerEvents auto is in the page', () => {
    const { baseElement } = renderAt(0);
    expect(findBlockingLayer(baseElement)).not.toBeNull();
  });

  it('not visible: that layer is not there', () => {
    const { baseElement } = renderAt(0, {}, false);
    expect(findBlockingLayer(baseElement)).toBeNull();
  });

  it.each(STEPS.map((s, i) => [i + 1, s] as const))('step %i says STEP N OF 9, its title and its words', (n, step) => {
    renderAt(n - 1);
    expect(screen.getByText(`STEP ${n} OF 9`)).toBeTruthy();
    expect(screen.getByText(step.title)).toBeTruthy();
    expect(screen.getByText(step.copy)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Go to step \d$/ })).toHaveLength(9);
    cleanup();
  });

  it('step 1 has no Back and says Next; step 9 has Back and says Done', () => {
    renderAt(0);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    cleanup();
    renderAt(8);
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('Next, Back, Skip and a dot call the tutorial', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onSkip = vi.fn();
    const onJump = vi.fn();
    renderAt(3, { onNext, onPrev, onSkip, onJump });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 7' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(6);
  });

  it('the sheet docks to the edge away from the part: top for step 1, bottom for step 2', () => {
    renderAt(0);
    const top = document.querySelector<HTMLElement>('section[aria-label="Tutorial"]')!;
    expect(top.style.top).toBe('0px');
    expect(top.style.bottom).toBe('');
    cleanup();
    renderAt(1);
    const bottom = document.querySelector<HTMLElement>('section[aria-label="Tutorial"]')!;
    expect(bottom.style.bottom).toBe('0px');
    expect(bottom.style.top).toBe('');
  });

  it('steps 3 to 6 lay the sample capture over the tray: 10♦ from your hand, 6♣ + 4♥ from the table, +20 so far', () => {
    for (const step of [2, 3, 4, 5]) {
      renderAt(step);
      expect(screen.getByText('+20 so far')).toBeTruthy();
      expect(screen.getByText('HAND')).toBeTruthy();
      expect(screen.getByText('TABLE ×2')).toBeTruthy();
      expect(screen.getByText('COMBO 1 ✓')).toBeTruthy();
      cleanup();
    }
    for (const step of [0, 1, 6, 7, 8]) {
      renderAt(step);
      expect(screen.queryByText('+20 so far')).toBeNull();
      cleanup();
    }
  });
});
