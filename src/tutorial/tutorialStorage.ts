export interface TutorialState {
  seen: boolean;
}

const STORAGE_KEY = 'stacked.tutorial.v1';

export const DEFAULT_TUTORIAL: TutorialState = { seen: false };

export function loadTutorialSeen(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    return parsed.seen === true;
  } catch {
    return false;
  }
}

export function setTutorialSeen(seen: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen }));
  } catch {
    /* storage unavailable */
  }
}
