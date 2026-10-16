import { describe, expect, it } from 'vitest';
import { BOT_STREAM_SALT, botStreamSeed, createPRNG } from '../../../src/engine/utils/prng';

// S-006: a stream's getSeed() is its current internal state, and
// createPRNG(thatState) continues the stream exactly. CC-011 saves these.
describe('PRNG save and resume', () => {
  it('getSeed() starts at the seed and moves with every draw', () => {
    const p = createPRNG(42);
    expect(p.getSeed()).toBe(42);
    p.next();
    expect(p.getSeed()).not.toBe(42);
  });

  it('a stream recreated from getSeed() gives the same next draws', () => {
    const original = createPRNG(42);
    for (let i = 0; i < 7; i++) original.next();
    const saved = original.getSeed();
    const resumed = createPRNG(saved);

    const fromOriginal = Array.from({ length: 20 }, () => original.next());
    const fromResumed = Array.from({ length: 20 }, () => resumed.next());
    expect(fromResumed).toEqual(fromOriginal);

    expect(resumed.nextInt(0, 2)).toBe(original.nextInt(0, 2));
    const cards = ['AS', '2H', '3D', '4C', '5S', '6H'];
    expect(resumed.shuffle(cards)).toEqual(original.shuffle(cards));
    expect(resumed.getSeed()).toBe(original.getSeed());
  });
});

describe('botStreamSeed', () => {
  it('is fixed and differs from the game seed', () => {
    for (let seed = 0; seed <= 100; seed++) {
      expect(botStreamSeed(seed)).toBe(botStreamSeed(seed));
      expect(botStreamSeed(seed)).not.toBe(seed);
      expect(botStreamSeed(seed)).toBe((seed ^ BOT_STREAM_SALT) >>> 0);
    }
  });

  it('starts a different stream from the deal stream', () => {
    const deal = createPRNG(7);
    const bots = createPRNG(botStreamSeed(7));
    const a = Array.from({ length: 5 }, () => deal.next());
    const b = Array.from({ length: 5 }, () => bots.next());
    expect(a).not.toEqual(b);
  });
});
