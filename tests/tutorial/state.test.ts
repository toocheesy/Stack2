import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTutorialSeen,
  setTutorialSeen,
} from '../../src/tutorial/tutorialStorage';

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

  it('returns false when the key is absent (graceful default)', () => {
    expect(loadTutorialSeen()).toBe(false);
  });

  it('round-trips seen=true through save/load', () => {
    setTutorialSeen(true);
    expect(loadTutorialSeen()).toBe(true);
  });

  it('round-trips seen=false through save/load', () => {
    setTutorialSeen(true);
    expect(loadTutorialSeen()).toBe(true);
    setTutorialSeen(false);
    expect(loadTutorialSeen()).toBe(false);
  });

  it('returns false on malformed JSON in the key', () => {
    (globalThis.localStorage as Storage).setItem('stacked.tutorial.v1', '{bad');
    expect(loadTutorialSeen()).toBe(false);
  });
});

// Honest skip per the ticket: the useTutorial hook (state machine) would
// require @testing-library/react + renderHook to test cleanly. That dep
// isn't in the project. The state-machine logic is small and covered by
// playtest (Skip/Done/Next/Back/Dot-jump). Persistence above is the
// regression guard that matters — if seen=true survives, the overlay
// stays dismissed forever as designed.
