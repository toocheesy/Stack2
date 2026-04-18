import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateStars,
  completeLevel,
  getComboRestrictions,
  getLevelStars,
  getMaxStars,
  getTotalStars,
  getUnlockedBots,
  hasSeenIntro,
  isClassicUnlocked,
  isLevelUnlocked,
  isWorldUnlocked,
  loadProgress,
  markIntroSeen,
  resetProgress,
  saveProgress,
} from '../../../src/engine/adventure/progressManager';

describe('progressManager', () => {
  beforeEach(() => {
    resetProgress();
  });

  it('starts with empty progress, only W1 unlocked', () => {
    const p = loadProgress();
    expect(p.completedLevels).toEqual({});
    expect(p.unlockedWorlds).toEqual([1]);
    expect(p.highestCompleted).toBeNull();
    expect(isWorldUnlocked(1)).toBe(true);
    expect(isWorldUnlocked(2)).toBe(false);
  });

  it('level 1-1 is unlocked from the start', () => {
    expect(isLevelUnlocked('1-1')).toBe(true);
    expect(isLevelUnlocked('1-2')).toBe(false);
  });

  it('completing a level unlocks the next', () => {
    completeLevel('1-1', 1);
    expect(isLevelUnlocked('1-2')).toBe(true);
  });

  it('calculateStars: 1st=3, 2nd=2, 3rd=1', () => {
    expect(calculateStars(1)).toBe(3);
    expect(calculateStars(2)).toBe(2);
    expect(calculateStars(3)).toBe(1);
  });

  it('completing last level of a world unlocks next world', () => {
    completeLevel('1-1', 1);
    completeLevel('1-2', 1);
    expect(isWorldUnlocked(2)).toBe(true);
    expect(isLevelUnlocked('2-1')).toBe(true);
  });

  it('getLevelStars returns saved star count', () => {
    completeLevel('1-1', 2);
    expect(getLevelStars('1-1')).toBe(2);
  });

  it('higher score updates stars; lower score does not', () => {
    completeLevel('1-1', 3);
    expect(getLevelStars('1-1')).toBe(1);
    completeLevel('1-1', 1);
    expect(getLevelStars('1-1')).toBe(3);
    completeLevel('1-1', 2);
    expect(getLevelStars('1-1')).toBe(3);
  });

  it('getTotalStars sums across completed levels', () => {
    completeLevel('1-1', 1);
    completeLevel('1-2', 2);
    expect(getTotalStars()).toBe(5);
  });

  it('getMaxStars = 3 × non-locked level count', () => {
    // W1(2) + W2(3) + W3(3) + W4(4) = 12 unlocked levels → 36 stars
    expect(getMaxStars()).toBe(36);
  });

  it('Classic is locked by default, unlocked after 2-3', () => {
    expect(isClassicUnlocked()).toBe(false);
    completeLevel('1-1', 1);
    completeLevel('1-2', 1);
    completeLevel('2-1', 1);
    completeLevel('2-2', 1);
    expect(isClassicUnlocked()).toBe(false);
    completeLevel('2-3', 1);
    expect(isClassicUnlocked()).toBe(true);
  });

  it('getUnlockedBots grows as worlds are cleared', () => {
    expect(getUnlockedBots()).toContain('calvin');
    completeLevel('1-1', 1);
    completeLevel('1-2', 1);
    completeLevel('2-1', 1);
    completeLevel('2-2', 1);
    completeLevel('2-3', 1);
    expect(getUnlockedBots()).toEqual(
      expect.arrayContaining(['calvin', 'talia']),
    );
    completeLevel('3-1', 1);
    completeLevel('3-2', 1);
    completeLevel('3-3', 1);
    expect(getUnlockedBots()).toEqual(
      expect.arrayContaining(['calvin', 'talia', 'nina']),
    );
    completeLevel('4-1', 1);
    completeLevel('4-2', 1);
    completeLevel('4-3', 1);
    completeLevel('4-4', 1);
    expect(getUnlockedBots()).toEqual(
      expect.arrayContaining(['calvin', 'talia', 'nina', 'rex', 'jett', 'mira']),
    );
  });

  it('getComboRestrictions reflects progress', () => {
    expect(getComboRestrictions()).toEqual(['pairsOnly']);
    completeLevel('1-1', 1);
    completeLevel('1-2', 1);
    completeLevel('2-1', 1);
    expect(getComboRestrictions()).toEqual(['noSum3']);
    completeLevel('2-2', 1);
    expect(getComboRestrictions()).toEqual([]);
  });

  it('introsSeen tracks via markIntroSeen', () => {
    expect(hasSeenIntro(1)).toBe(false);
    markIntroSeen(1);
    expect(hasSeenIntro(1)).toBe(true);
  });

  it('resetProgress clears everything', () => {
    completeLevel('1-1', 1);
    completeLevel('1-2', 1);
    markIntroSeen(2);
    expect(getTotalStars()).toBeGreaterThan(0);
    resetProgress();
    expect(getTotalStars()).toBe(0);
    expect(hasSeenIntro(2)).toBe(false);
    expect(isClassicUnlocked()).toBe(false);
  });

  it('saveProgress + loadProgress roundtrip', () => {
    const p = loadProgress();
    p.introsSeen.push(3);
    p.completedLevels['1-1'] = { stars: 3, placement: 1 };
    saveProgress(p);
    const reloaded = loadProgress();
    expect(reloaded.introsSeen).toContain(3);
    expect(reloaded.completedLevels['1-1'].stars).toBe(3);
  });
});
