// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

// The phone's reduce-motion setting is on for this file: motion reads it once
// as its hook first runs, so the calm version gets a file of its own.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: /reduced-motion/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import { CurtainDeal, CURTAIN_CALM_MS } from '../../src/components/CurtainDeal';

// DD2 Curtain Deal's calm version (D-007 ruling 46, phone B): two fades over
// 320ms, the home over Classic's green, and onDone when it ends. The full
// version's 880ms is pinned through the app (tests/app/homeScreen.test.tsx
// and quickMatch.test.tsx).

describe('DD2 Curtain Deal, calm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the home over the green, takes the taps, and ends after 320ms', () => {
    const onDone = vi.fn();
    render(<CurtainDeal onDone={onDone}><div>the home</div></CurtainDeal>);
    const layer = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => d.style.position === 'fixed' && d.style.inset === '0px')!;
    expect(layer).toBeTruthy();
    expect(layer.style.pointerEvents).not.toBe('none');
    // Two layers: the green beneath, the home above it.
    expect(layer.children).toHaveLength(2);
    expect(layer.children[1].contains(screen.getByText('the home'))).toBe(true);
    act(() => { vi.advanceTimersByTime(CURTAIN_CALM_MS - 1); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('taken down early, it never calls onDone', () => {
    const onDone = vi.fn();
    const { unmount } = render(<CurtainDeal onDone={onDone}><div>the home</div></CurtainDeal>);
    unmount();
    act(() => { vi.advanceTimersByTime(CURTAIN_CALM_MS * 2); });
    expect(onDone).not.toHaveBeenCalled();
  });
});
