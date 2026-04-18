import { useCallback, useEffect, useState } from 'react';
import type { Difficulty } from '../engine/types';

export type GameSpeed = 'slow' | 'normal' | 'fast';

export interface StackedSettings {
  bot1: Difficulty;
  bot2: Difficulty;
  targetScore: number;
  gameSpeed: GameSpeed;
  soundOn: boolean;
}

const STORAGE_KEY = 'stacked.settings.v1';

export const DEFAULT_SETTINGS: StackedSettings = {
  bot1: 'beginner',
  bot2: 'intermediate',
  targetScore: 300,
  gameSpeed: 'normal',
  soundOn: true,
};

function readSettings(): StackedSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StackedSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: StackedSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable; ignore
  }
}

export function useSettings(): [
  StackedSettings,
  (patch: Partial<StackedSettings>) => void,
  () => void,
] {
  const [settings, setSettings] = useState<StackedSettings>(readSettings);

  useEffect(() => {
    writeSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<StackedSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('stacked.adventure.progress');
      } catch {
        // ignore
      }
    }
  }, []);

  return [settings, update, reset];
}
