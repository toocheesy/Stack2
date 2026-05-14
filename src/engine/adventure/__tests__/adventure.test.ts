import { describe, it, expect, beforeEach } from 'vitest';
import {
  LEVELS,
  TOTAL_LEVELS,
  TOTAL_WORLDS,
  LEVELS_PER_WORLD,
  getLevel,
  getLevelsForWorld,
  getDisplayId,
  getWorldName,
} from '../levelConfig';
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
  isJettUnlockedInClassic,
  unlockJettInClassic,
  clearJettUnlock,
  isFinalLevel,
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
  it('exposes 12 total levels across 4 worlds × 3 levels', () => {
    expect(TOTAL_LEVELS).toBe(12);
    expect(TOTAL_WORLDS).toBe(4);
    expect(LEVELS_PER_WORLD).toBe(3);
    expect(LEVELS).toHaveLength(12);
  });

  it('each world has exactly 3 levels', () => {
    for (let world = 1; world <= TOTAL_WORLDS; world++) {
      expect(getLevelsForWorld(world)).toHaveLength(3);
    }
  });

  it('all levels have populated world names', () => {
    for (const level of LEVELS) {
      expect(level.worldName.length).toBeGreaterThan(0);
    }
  });

  it('level IDs are sequential 1-12', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].id).toBe(i + 1);
    }
  });

  it('every level has a displayId in W-L format', () => {
    for (const level of LEVELS) {
      expect(level.displayId).toBe(`${level.world}-${level.levelInWorld}`);
    }
  });

  it('getDisplayId returns the correct W-L label', () => {
    expect(getDisplayId(1)).toBe('1-1');
    expect(getDisplayId(6)).toBe('2-3');
    expect(getDisplayId(12)).toBe('4-3');
  });

  it('getWorldName returns the named worlds', () => {
    expect(getWorldName(1)).toBe('The Basics');
    expect(getWorldName(2)).toBe('Sharper Play');
    expect(getWorldName(3)).toBe('The Hunter');
    expect(getWorldName(4)).toBe('The Endgame');
  });

  it('target scores match the locked design', () => {
    expect(getLevel(1)!.targetScore).toBe(100);
    expect(getLevel(2)!.targetScore).toBe(150);
    expect(getLevel(3)!.targetScore).toBe(200);
    expect(getLevel(4)!.targetScore).toBe(200);
    expect(getLevel(5)!.targetScore).toBe(250);
    expect(getLevel(6)!.targetScore).toBe(300);
    expect(getLevel(7)!.targetScore).toBe(250);
    expect(getLevel(8)!.targetScore).toBe(300);
    expect(getLevel(9)!.targetScore).toBe(400);
    expect(getLevel(10)!.targetScore).toBe(300);
    expect(getLevel(11)!.targetScore).toBe(350);
    expect(getLevel(12)!.targetScore).toBe(400);
  });

  it('W1 is Calvin + Calvin throughout', () => {
    for (const l of getLevelsForWorld(1)) {
      expect(l.bots).toEqual(['beginner', 'beginner']);
    }
  });

  it('W2 introduces Nina (mixed then full)', () => {
    expect(getLevel(4)!.bots).toEqual(['beginner', 'intermediate']);
    expect(getLevel(5)!.bots).toEqual(['intermediate', 'intermediate']);
    expect(getLevel(6)!.bots).toEqual(['intermediate', 'intermediate']);
  });

  it('W3 introduces Rex (mixed then full)', () => {
    expect(getLevel(7)!.bots).toEqual(['intermediate', 'advanced']);
    expect(getLevel(8)!.bots).toEqual(['advanced', 'advanced']);
    expect(getLevel(9)!.bots).toEqual(['advanced', 'advanced']);
  });

  it('W4 introduces Jett (always paired, never solo Jett+Jett)', () => {
    expect(getLevel(10)!.bots).toEqual(['advanced', 'expert']);
    expect(getLevel(11)!.bots).toEqual(['intermediate', 'expert']);
    expect(getLevel(12)!.bots).toEqual(['advanced', 'expert']);
    for (const l of getLevelsForWorld(4)) {
      expect(l.bots).toContain('expert');
    }
  });

  it('hint strip ON for W1+W2, OFF for W3+W4', () => {
    for (const l of [...getLevelsForWorld(1), ...getLevelsForWorld(2)]) {
      expect(l.hintStripEnabled).toBe(true);
    }
    for (const l of [...getLevelsForWorld(3), ...getLevelsForWorld(4)]) {
      expect(l.hintStripEnabled).toBe(false);
    }
  });

  it('turn-order swap is disabled on every Adventure level', () => {
    for (const l of LEVELS) {
      expect(l.turnOrderSwap).toBe(false);
    }
  });

  it('Jett (expert) only appears in W4', () => {
    for (const l of LEVELS) {
      const hasJett = l.bots.includes('expert');
      if (l.world === 4) expect(hasJett).toBe(true);
      else expect(hasJett).toBe(false);
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

  it('maps levels 7-9 to world 3', () => {
    expect(getLevelWorld(7)).toBe(3);
    expect(getLevelWorld(9)).toBe(3);
  });

  it('maps levels 10-12 to world 4', () => {
    expect(getLevelWorld(10)).toBe(4);
    expect(getLevelWorld(12)).toBe(4);
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

  it('World 4 unlocks only when World 3 has 9 stars', () => {
    let p = getDefaultProgress();
    // 3-star W1, W2, W3
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      p = recordLevelCompletion(p, id, 3);
    }
    expect(isWorldUnlocked(p, 4)).toBe(true);
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
    p = recordLevelCompletion(p, 3, 2); // Last level of W1
    // Level 4 is W2 — should NOT unlock; world gate not satisfied
    expect(p.unlockedLevels).not.toContain(4);
  });

  it('3-starring all of World 1 unlocks first level of World 2', () => {
    let p = getDefaultProgress();
    p = recordLevelCompletion(p, 1, 3);
    p = recordLevelCompletion(p, 2, 3);
    p = recordLevelCompletion(p, 3, 3);
    expect(starsInWorld(p, 1)).toBe(9);
    expect(p.unlockedLevels).toContain(4); // first level of W2
  });

  it('3-starring all of World 3 unlocks first level of World 4', () => {
    let p = getDefaultProgress();
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      p = recordLevelCompletion(p, id, 3);
    }
    expect(p.unlockedLevels).toContain(10);
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

  it('does NOT unlock past level 12', () => {
    let p = getInitialProgress();
    const next = recordLevelCompletion(p, 12, 3);
    expect(next.unlockedLevels).not.toContain(13);
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
      unlockedLevels: [1, 4], // Level 4 is W2
      starsPerLevel: {},
      lastCompleted: null,
      totalStars: 0,
    };
    expect(isLevelUnlocked(p, 4)).toBe(false);
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

// ─── Jett Classic-mode unlock gate ──────────────────

describe('Jett Classic-mode unlock gate', () => {
  beforeEach(() => { store.clear(); });

  it('isJettUnlockedInClassic returns false by default', () => {
    expect(isJettUnlockedInClassic()).toBe(false);
  });

  it('unlockJettInClassic flips the gate to true', () => {
    expect(isJettUnlockedInClassic()).toBe(false);
    unlockJettInClassic();
    expect(isJettUnlockedInClassic()).toBe(true);
  });

  it('clearJettUnlock removes the flag', () => {
    unlockJettInClassic();
    expect(isJettUnlockedInClassic()).toBe(true);
    clearJettUnlock();
    expect(isJettUnlockedInClassic()).toBe(false);
  });

  it('isFinalLevel identifies W4 L3 only', () => {
    expect(isFinalLevel(12)).toBe(true);
    expect(isFinalLevel(11)).toBe(false);
    expect(isFinalLevel(1)).toBe(false);
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

// ─── Old-schema migration ───────────────────────────

describe('old-schema migration (18-level → 12-level reset)', () => {
  beforeEach(() => { store.clear(); });

  it('resets when stored unlockedLevels reference levels > 12', () => {
    const oldShape = {
      unlockedLevels: [1, 2, 3, 4, 5, 13, 14],
      starsPerLevel: { 1: 3, 13: 2, 18: 3 },
      lastCompleted: 18,
      totalStars: 25,
    };
    localStorage.setItem('stacked_v2_adventure_progress', JSON.stringify(oldShape));
    const warn = console.warn;
    let warned = false;
    console.warn = () => { warned = true; };
    const loaded = loadProgress();
    console.warn = warn;
    expect(warned).toBe(true);
    expect(loaded.unlockedLevels).toEqual([1]);
    expect(loaded.starsPerLevel).toEqual({});
    expect(loaded.lastCompleted).toBeNull();
    expect(loaded.totalStars).toBe(0);
  });

  it('resets when starsPerLevel keys reference levels > 12', () => {
    const oldShape = {
      unlockedLevels: [1],
      starsPerLevel: { 15: 3 },
      lastCompleted: null,
      totalStars: 3,
    };
    localStorage.setItem('stacked_v2_adventure_progress', JSON.stringify(oldShape));
    const warn = console.warn;
    console.warn = () => {};
    const loaded = loadProgress();
    console.warn = warn;
    expect(loaded.starsPerLevel).toEqual({});
  });

  it('keeps valid 12-level data untouched', () => {
    const validShape = {
      unlockedLevels: [1, 2, 3, 4],
      starsPerLevel: { 1: 3, 2: 3, 3: 3 },
      lastCompleted: 3,
      totalStars: 9,
    };
    localStorage.setItem('stacked_v2_adventure_progress', JSON.stringify(validShape));
    const loaded = loadProgress();
    expect(loaded.unlockedLevels).toEqual([1, 2, 3, 4]);
    expect(loaded.totalStars).toBe(9);
  });
});
