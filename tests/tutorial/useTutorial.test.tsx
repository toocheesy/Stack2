// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTutorial } from '../../src/tutorial/useTutorial';
import { loadTutorialSeen } from '../../src/tutorial/tutorialStorage';

const TOTAL_STEPS = 3;

describe('useTutorial', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('next on the last step closes the tutorial and marks it seen', () => {
    const { result } = renderHook(() => useTutorial(TOTAL_STEPS, true));
    expect(result.current.visible).toBe(true);
    expect(loadTutorialSeen()).toBe(false);

    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(TOTAL_STEPS - 1);
    expect(result.current.visible).toBe(true);

    act(() => result.current.next());
    expect(result.current.visible).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(loadTutorialSeen()).toBe(true);
  });

  it('dismiss closes the tutorial and marks it seen', () => {
    const { result } = renderHook(() => useTutorial(TOTAL_STEPS, true));
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(1);

    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
    expect(result.current.currentStep).toBe(0);
    expect(loadTutorialSeen()).toBe(true);
  });

  it('prev on the first step stays at step 0', () => {
    const { result } = renderHook(() => useTutorial(TOTAL_STEPS, true));
    expect(result.current.currentStep).toBe(0);

    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.visible).toBe(true);
  });
});
