import sfxUrl from '../assets/audio/take-the-table.mp3';

const MUSIC_VOLUME = 0.30;
const SFX_VOLUME = 0.60;

// Music URL resolved on demand so Vite emits the asset but the initial
// bundle does NOT fetch it. The 2.29 MB file lazy-loads at the autoplay-
// unlock gesture (first user interaction) or when the Music toggle flips
// on after unlock. SFX (98 KB) stays eager — small, needed for iOS Safari
// priming on the same gesture.
function getMusicUrl(): string {
  return new URL('../assets/audio/music-loop.mp3', import.meta.url).href;
}

interface AudioState {
  music: HTMLAudioElement;
  sfx: HTMLAudioElement;
  musicSrcLoaded: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  autoplayUnlocked: boolean;
  unlockArmed: boolean;
}

function createState(): AudioState {
  // Music element created with no src — preload='none' keeps the browser
  // from prefetching once src is set, until .play() actually fires.
  const music = new Audio();
  music.preload = 'none';
  music.loop = true;
  music.volume = MUSIC_VOLUME;
  const sfx = new Audio(sfxUrl);
  sfx.volume = SFX_VOLUME;
  return {
    music, sfx,
    musicSrcLoaded: false,
    musicEnabled: true,
    sfxEnabled: true,
    autoplayUnlocked: false,
    unlockArmed: false,
  };
}

function ensureMusicSrc(): void {
  if (state.musicSrcLoaded) return;
  state.music.src = getMusicUrl();
  state.musicSrcLoaded = true;
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
    // Only fetch/play once the user has interacted (autoplay unlocked).
    // Otherwise the unlock handler will pick up the desired state and
    // ensureMusicSrc() + play() at the gesture moment. Avoids both an
    // unproductive page-load fetch and the autoplay-block Promise reject.
    if (state.autoplayUnlocked) {
      ensureMusicSrc();
      state.music.play().catch(() => { /* still blocked */ });
    }
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
    // Lazy-load music on the gesture moment — only fetch if the user
    // actually has Music turned on. If toggled off, never download.
    if (state.musicEnabled) {
      ensureMusicSrc();
      state.music.play().catch(() => { /* still blocked */ });
    }
    // Prime the SFX element inside the user gesture too. iOS Safari requires
    // every audio element to be touched via .play() during a user gesture
    // before later async .play() calls (e.g. playTakeTheTable firing inside
    // the controller's awaited jackpot wait) will succeed. Without this the
    // sting silently fails — .play() rejects and the catch swallows it.
    const p = state.sfx.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { state.sfx.pause(); state.sfx.currentTime = 0; })
       .catch(() => { /* prime failed; SFX may still work on browsers without strict gesture rules */ });
    }
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}
