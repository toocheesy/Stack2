import { describe, it, expect, beforeEach } from 'vitest';
import { LEVELS, getLevel, getLevelsForWorld } from '../levelConfig';
import {
  getInitialProgress,
  getDefaultProgress,
  calculateStars,
  recordLevelCompletion,
  isLevelUnlocked,
  isWorldUnlocked,
  starsInWorld,
  starsRemainingForWorld,
  getLevelWorld,
  getStarsForLevel,
  saveProgress,
  loadProgress,
  clearProgress,
} from '../progressManager';

// ─── localStorage mock for Node test environment ────
const store = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (_i: number) => null as string | null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

// ─── Level config ───────────────────────────────────

describe('level config', () => {
  it('has exactly 18 levels', () => {
    expect(LEVELS).toHaveLength(18);
  });

  it('each level has correct world assignment (3 per world)', () => {
    for (let world = 1; world <= 6; world++) {
      expect(getLevelsForWorld(world)).toHaveLength(3);
    }
  });

  it('all levels have populated world names', () => {
    for (const level of LEVELS) {
      expect(level.worldName.length).toBeGreaterThan(0);
    }
  });

  it('level IDs are sequential 1-18', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].id).toBe(i + 1);
    }
  });

  it('target scores match the design', () => {
    expect(getLevel(1)!.targetScore).toBe(50);
    expect(getLevel(6)!.targetScore).toBe(200);
    expect(getLevel(12)!.targetScore).toBe(250);
    expect(getLevel(18)!.targetScore).toBe(500);
  });

  it('world 1 is all beginner bots', () => {
    for (const l of getLevelsForWorld(1)) {
      expect(l.bots).toEqual(['beginner', 'beginner']);
    }
  });

  it('world 6 is all advanced bots', () => {
    for (const l of getLevelsForWorld(6)) {
      expect(l.bots).toEqual(['advanced', 'advanced']);
    }
  });
});

// ─── getLevelWorld helper ────────────────────────────

describe('getLevelWorld', () => {
  it('maps levels 1-3 to world 1', () => {
    expect(getLevelWorld(1)).toBe(1);
    expect(getLevelWorld(3)).toBe(1);
  });

  it('maps levels 4-6 to world 2', () => {
    expect(getLevelWorld(4)).toBe(2);
    expect(getLevelWorld(6)).toBe(2);
  });

  it('maps levels 16-18 to world 6', () => {
    expect(getLevelWorld(16)).toBe(6);
    expect(getLevelWorld(18)).toBe(6);
  });
});

// ─── Star calculation (placement-based) ─────────────

describe('calculateStars (placement-based)', () => {
  it('returns 0 when game not completed', () => {
    expect(calculateStars(999, 0, 0, false)).toBe(0);
  });

  it('returns 3 (1st place) when player beats both bots', () => {
    expect(calculateStars(200, 150, 100, true)).toBe(3);
  });

  it('returns 2 (2nd place) when player beats exactly one bot', () => {
    expect(calculateStars(150, 200, 100, true)).toBe(2);
  });

  it('returns 1 (3rd place) when player beats neither bot', () => {
    expect(calculateStars(100, 200, 150, true)).toBe(1);
  });

  it('returns 3 when tied with both bots (not higher)', () => {
    expect(calculateStars(100, 100, 100, true)).toBe(3);
  });

  it('returns 2 when tied with one bot, other is higher', () => {
    expect(calculateStars(100, 200, 100, true)).toBe(2);
  });
});

// ─── Default and initial progress ───────────────────

describe('getDefaultProgress', () => {
  it('returns level 1 unlocked, no stars', () => {
    const p = getDefaultProgress();
    expect(p.unlockedLevels).toEqual([1]);
    expect(p.starsPerLevel).toEqual({});
    expect(p.lastCompleted).toBeNull();
    expect(p.totalStars).toBe(0);
  });
});

describe('getInitialProgress (production)', () => {
  it('returns only level 1 unlocked for new players', () => {
    const p = getInitialProgress();
    expect(p.unlockedLevels).toEqual([1]);
    expect(p.totalStars).toBe(0);
  });
});

// ─── World gate logic ───────────────────────────────

describe('isWorldUnlocked', () => {
  it('World 1 is always unlocked', () => {
    expect(isWorldUnlocked(getDefaultProgress(), 1)).toBe(true);
  });

  it('World 2 is locked with empty progress', () => {
    expect(isWorldUnlocked(getDefaultProgress(), 2)).toBe(false);
  });

  it('World 2 unlocks when World 1 has 9 stars', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 3);
    p = recordLevelCompletion(p, 3, 3);
    expect(isWorldUnlocked(p, 2)).toBe(true);
  });

  it('World 2 stays locked with only 8 stars in World 1', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 2);
    p = recordLevelCompletion(p, 3, 3);
    expect(isWorldUnlocked(p, 2)).toBe(false);
  });
});

describe('starsInWorld', () => {
  it('returns 0 for empty progress', () => {
    expect(starsInWorld(getDefaultProgress(), 1)).toBe(0);
  });

  it('sums stars for levels in the given world', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 2);
    p = recordLevelCompletion(p, 3, 3);
    expect(starsInWorld(p, 1)).toBe(8);
  });

  it('returns 9 when all world levels have 3 stars', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 3);
    p = recordLevelCompletion(p, 3, 3);
    expect(starsInWorld(p, 1)).toBe(9);
  });
});

describe('starsRemainingForWorld', () => {
  it('returns 0 for World 1', () => {
    expect(starsRemainingForWorld(getDefaultProgress(), 1)).toBe(0);
  });

  it('returns 9 for World 2 with empty progress', () => {
    expect(starsRemainingForWorld(getDefaultProgress(), 2)).toBe(9);
  });

  it('decreases as prior world earns stars', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 3);
    expect(starsRemainingForWorld(p, 2)).toBe(3); // 9 - 6
  });
});

// ─── recordLevelCompletion ──────────────────────────

describe('recordLevelCompletion', () => {
  it('0 stars returns progress unchanged', () => {
    const p = getDefaultProgress();
    const next = recordLevelCompletion(p, 1, 0);
    expect(next).toBe(p);
  });

  it('2+ stars unlocks next level in same world', () => {
    const p = getDefaultProgress();
    const next = recordLevelCompletion(p, 1, 2);
    expect(next.unlockedLevels).toContain(2);
  });

  it('1 star does NOT unlock next level', () => {
    const p = getDefaultProgress();
    const next = recordLevelCompletion(p, 1, 1);
    expect(next.unlockedLevels).not.toContain(2);
    expect(next.starsPerLevel[1]).toBe(1);
    expect(next.lastCompleted).toBe(1);
  });

  it('does NOT unlock across world boundary via 2-star alone', () => {
    let p = getDefaultProgress();
    p = { ...p, unlockedLevels: [1, 2, 3] };
    p = recordLevelCompletion(p, 3, 2); // Level 3 is last in World 1
    // Level 4 is World 2 — should NOT unlock because world gate not satisfied
    expect(p.unlockedLevels).not.toContain(4);
  });

  it('3-starring all of World 1 unlocks first level of World 2', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 3);
    p = recordLevelCompletion(p, 3, 3);
    expect(starsInWorld(p, 1)).toBe(9);
    expect(p.unlockedLevels).toContain(4); // first level of World 2
  });

  it('mix of stars (3,2,3 = 8 total) does NOT unlock World 2', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 2);
    p = recordLevelCompletion(p, 3, 3);
    expect(starsInWorld(p, 1)).toBe(8);
    expect(p.unlockedLevels).not.toContain(4);
  });

  it('keeps highest stars on replay', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 1, 1);
    expect(p.starsPerLevel[1]).toBe(3);
  });

  it('does NOT unlock past level 18', () => {
    let p = getInitialProgress();
    const next = recordLevelCompletion(p, 18, 3);
    expect(next.unlockedLevels).not.toContain(19);
  });

  it('accumulates totalStars correctly', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 2);
    expect(p.totalStars).toBe(5);
  });
});

// ─── isLevelUnlocked ────────────────────────────────

describe('isLevelUnlocked (production)', () => {
  it('Level 1 is always unlocked', () => {
    expect(isLevelUnlocked(getDefaultProgress(), 1)).toBe(true);
  });

  it('Level 2 is locked for new players', () => {
    expect(isLevelUnlocked(getDefaultProgress(), 2)).toBe(false);
  });

  it('level in locked world returns false even if in unlockedLevels', () => {
    const p: ReturnType<typeof getDefaultProgress> = {
      unlockedLevels: [1, 4], // Level 4 is World 2
      starsPerLevel: {},
      lastCompleted: null,
      totalStars: 0,
    };
    expect(isLevelUnlocked(p, 4)).toBe(false); // World 2 not unlocked
  });
});

describe('getStarsForLevel', () => {
  it('returns 0 for never-completed levels', () => {
    expect(getStarsForLevel(getDefaultProgress(), 5)).toBe(0);
  });

  it('returns recorded stars', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 2);
    expect(getStarsForLevel(p, 1)).toBe(2);
  });
});

// ─── localStorage persistence ───────────────────────

describe('localStorage persistence', () => {
  beforeEach(() => { store.clear(); });

  it('saveProgress + loadProgress round-trip preserves data', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    saveProgress(p);
    const loaded = loadProgress();
    expect(loaded.starsPerLevel).toEqual(p.starsPerLevel);
    expect(loaded.lastCompleted).toBe(p.lastCompleted);
    expect(loaded.totalStars).toBe(p.totalStars);
  });

  it('loadProgress returns initial state when nothing saved', () => {
    const p = loadProgress();
    expect(p.lastCompleted).toBeNull();
  });

  it('loadProgress returns initial state when corrupt', () => {
    localStorage.setItem('stacked_v2_adventure_progress', '{bad');
    expect(loadProgress().lastCompleted).toBeNull();
  });

  it('clearProgress wipes saved data', () => {
    saveProgress(recordLevelCompletion(getDefaultProgress(), 1, 3));
    clearProgress();
    expect(loadProgress().lastCompleted).toBeNull();
  });

  it('does not crash when localStorage throws', () => {
    const orig = { ...mockStorage };
    mockStorage.setItem = () => { throw new Error(); };
    mockStorage.getItem = () => { throw new Error(); };
    mockStorage.removeItem = () => { throw new Error(); };
    expect(() => saveProgress(getDefaultProgress())).not.toThrow();
    expect(() => loadProgress()).not.toThrow();
    expect(() => clearProgress()).not.toThrow();
    mockStorage.setItem = orig.setItem;
    mockStorage.getItem = orig.getItem;
    mockStorage.removeItem = orig.removeItem;
  });
});
