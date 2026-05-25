import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAudioSettings,
  saveAudioSettings,
  DEFAULT_AUDIO_SETTINGS,
} from '../../src/audio/settingsStorage';

// localStorage mock for the Node test environment.
const mockStorage: { [k: string]: string } = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; },
    length: 0,
    key: () => null,
  },
  configurable: true,
});

describe('audio settingsStorage', () => {
  beforeEach(() => { (globalThis.localStorage as Storage).clear(); });

  it('returns defaults when no key is set', () => {
    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('roundtrips musicOn/sfxOn through save/load', () => {
    saveAudioSettings({ musicOn: false, sfxOn: true });
    expect(loadAudioSettings()).toEqual({ musicOn: false, sfxOn: true });
  });

  it('returns defaults on malformed JSON', () => {
    (globalThis.localStorage as Storage).setItem('stacked.audio.v1', '{bad');
    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
