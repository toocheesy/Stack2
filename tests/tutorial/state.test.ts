import { describe, it, expect, beforeEach } from 'vitest';
import { setTutorialSeen } from '../../src/tutorial/tutorialStorage';

// localStorage mock for the Node test environment (same shape as audio tests).
const mockStorage: { [k: string]: string } = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; },
    length: 0,
    key: () => null,
  },
  configurable: true,
});

describe('tutorialStorage', () => {
  beforeEach(() => { (globalThis.localStorage as Storage).clear(); });

  it('writes seen=true under stacked.tutorial.v1', () => {
    setTutorialSeen(true);
    expect((globalThis.localStorage as Storage).getItem('stacked.tutorial.v1')).toBe(JSON.stringify({ seen: true }));
  });

  it('writes seen=false over seen=true', () => {
    setTutorialSeen(true);
    setTutorialSeen(false);
    expect((globalThis.localStorage as Storage).getItem('stacked.tutorial.v1')).toBe(JSON.stringify({ seen: false }));
  });
});

// Honest skip per the ticket: the useTutorial hook (state machine) would
// require @testing-library/react + renderHook to test cleanly. That dep
// isn't in the project. The state-machine logic is small and covered by
// playtest (Skip/Done/Next/Back/Dot-jump). Persistence above is the
// regression guard that matters — if seen=true survives, the overlay
// stays dismissed forever as designed.
