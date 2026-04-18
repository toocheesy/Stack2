import type { PersonalityKey } from '../../shared/personalities';
import {
  getAllLevels,
  getAllWorlds,
  getLevel,
  getPreviousLevelId,
  getWorld,
  type ComboRestriction,
  type LevelConfig,
} from './levelConfig';

const STORAGE_KEY = 'stacked.adventure.progress.v1';

function isDevUnlockAll(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as unknown as Record<string, unknown>).__DEV_UNLOCK_ALL) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('unlock') === 'all') return true;
  } catch {
    // ignore
  }
  return false;
}

export interface CompletedLevelEntry {
  stars: number;
  placement: number;
}

export interface AdventureProgressState {
  completedLevels: Record<string, CompletedLevelEntry>;
  unlockedWorlds: number[];
  highestCompleted: string | null;
  introsSeen: number[];
}

export interface Unlock {
  type: 'level' | 'world' | 'classic' | 'bot';
  id: string;
}

export interface CompleteLevelResult {
  stars: number;
  unlocks: Unlock[];
}

const memoryStore = new Map<string, string>();

interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

function getStorage(): StorageAdapter {
  if (typeof localStorage !== 'undefined') {
    try {
      return {
        get: (k) => localStorage.getItem(k),
        set: (k, v) => localStorage.setItem(k, v),
        remove: (k) => localStorage.removeItem(k),
      };
    } catch {
      // fall through to memory store
    }
  }
  return {
    get: (k) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    set: (k, v) => {
      memoryStore.set(k, v);
    },
    remove: (k) => {
      memoryStore.delete(k);
    },
  };
}

function emptyState(): AdventureProgressState {
  return {
    completedLevels: {},
    unlockedWorlds: [1],
    highestCompleted: null,
    introsSeen: [],
  };
}

export function loadProgress(): AdventureProgressState {
  const storage = getStorage();
  const raw = storage.get(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as Partial<AdventureProgressState>;
    return {
      completedLevels: parsed.completedLevels ?? {},
      unlockedWorlds: parsed.unlockedWorlds ?? [1],
      highestCompleted: parsed.highestCompleted ?? null,
      introsSeen: parsed.introsSeen ?? [],
    };
  } catch {
    return emptyState();
  }
}

export function saveProgress(progress: AdventureProgressState): void {
  const storage = getStorage();
  try {
    storage.set(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}

export function resetProgress(): void {
  const storage = getStorage();
  storage.remove(STORAGE_KEY);
}

export function calculateStars(placement: number): number {
  if (placement <= 1) return 3;
  if (placement === 2) return 2;
  return 1;
}

export function completeLevel(
  levelId: string,
  placement: number,
): CompleteLevelResult {
  const level = getLevel(levelId);
  if (!level || level.locked) return { stars: 0, unlocks: [] };

  const stars = calculateStars(placement);
  const progress = loadProgress();
  const prev = progress.completedLevels[levelId];
  if (!prev || stars > prev.stars) {
    progress.completedLevels[levelId] = { stars, placement };
  }

  const unlocks: Unlock[] = [];
  const previousHighestIndex = progress.highestCompleted
    ? getAllLevels().findIndex((l) => l.id === progress.highestCompleted)
    : -1;
  const thisIndex = getAllLevels().findIndex((l) => l.id === levelId);
  if (thisIndex > previousHighestIndex) {
    progress.highestCompleted = levelId;
  }

  const world = getWorld(level.worldId);
  if (world) {
    const lastInWorld = world.levels[world.levels.length - 1];
    if (lastInWorld.id === levelId) {
      const nextWorldId = level.worldId + 1;
      const nextWorld = getWorld(nextWorldId);
      if (
        nextWorld &&
        !nextWorld.levels.every((l) => l.locked) &&
        !progress.unlockedWorlds.includes(nextWorldId)
      ) {
        progress.unlockedWorlds.push(nextWorldId);
        unlocks.push({ type: 'world', id: String(nextWorldId) });
      }
    }
  }

  if (levelId === '2-3' && (!prev || !hasClassicBefore(progress))) {
    unlocks.push({ type: 'classic', id: 'classic' });
  }

  saveProgress(progress);
  return { stars, unlocks };
}

function hasClassicBefore(progress: AdventureProgressState): boolean {
  return Boolean(progress.completedLevels['2-3']);
}

export function isLevelCompleted(levelId: string): boolean {
  return Boolean(loadProgress().completedLevels[levelId]);
}

export function isLevelUnlocked(levelId: string): boolean {
  if (isDevUnlockAll()) return true;
  const level = getLevel(levelId);
  if (!level || level.locked) return false;
  const prev = getPreviousLevelId(levelId);
  if (!prev) return true;
  return isLevelCompleted(prev);
}

export function isWorldUnlocked(worldId: number): boolean {
  if (isDevUnlockAll()) return true;
  const world = getWorld(worldId);
  if (!world) return false;
  if (world.levels.every((l) => l.locked)) return false;
  return loadProgress().unlockedWorlds.includes(worldId);
}

export function getLevelStars(levelId: string): number {
  return loadProgress().completedLevels[levelId]?.stars ?? 0;
}

export function getTotalStars(): number {
  const progress = loadProgress();
  let total = 0;
  for (const entry of Object.values(progress.completedLevels)) {
    total += entry.stars;
  }
  return total;
}

export function getMaxStars(): number {
  return getAllLevels().filter((l) => !l.locked).length * 3;
}

export function hasSeenIntro(worldId: number): boolean {
  return loadProgress().introsSeen.includes(worldId);
}

export function markIntroSeen(worldId: number): void {
  const progress = loadProgress();
  if (!progress.introsSeen.includes(worldId)) {
    progress.introsSeen.push(worldId);
    saveProgress(progress);
  }
}

export function isClassicUnlocked(): boolean {
  if (isDevUnlockAll()) return true;
  return Boolean(loadProgress().completedLevels['2-3']);
}

export function getUnlockedBots(): PersonalityKey[] {
  if (isDevUnlockAll()) {
    return ['calvin', 'talia', 'nina', 'rex', 'jett', 'mira'];
  }
  const progress = loadProgress();
  const bots = new Set<PersonalityKey>(['calvin']);
  const highestCompleted = progress.highestCompleted;
  if (!highestCompleted) return Array.from(bots);

  const worldOfHighest = getLevel(highestCompleted)?.worldId ?? 0;
  const isWorldFullyCleared = (wid: number): boolean => {
    const w = getWorld(wid);
    if (!w) return false;
    return w.levels.every((l) => progress.completedLevels[l.id]);
  };

  if (isWorldFullyCleared(1) || worldOfHighest >= 2) bots.add('calvin');
  if (isWorldFullyCleared(2) || worldOfHighest >= 3) {
    bots.add('calvin');
    bots.add('talia');
  }
  if (isWorldFullyCleared(3) || worldOfHighest >= 4) {
    bots.add('nina');
  }
  if (isWorldFullyCleared(4)) {
    bots.add('rex');
    bots.add('jett');
    bots.add('mira');
  }
  return Array.from(bots);
}

export function getComboRestrictions(): ComboRestriction[] {
  if (isDevUnlockAll()) return [];
  const progress = loadProgress();
  if (progress.completedLevels['2-3']) return [];
  if (progress.completedLevels['2-2']) return [];
  if (progress.completedLevels['2-1']) return ['noSum3'];
  return ['pairsOnly'];
}

export function getNextPlayableLevel(): LevelConfig | null {
  const all = getAllLevels();
  const progress = loadProgress();
  for (const l of all) {
    if (l.locked) continue;
    if (!progress.completedLevels[l.id] && isLevelUnlocked(l.id)) return l;
  }
  for (const l of all) {
    if (l.locked) continue;
    if (!progress.completedLevels[l.id]) return l;
  }
  return all[0] ?? null;
}

export function getCurrentAdventureLevel(): LevelConfig {
  return getNextPlayableLevel() ?? getAllLevels()[0];
}

export function getUnlockedWorldsList(): number[] {
  const progress = loadProgress();
  const worlds = new Set<number>(progress.unlockedWorlds);
  worlds.add(1);
  for (const w of getAllWorlds()) {
    if (w.levels.every((l) => l.locked)) continue;
    if (w.id === 1) worlds.add(1);
  }
  return Array.from(worlds).sort((a, b) => a - b);
}
