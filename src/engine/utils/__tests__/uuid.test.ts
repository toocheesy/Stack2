import { describe, expect, it } from 'vitest';
import { createPRNG } from '../prng';
import { createIdGenerator } from '../uuid';

describe('createIdGenerator', () => {
  it('generates card IDs in the correct format', () => {
    const gen = createIdGenerator(createPRNG(1));
    const id = gen.generateCardId();
    expect(id).toMatch(/^card_[0-9a-f]{6}$/);
  });

  it('generates player IDs in the correct format', () => {
    const gen = createIdGenerator(createPRNG(2));
    expect(gen.generatePlayerId()).toMatch(/^player_[0-9a-f]{6}$/);
  });

  it('generates game IDs in the correct format', () => {
    const gen = createIdGenerator(createPRNG(3));
    expect(gen.generateGameId()).toMatch(/^game_[0-9a-f]{6}$/);
  });

  it('is deterministic for the same seed', () => {
    const a = createIdGenerator(createPRNG(42));
    const b = createIdGenerator(createPRNG(42));
    const seqA = Array.from({ length: 10 }, () => a.generateCardId());
    const seqB = Array.from({ length: 10 }, () => b.generateCardId());
    expect(seqA).toEqual(seqB);
  });

  it('produces different ID sequences for different seeds', () => {
    const a = createIdGenerator(createPRNG(1));
    const b = createIdGenerator(createPRNG(2));
    expect(a.generateCardId()).not.toBe(b.generateCardId());
  });

  it('produces high uniqueness across many IDs from same generator', () => {
    const gen = createIdGenerator(createPRNG(7));
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) ids.add(gen.generateCardId());
    expect(ids.size).toBeGreaterThan(490);
  });
});
