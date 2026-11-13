// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTutorial } from '../../src/tutorial/useTutorial';

const TOTAL_STEPS = 3;
const SEEN_KEY = 'stacked.tutorial.v1';

// The tutorial starts closed (it opens only from Settings › Tutorial), so each test opens it.
function opened() {
  const hook = renderHook(() => useTutorial(TOTAL_STEPS));
  act(() => hook.result.current.open());
  return hook;
}

describe('useTutorial', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('next on the last step closes the tutorial and marks it seen', () => {
    const { result } = opened();
    expect(result.current.visible).toBe(true);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();

    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(TOTAL_STEPS - 1);
    expect(result.current.visible).toBe(true);

    act(() => result.current.next());
    expect(result.current.visible).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(localStorage.getItem(SEEN_KEY)).toBe(JSON.stringify({ seen: true }));
  });

  it('dismiss closes the tutorial and marks it seen', () => {
    const { result } = opened();
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(1);

    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(localStorage.getItem(SEEN_KEY)).toBe(JSON.stringify({ seen: true }));
  });

  it('prev on the first step stays at step 0', () => {
    const { result } = opened();
    expect(result.current.currentStep).toBe(0);

    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.visible).toBe(true);
  });
});
