import { describe, expect, it } from 'vitest';
import {
  getAllLevels,
  getAllWorlds,
  getLevel,
  getNextLevel,
  getPreviousLevelId,
  getWorld,
  getWorldIntro,
  isWorldLocked,
} from '../../../src/engine/adventure/levelConfig';

describe('levelConfig', () => {
  it('has 6 worlds', () => {
    expect(getAllWorlds()).toHaveLength(6);
  });

  it('has 18 levels total (W1:2 + W2:3 + W3:3 + W4:4 + W5:3 + W6:3)', () => {
    expect(getAllLevels()).toHaveLength(18);
  });

  it('getLevel returns a valid level by id', () => {
    const l = getLevel('2-3');
    expect(l).not.toBeNull();
    expect(l!.worldId).toBe(2);
    expect(l!.name).toBe('Full Power');
  });

  it('getLevel returns null for unknown id', () => {
    expect(getLevel('99-99')).toBeNull();
  });

  it('getWorld returns null for unknown id', () => {
    expect(getWorld(42)).toBeNull();
  });

  it('getNextLevel walks sequentially', () => {
    expect(getNextLevel('1-1')).toBe('1-2');
    expect(getNextLevel('1-2')).toBe('2-1');
    expect(getNextLevel('2-3')).toBe('3-1');
  });

  it('getNextLevel returns null at the final level', () => {
    const last = getAllLevels()[getAllLevels().length - 1];
    expect(getNextLevel(last.id)).toBeNull();
  });

  it('getPreviousLevelId returns null for 1-1', () => {
    expect(getPreviousLevelId('1-1')).toBeNull();
  });

  it('World 1 levels have pairsOnly restriction', () => {
    expect(getLevel('1-1')!.restrictions).toContain('pairsOnly');
    expect(getLevel('1-2')!.restrictions).toContain('pairsOnly');
  });

  it('World 5 and 6 are locked', () => {
    expect(isWorldLocked(5)).toBe(true);
    expect(isWorldLocked(6)).toBe(true);
    expect(isWorldLocked(1)).toBe(false);
    expect(isWorldLocked(4)).toBe(false);
  });

  it('World intros are defined for W1-W4', () => {
    expect(getWorldIntro(1)).not.toBeNull();
    expect(getWorldIntro(2)).not.toBeNull();
    expect(getWorldIntro(3)).not.toBeNull();
    expect(getWorldIntro(4)).not.toBeNull();
  });
});
