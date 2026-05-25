import musicUrl from '../assets/audio/music-loop.mp3';
import sfxUrl from '../assets/audio/take-the-table.mp3';

const MUSIC_VOLUME = 0.30;
const SFX_VOLUME = 0.60;

interface AudioState {
  music: HTMLAudioElement;
  sfx: HTMLAudioElement;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  autoplayUnlocked: boolean;
  unlockArmed: boolean;
}

function createState(): AudioState {
  const music = new Audio(musicUrl);
  const sfx = new Audio(sfxUrl);
  // Single-element native loop. Browser handles continuity — no timeupdate
  // crossfade gymnastics (previous two-instance approach missed its 0.25s
  // window because timeupdate fires at ~250ms granularity).
  music.loop = true;
  music.volume = MUSIC_VOLUME;
  sfx.volume = SFX_VOLUME;
  return {
    music, sfx,
    musicEnabled: true,
    sfxEnabled: true,
    autoplayUnlocked: false,
    unlockArmed: false,
  };
}

// HMR-safe singleton stash on window so Vite hot reload doesn't double-instantiate.
const GLOBAL_KEY = '__stackedAudio';
type WindowWithAudio = Window & { [GLOBAL_KEY]?: AudioState };
const w: WindowWithAudio | Record<string, never> =
  typeof window !== 'undefined' ? (window as WindowWithAudio) : {};
const state: AudioState = (w as WindowWithAudio)[GLOBAL_KEY] ?? createState();
if (typeof window !== 'undefined') (w as WindowWithAudio)[GLOBAL_KEY] = state;

// ─── Public API ─────────────────────────────────────

export function setMusicEnabled(on: boolean): void {
  state.musicEnabled = on;
  if (on) {
    state.music.volume = MUSIC_VOLUME;
    state.music.play().catch(() => { /* autoplay locked — wait for next interaction */ });
  } else {
    state.music.pause();
  }
}

export function setSfxEnabled(on: boolean): void {
  state.sfxEnabled = on;
}

export function playTakeTheTable(): void {
  if (!state.sfxEnabled) return;
  state.sfx.currentTime = 0;
  state.sfx.play().catch(() => { /* fire-and-forget */ });
}

export function armAutoplayUnlock(): void {
  if (state.unlockArmed || state.autoplayUnlocked) return;
  if (typeof document === 'undefined') return;
  state.unlockArmed = true;
  const unlock = () => {
    state.autoplayUnlocked = true;
    if (state.musicEnabled) {
      state.music.play().catch(() => { /* still blocked */ });
    }
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}
