export interface TutorialState {
  seen: boolean;
}

const STORAGE_KEY = 'stacked.tutorial.v1';

export function setTutorialSeen(seen: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen }));
  } catch {
    /* storage unavailable */
  }
}
