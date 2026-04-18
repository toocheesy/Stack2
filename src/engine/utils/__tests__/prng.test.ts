import { describe, expect, it } from 'vitest';
import { createPRNG } from '../prng';

describe('createPRNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPRNG(42);
    const b = createPRNG(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createPRNG(1);
    const b = createPRNG(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() yields values in [0, 1)', () => {
    const p = createPRNG(7);
    for (let i = 0; i < 1000; i++) {
      const v = p.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt is within [min, max] inclusive', () => {
    const p = createPRNG(123);
    for (let i = 0; i < 500; i++) {
      const v = p.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('shuffle produces a valid permutation', () => {
    const p = createPRNG(99);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = p.shuffle(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('shuffle does not mutate input', () => {
    const p = createPRNG(5);
    const input = [1, 2, 3, 4, 5];
    const snapshot = input.slice();
    p.shuffle(input);
    expect(input).toEqual(snapshot);
  });

  it('shuffle is deterministic for same seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const s1 = createPRNG(100).shuffle(input);
    const s2 = createPRNG(100).shuffle(input);
    expect(s1).toEqual(s2);
  });

  it('getSeed advances with each call to next', () => {
    const p = createPRNG(1);
    const seed0 = p.getSeed();
    p.next();
    const seed1 = p.getSeed();
    expect(seed0).not.toBe(seed1);
  });
});
