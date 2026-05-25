export interface AudioSettings {
  musicOn: boolean;
  sfxOn: boolean;
}

const STORAGE_KEY = 'stacked.audio.v1';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicOn: true,
  sfxOn: true,
};

export function loadAudioSettings(): AudioSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_AUDIO_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}
