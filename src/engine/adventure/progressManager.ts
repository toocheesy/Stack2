import { TOTAL_LEVELS, TOTAL_WORLDS, LEVELS_PER_WORLD } from './levelConfig';

const DEV_UNLOCK_ALL = false;

const STORAGE_KEY = 'stacked_v2_adventure_progress';
const JETT_UNLOCK_KEY = 'stacked_v2_jett_unlocked_classic';
const STARS_PER_WORLD = LEVELS_PER_WORLD * 3; // 9
const FINAL_LEVEL_ID = TOTAL_LEVELS; // 12 — beating this unlocks Jett in Classic

export interface AdventureProgress {
  unlockedLevels: number[];
  starsPerLevel: Record<number, 0 | 1 | 2 | 3>;
  lastCompleted: number | null;
  totalStars: number;
}

// ─── Helpers ────────────────────────────────────────

export function getLevelWorld(levelId: number): number {
  return Math.ceil(levelId / LEVELS_PER_WORLD);
}

function firstLevelOfWorld(worldId: number): number {
  return (worldId - 1) * LEVELS_PER_WORLD + 1;
}

// ─── Star calculation (placement-based) ─────────────

export function calculateStars(
  playerScore: number,
  bot1Score: number,
  bot2Score: number,
  gameCompleted: boolean,
): 0 | 1 | 2 | 3 {
  if (!gameCompleted) return 0;
  const higher = [bot1Score, bot2Score].filter((s) => s > playerScore).length;
  if (higher === 0) return 3; // 1st place
  if (higher === 1) return 2; // 2nd place
  return 1; // 3rd place
}

// ─── World gate logic ───────────────────────────────

export function starsInWorld(progress: AdventureProgress, worldId: number): number {
  const first = firstLevelOfWorld(worldId);
  let total = 0;
  for (let i = 0; i < LEVELS_PER_WORLD; i++) {
    total += progress.starsPerLevel[first + i] ?? 0;
  }
  return total;
}

export function isWorldUnlocked(progress: AdventureProgress, worldId: number): boolean {
  if (DEV_UNLOCK_ALL) return true;
  if (worldId === 1) return true;
  return starsInWorld(progress, worldId - 1) === STARS_PER_WORLD;
}

export function starsRemainingForWorld(progress: AdventureProgress, worldId: number): number {
  if (worldId === 1) return 0;
  return Math.max(0, STARS_PER_WORLD - starsInWorld(progress, worldId - 1));
}

// ─── Initial / default progress ─────────────────────

export function getDefaultProgress(): AdventureProgress {
  return {
    unlockedLevels: [1],
    starsPerLevel: {},
    lastCompleted: null,
    totalStars: 0,
  };
}

export function getInitialProgress(): AdventureProgress {
  if (DEV_UNLOCK_ALL) {
    return {
      unlockedLevels: Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1),
      starsPerLevel: {},
      lastCompleted: null,
      totalStars: 0,
    };
  }
  return getDefaultProgress();
}

// ─── Level unlock check ─────────────────────────────

export function isLevelUnlocked(
  progress: AdventureProgress,
  levelId: number,
): boolean {
  if (DEV_UNLOCK_ALL) return true;
  if (!progress.unlockedLevels.includes(levelId)) return false;
  return isWorldUnlocked(progress, getLevelWorld(levelId));
}

export function getStarsForLevel(
  progress: AdventureProgress,
  levelId: number,
): 0 | 1 | 2 | 3 {
  return progress.starsPerLevel[levelId] ?? 0;
}

// ─── Record completion ──────────────────────────────

export function recordLevelCompletion(
  progress: AdventureProgress,
  levelId: number,
  stars: 0 | 1 | 2 | 3,
): AdventureProgress {
  if (stars === 0) return progress;

  const starsPerLevel = { ...progress.starsPerLevel };
  const prev = starsPerLevel[levelId] ?? 0;
  if (stars > prev) {
    starsPerLevel[levelId] = stars;
  }

  const unlockedLevels = progress.unlockedLevels.slice();

  // Same-world unlock: 2+ stars unlocks next level in same world
  if (stars >= 2) {
    const nextLevel = levelId + 1;
    const sameWorld = getLevelWorld(nextLevel) === getLevelWorld(levelId);
    if (sameWorld && nextLevel <= TOTAL_LEVELS && !unlockedLevels.includes(nextLevel)) {
      unlockedLevels.push(nextLevel);
    }
  }

  const tempProgress: AdventureProgress = { ...progress, starsPerLevel, unlockedLevels };

  // World-gate unlock: 9 stars in current world unlocks first level of next world
  const currentWorld = getLevelWorld(levelId);
  const nextWorldId = currentWorld + 1;
  if (nextWorldId <= TOTAL_WORLDS) {
    if (starsInWorld(tempProgress, currentWorld) === STARS_PER_WORLD) {
      const firstOfNext = firstLevelOfWorld(nextWorldId);
      if (!unlockedLevels.includes(firstOfNext)) {
        unlockedLevels.push(firstOfNext);
      }
    }
  }

  let totalStars = 0;
  for (const s of Object.values(starsPerLevel)) {
    totalStars += s;
  }

  return {
    unlockedLevels,
    starsPerLevel,
    lastCompleted: levelId,
    totalStars,
  };
}

// ─── Jett Classic-mode unlock gate ──────────────────

export function isJettUnlockedInClassic(): boolean {
  try {
    return localStorage.getItem(JETT_UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function unlockJettInClassic(): void {
  try {
    localStorage.setItem(JETT_UNLOCK_KEY, 'true');
  } catch {
    // ignore
  }
}

export function clearJettUnlock(): void {
  try {
    localStorage.removeItem(JETT_UNLOCK_KEY);
  } catch {
    // ignore
  }
}

export function isFinalLevel(levelId: number): boolean {
  return levelId === FINAL_LEVEL_ID;
}

// ─── localStorage persistence ───────────────────────

export function saveProgress(progress: AdventureProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage full or unavailable
  }
}

function isOldSchema(parsed: Partial<AdventureProgress>): boolean {
  if (parsed.unlockedLevels?.some((l) => l > TOTAL_LEVELS)) return true;
  for (const k of Object.keys(parsed.starsPerLevel ?? {})) {
    if (parseInt(k, 10) > TOTAL_LEVELS) return true;
  }
  if ((parsed.lastCompleted ?? 0) > TOTAL_LEVELS) return true;
  return false;
}

export function loadProgress(): AdventureProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialProgress();
    const parsed = JSON.parse(raw) as Partial<AdventureProgress>;
    if (!parsed.unlockedLevels || !Array.isArray(parsed.unlockedLevels)) {
      return getInitialProgress();
    }
    if (isOldSchema(parsed)) {
      // Old 18-level / 6-world progress detected — reset per ticket spec.
      console.warn('[Adventure] Old 18-level progress detected; resetting to new 12-level schema.');
      const fresh = getInitialProgress();
      saveProgress(fresh);
      return fresh;
    }
    return {
      unlockedLevels: parsed.unlockedLevels,
      starsPerLevel: parsed.starsPerLevel ?? {},
      lastCompleted: parsed.lastCompleted ?? null,
      totalStars: parsed.totalStars ?? 0,
    };
  } catch {
    return getInitialProgress();
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Language rename pass — entry-verb hierarchy for the home-screen Run card.
// Three states derived from the in-storage progress:
//   - 'fresh'        → no save in localStorage             → BEGIN
//   - 'in-progress'  → save exists, < 12 levels completed  → RESUME
//   - 'complete'     → save exists, all 12 levels with ≥1 star → NEW RUN
export type RunStatus = 'fresh' | 'in-progress' | 'complete';

export function getRunStatus(): RunStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'fresh';
    const parsed = JSON.parse(raw) as Partial<AdventureProgress>;
    const stars = parsed.starsPerLevel ?? {};
    let completed = 0;
    for (let id = 1; id <= TOTAL_LEVELS; id++) {
      if ((stars[id] ?? 0) > 0) completed++;
    }
    return completed >= TOTAL_LEVELS ? 'complete' : 'in-progress';
  } catch {
    return 'fresh';
  }
}
