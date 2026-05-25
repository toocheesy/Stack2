import { useCallback, useEffect, useState } from 'react';
import {
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
} from './settingsStorage';
import { setMusicEnabled, setSfxEnabled } from './audioPlayer';

export function useAudio(): [AudioSettings, (patch: Partial<AudioSettings>) => void] {
  const [settings, setSettings] = useState<AudioSettings>(loadAudioSettings);

  useEffect(() => {
    saveAudioSettings(settings);
    setMusicEnabled(settings.musicOn);
    setSfxEnabled(settings.sfxOn);
  }, [settings]);

  const update = useCallback((patch: Partial<AudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return [settings, update];
}
