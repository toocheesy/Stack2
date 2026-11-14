import { describe, it, expect, beforeEach } from 'vitest';
import { setTutorialSeen } from '../../src/tutorial/tutorialStorage';

// localStorage mock for the Node test environment.
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
