# Sound + Settings (web) — Plan

**Spec:** `docs/sound-settings-spec-2026-05-24.md`.
**Order:** strict — each step lands before the next so TS stays green. Single commit at the end.

---

## S1 — Audio assets ✓ done

Two files in `src/assets/audio/`:
- `music-loop.mp3` (2.4 MB)
- `take-the-table.mp3` (98 KB)

---

## S2 — Settings storage

**New file:** `src/audio/settingsStorage.ts` (~35 LOC).

```ts
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
```

---

## S3 — Audio player singleton

**New file:** `src/audio/audioPlayer.ts` (~120 LOC).

Imports the two audio asset URLs (Vite handles bundling). Initializes module-level state on first import. HMR-safe via a `window.__stackedAudio` stash.

```ts
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
  // No element-level .loop = true — manual crossfade swap handles continuity.
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

// HMR-safe singleton stash
const globalKey = '__stackedAudio';
type WindowWithAudio = Window & { [k: string]: AudioState | undefined };
const w = (typeof window !== 'undefined' ? window : ({} as WindowWithAudio)) as WindowWithAudio;
const state: AudioState = (w[globalKey] as AudioState | undefined) ?? createState();
if (typeof window !== 'undefined') w[globalKey] = state;

// Crossfade scheduling — checks timeupdate on the current instance and swaps when near end
function attachCrossfadeWatch(inst: HTMLAudioElement, isA: boolean): void {
  inst.addEventListener('timeupdate', () => {
    if (!inst.duration || state.crossfading) return;
    if (inst.currentTime < inst.duration - CROSSFADE_S) return;
    crossfade(isA);
  });
}

function crossfade(fromIsA: boolean): void {
  state.crossfading = true;
  const from = fromIsA ? state.instA : state.instB;
  const to = fromIsA ? state.instB : state.instA;
  to.currentTime = 0;
  to.volume = 0;
  to.play().catch(() => { /* still locked */ });

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

attachCrossfadeWatch(state.instA, true);
attachCrossfadeWatch(state.instB, false);

// Public API

export function setMusicEnabled(on: boolean): void {
  state.musicEnabled = on;
  if (on) {
    const cur = state.current === 'A' ? state.instA : state.instB;
    cur.volume = MUSIC_VOLUME;
    cur.play().catch(() => { /* locked — wait for next interaction */ });
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
  state.sfx.play().catch(() => { /* ignore — sting is fire-and-forget */ });
}

export function armAutoplayUnlock(): void {
  if (state.unlockArmed || state.autoplayUnlocked) return;
  state.unlockArmed = true;
  const unlock = () => {
    state.autoplayUnlocked = true;
    if (state.musicEnabled) {
      const cur = state.current === 'A' ? state.instA : state.instB;
      cur.play().catch(() => { /* still blocked — give up gracefully */ });
    }
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}
```

Notes:
- The element-level `.loop = true` flag is NOT set because we want manual control during the crossfade window (otherwise `timeupdate` past `duration - CROSSFADE_S` would restart cleanly without the crossfade landing).
- `play().catch(() => {})` is the standard way to swallow the autoplay-block Promise rejection.
- `requestAnimationFrame` for the volume ramp = ~60 frames over 250ms = smooth.

---

## S4 — useAudio hook

**New file:** `src/audio/useAudio.ts` (~30 LOC).

```ts
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
```

Single source of mutation: the React state. Singleton mirrors via the effect.

---

## S5 — Settings screen

**New file:** `src/components/SettingsScreen.tsx` (~120 LOC).

Modal overlay (matches `RoundEndOverlay` / `GameOverOverlay` patterns):
- Fixed inset, `rgba(0,0,0,0.85)` backdrop.
- Centered panel with brand tokens (jade `#065F46`, tan `#E8C577`, near-black `#0A0A0A`).
- Title: "SETTINGS".
- Two toggle rows: Music, SFX. Each row is `[label] [pill toggle]`.
- Close button at top-right (or full-width "DONE" button at bottom — match GameOver/LevelComplete pattern).

Component shape:
```tsx
interface Props {
  visible: boolean;
  settings: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
  onClose: () => void;
}

export function SettingsScreen({ visible, settings, onChange, onClose }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div ...>
          <div ...>
            <h2>SETTINGS</h2>
            <ToggleRow label="Music" on={settings.musicOn} onToggle={(on) => onChange({ musicOn: on })} />
            <ToggleRow label="SFX" on={settings.sfxOn} onToggle={(on) => onChange({ sfxOn: on })} />
            <button onClick={onClose}>DONE</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

`ToggleRow` is an inline helper — pill-shaped switch (ON: tan background, OFF: dim gray, no Tailwind dep, just inline styles matching the existing component style).

---

## S6 — Home-screen Settings entry

**Edit:** `src/App.tsx` — `TitleScreen` component.

Add a small "Settings" text button near the footer (sibling to the "Continue saved game" link if it's still there, otherwise centered alone). Per home-saved-game diagnosis, the global "Continue saved game" link is slated for removal anyway — when both land together, Settings becomes the sole footer affordance. For now, just add Settings as a sibling.

```tsx
{/* Inside TitleScreen, near the bottom: */}
<div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, flexShrink: 0 }}>
  <button onClick={onOpenSettings} style={{ /* same minimal text-button style as Continue */ }}>
    Settings
  </button>
</div>
```

Wire `onOpenSettings` prop into `TitleScreen` from `App`. In `App`, hold `const [settingsOpen, setSettingsOpen] = useState(false)` and render `<SettingsScreen visible={settingsOpen} ... onClose={() => setSettingsOpen(false)} />` outside the screen switch (so it can overlay any screen — useful for future in-game access too).

---

## S7 — SFX hook in controller

**Edit:** `src/game/useGameController.ts`.

Add import at top:
```ts
import { playTakeTheTable } from '../audio/audioPlayer';
```

Add `playTakeTheTable()` calls in two places, both gated by `if (jackpotResult)`:

**END_ROUND case (around line 161):**
```ts
if (jackpotResult) {
+ playTakeTheTable();
  setJackpotInfo({ winner: jackpotResult.player, points: jackpotResult.points, cardCount: jackpotResult.cardCount });
  await wait(2500);
  ...
}
```

**END_GAME case (around line 184):**
```ts
if (jackpotResult) {
+ playTakeTheTable();
  setJackpotInfo({ winner: jackpotResult.player, points: jackpotResult.points, cardCount: jackpotResult.cardCount });
  await wait(2500);
  ...
}
```

3 LOC total (1 import + 2 calls).

---

## S8 — App.tsx wiring + dead-key cleanup

**Edit:** `src/App.tsx`.

At the top, add imports:
```ts
import { useAudio } from './audio/useAudio';
import { armAutoplayUnlock } from './audio/audioPlayer';
import { SettingsScreen } from './components/SettingsScreen';
```

Inside `App()`, add:
```ts
const [audioSettings, updateAudio] = useAudio();
const [settingsOpen, setSettingsOpen] = useState(false);

useEffect(() => {
  armAutoplayUnlock();
  // Cleanup: dead key from the orphan useSettings hook
  try { localStorage.removeItem('stacked.settings.v1'); } catch { /* ignore */ }
}, []);
```

Add `onOpenSettings={() => setSettingsOpen(true)}` to the `TitleScreen` props (which propagate from S6).

Mount the SettingsScreen outside the screen switch (so it can overlay any screen):
```tsx
return (
  <>
    {/* existing screen switch */}
    <SettingsScreen
      visible={settingsOpen}
      settings={audioSettings}
      onChange={updateAudio}
      onClose={() => setSettingsOpen(false)}
    />
  </>
);
```

Refactor the existing return into a fragment + add the SettingsScreen mount. Each existing `if (screen === ...)` early-return becomes a single fragment-rooted return that nests `<SettingsScreen .../>` after it.

**Alternative cleaner refactor:** instead of touching every early-return, render `<SettingsScreen .../>` once at the outermost level by collapsing the early-returns into a single switch'd `view` JSX variable wrapped in a fragment with SettingsScreen. ~15 LOC diff vs ~40 LOC if patching each early-return. Going with the collapse refactor.

---

## S9 — Delete orphan useSettings hook

**Delete:** `src/hooks/useSettings.ts` (73 LOC, zero callers).

Verify nothing breaks: `grep useSettings src/` → empty.

---

## S10 — Tests

**New file:** `tests/audio/settingsStorage.test.ts` (~50 LOC).

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAudioSettings,
  saveAudioSettings,
  DEFAULT_AUDIO_SETTINGS,
} from '../../src/audio/settingsStorage';

// localStorage mock (same pattern as adventure.test.ts)
const mockStorage: { [k: string]: string } = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; },
  },
  configurable: true,
});

describe('audio settingsStorage', () => {
  beforeEach(() => { (globalThis.localStorage as Storage).clear(); });

  it('returns defaults when no key is set', () => {
    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('roundtrips musicOn/sfxOn', () => {
    saveAudioSettings({ musicOn: false, sfxOn: true });
    expect(loadAudioSettings()).toEqual({ musicOn: false, sfxOn: true });
  });

  it('returns defaults on malformed JSON', () => {
    (globalThis.localStorage as Storage).setItem('stacked.audio.v1', '{bad');
    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
```

3 new specs. Count: 325 → 328.

---

## S11 — Vitest + verification

1. Run `npx vitest run` — confirm 325 → 328 green.
2. Grep `src/engine/` for audio imports: `grep -r 'from .*audio' src/engine/` → empty.
3. Grep `src/` for the dead orphan: `grep -r useSettings src/` → empty.

---

## Order summary

1. ✓ Assets (S1).
2. Settings storage (S2) — pure module, no deps.
3. Audio player singleton (S3) — imports assets.
4. useAudio hook (S4) — imports S2 + S3.
5. SettingsScreen (S5) — imports S4 indirectly via App.
6. Home-screen entry (S6) — touches App + TitleScreen.
7. Controller SFX hook (S7) — imports S3.
8. App wiring + dead-key cleanup (S8) — imports S4/S5.
9. Delete orphan useSettings (S9).
10. Tests (S10).
11. Vitest + grep verification (S11).

Each step is contained enough to land without checkpoint review. Single commit at the end after green tests.
