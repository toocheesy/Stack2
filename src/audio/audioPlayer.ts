import musicUrl from '../assets/audio/music-loop.mp3';
import sfxUrl from '../assets/audio/take-the-table.mp3';

const MUSIC_VOLUME = 0.30;
const SFX_VOLUME = 0.60;
const CROSSFADE_S = 0.25;

interface AudioState {
  instA: HTMLAudioElement;
  instB: HTMLAudioElement;
  sfx: HTMLAudioElement;
  current: 'A' | 'B';
  musicEnabled: boolean;
  sfxEnabled: boolean;
  autoplayUnlocked: boolean;
  unlockArmed: boolean;
  crossfading: boolean;
}

function createState(): AudioState {
  const instA = new Audio(musicUrl);
  const instB = new Audio(musicUrl);
  const sfx = new Audio(sfxUrl);
  instA.volume = MUSIC_VOLUME;
  instB.volume = 0;
  sfx.volume = SFX_VOLUME;
  // No element-level .loop=true — manual crossfade swap drives continuity.
  return {
    instA, instB, sfx,
    current: 'A',
    musicEnabled: true,
    sfxEnabled: true,
    autoplayUnlocked: false,
    unlockArmed: false,
    crossfading: false,
  };
}

// HMR-safe singleton stash on window so Vite hot reload doesn't double-instantiate.
const GLOBAL_KEY = '__stackedAudio';
type WindowWithAudio = Window & { [GLOBAL_KEY]?: AudioState };
const w: WindowWithAudio | Record<string, never> =
  typeof window !== 'undefined' ? (window as WindowWithAudio) : {};
const state: AudioState = (w as WindowWithAudio)[GLOBAL_KEY] ?? createState();
if (typeof window !== 'undefined') (w as WindowWithAudio)[GLOBAL_KEY] = state;

function crossfade(fromIsA: boolean): void {
  state.crossfading = true;
  const from = fromIsA ? state.instA : state.instB;
  const to = fromIsA ? state.instB : state.instA;
  to.currentTime = 0;
  to.volume = 0;
  to.play().catch(() => { /* still locked, give up gracefully */ });

  const startMs = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - startMs) / (CROSSFADE_S * 1000));
    to.volume = MUSIC_VOLUME * t;
    from.volume = MUSIC_VOLUME * (1 - t);
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    from.pause();
    from.currentTime = 0;
    from.volume = 0;
    state.current = fromIsA ? 'B' : 'A';
    state.crossfading = false;
  };
  requestAnimationFrame(tick);
}

function attachCrossfadeWatch(inst: HTMLAudioElement, isA: boolean): void {
  inst.addEventListener('timeupdate', () => {
    if (!inst.duration || state.crossfading) return;
    if (inst.currentTime < inst.duration - CROSSFADE_S) return;
    crossfade(isA);
  });
}

// Attach once per state instance (skipped on HMR re-runs since state is reused).
const ATTACH_FLAG = '__stackedAudioAttached';
type AttachedState = AudioState & { [ATTACH_FLAG]?: boolean };
const s = state as AttachedState;
if (!s[ATTACH_FLAG]) {
  attachCrossfadeWatch(state.instA, true);
  attachCrossfadeWatch(state.instB, false);
  s[ATTACH_FLAG] = true;
}

// ─── Public API ─────────────────────────────────────

export function setMusicEnabled(on: boolean): void {
  state.musicEnabled = on;
  if (on) {
    const cur = state.current === 'A' ? state.instA : state.instB;
    cur.volume = MUSIC_VOLUME;
    cur.play().catch(() => { /* autoplay locked — wait for next interaction */ });
  } else {
    state.instA.pause();
    state.instB.pause();
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
      const cur = state.current === 'A' ? state.instA : state.instB;
      cur.play().catch(() => { /* still blocked */ });
    }
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}
