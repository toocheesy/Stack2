# Sound + Settings (web) — Spec

**Track:** `Sound + Settings (web) — Music Loop + Take-the-Table SFX + Settings Screen` — `36b2f266-2cac-819d-b54a-c57e9f2aa075`.
**Audit input:** `docs/sound-settings-haptics-audit-2026-05-24.md`.
**Plan output:** `docs/sound-settings-plan-2026-05-24.md` (next).

---

## Assets (Step 1 — completed)

Two audio files identified in `G:\My Drive\Stacked Rebuild docs\` per ticket (exactly two; no ambiguity):

| Source | Size | Canonical name in repo |
| ------ | ---- | ---------------------- |
| `BACKGROUND MUSIC.mp3` | 2.4 MB | `src/assets/audio/music-loop.mp3` |
| `The Take Sound Effect.mp3` | 98 KB | `src/assets/audio/take-the-table.mp3` |

Both copied into the repo. Vite will bundle them with hashed URLs at build time. Import via `import musicUrl from '../assets/audio/music-loop.mp3'`; the imported value is a string URL safe to pass to `new Audio(url)`.

---

## Goals

1. **Smooth-jazz loop** plays continuously across home → setup → world map → game → round-end → game-over transitions. No restart on screen changes.
2. **Take-the-Table sting** fires once at the jackpot resolution moment (existing `setJackpotInfo` site in the controller).
3. **Settings screen** reachable from the home screen with two toggles: **Music** and **SFX**, both default ON. Music plays at low default volume.
4. **Crossfade on loop** masks the loop seam (file is a trimmed sample, not a purpose-built loop).
5. **Browser autoplay policy handled** — music starts on the first user interaction, not on cold app load.
6. **Persistence** via `stacked.audio.v1` localStorage key, `{ musicOn: boolean; sfxOn: boolean }`.
7. **Engine purity preserved** — `src/engine/` stays free of audio imports.

---

## Non-goals (explicit)

- **No haptics.** Deferred to the Capacitor wrapper track per audit (iOS Safari has no Web Vibration; pre-wrapper haptics silently no-op on iPhone).
- **No volume sliders.** Two on/off toggles only. Volume baked into the player (music ~0.30, SFX ~0.60).
- **No music swapping / playlist / multiple tracks.** One loop, period.
- **No advanced SFX (capture chimes, button clicks, etc.).** Only the Take-the-Table sting.
- **No in-game settings access for V1.** Home-screen only. GameView has no existing menu pattern beyond the quit dialog; adding it would expand scope. Flag in completion report — a small gear icon in the GameView top-bar would be a tight follow-up if TC wants it post-launch.
- **No Capacitor install. No `howler` / `use-sound` / heavy deps.** Native `HTMLAudioElement` only.

---

## Architecture

### Audio module — `src/audio/`

**Three files:**

1. **`src/audio/audioPlayer.ts`** — module-level singleton. Initialized on first import via side effect. Owns two `HTMLAudioElement` instances for crossfade looping (instance A and instance B, same source, alternated). Plus one `HTMLAudioElement` for the SFX. Exposes:
   ```ts
   export function setMusicEnabled(on: boolean): void;
   export function setSfxEnabled(on: boolean): void;
   export function playTakeTheTable(): void;
   export function armAutoplayUnlock(): void;  // installs the one-shot interaction listener
   ```
   The singleton holds its own `musicEnabled` / `sfxEnabled` state, updated by the setters. The React layer's job is to call the setters when the persisted toggles change — it doesn't drive the singleton's state directly.

2. **`src/audio/settingsStorage.ts`** — pure functions for `stacked.audio.v1` localStorage read/write. Mirrors the shape of `src/game/persistence.ts` (read-with-defaults, write-on-change, malformed-JSON-recovers-to-defaults).
   ```ts
   export interface AudioSettings { musicOn: boolean; sfxOn: boolean; }
   export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { musicOn: true, sfxOn: true };
   export function loadAudioSettings(): AudioSettings;
   export function saveAudioSettings(s: AudioSettings): void;
   ```

3. **`src/audio/useAudio.ts`** — tiny React hook bridging persistence and the singleton. `useState<AudioSettings>(loadAudioSettings)`, `useEffect` to write on change AND call the singleton setters on every change. Returns `[settings, updateSettings]`.

### Settings UI — `src/components/SettingsScreen.tsx`

Modal overlay (style: matches existing `RoundEndOverlay` / `GameOverOverlay` patterns — fixed inset, dark backdrop, brand-token panel). Two toggle rows for Music + SFX. Close button returns to home. Uses existing colors (jade `#065F46`, tan `#E8C577`, near-black `#0A0A0A`).

**Mounted from:** a small "Settings" affordance on the home screen. Recommend tucking into the footer slot that the home-saved-game diagnosis recommends vacating (the "Continue saved game" link area). If that fix isn't shipped yet, place the Settings entry as a small text button below the hero cards.

### Wiring

- **App.tsx** initializes the audio system. Imports the audio player module (triggers singleton initialization side effect) + calls `armAutoplayUnlock()` once on mount. Uses `useAudio()` hook to keep singleton in sync with persisted toggles.
- **main.tsx** — bootstrap import of the audio player so the singleton initializes before React mounts. Actually optional: importing from App.tsx is enough since import order is deterministic. **Decision:** import in `App.tsx` only; main.tsx untouched. Keeps audio system colocated with the React app rather than scattered.
- **useGameController.ts** — call `playTakeTheTable()` in the two jackpot sites at `:152-165` (END_ROUND) and `:184-188` (END_GAME), gated by `if (jackpotResult)`. One line each.

---

## Crossfade loop approach

`HTMLAudioElement.loop = true` restarts at `currentTime = 0` instantly — audible click/pop on most loops that aren't sample-perfect. The `BACKGROUND MUSIC.mp3` file is a trimmed sample, not a purpose-built seamless loop.

**Two-instance crossfade:**
```
At init: load instance A and instance B with the same URL. A.volume = 0.30. B.volume = 0. A starts playing.
A.ontimeupdate: if (A.currentTime >= A.duration - CROSSFADE_S) and !crossfading: schedule the crossfade.
Crossfade:
  - Start B from 0s at volume 0.
  - Over CROSSFADE_S seconds: linearly ramp A's volume to 0 and B's volume to 0.30.
  - When done: A.pause(), A.currentTime = 0, swap roles (A becomes the "next" instance, B becomes current).
```

Constants:
- `MUSIC_VOLUME = 0.30` (low, per Marcus).
- `SFX_VOLUME = 0.60`.
- `CROSSFADE_S = 0.25` (250ms). Short enough to feel like a loop, long enough to mask the seam.

Crossfade ramp implementation: `requestAnimationFrame` loop incrementing `Math.min(1, elapsed / CROSSFADE_MS)` and setting both volumes. ~30 LOC.

---

## Autoplay gate

Modern browsers block `audio.play()` until the user has interacted with the page (clicked, tapped, key-pressed). Calling `play()` cold returns a rejected Promise.

**Approach:**
- `armAutoplayUnlock()` adds a one-shot `pointerdown` + `keydown` listener on `document`.
- On first event: if `musicEnabled === true`, call instance A's `play()`. Catch any rejection silently (some browsers may still block; user can toggle Music off/on in settings to retry).
- Remove both listeners after first fire.
- If music is toggled OFF first, then ON later via Settings: just call `play()` then — the user has interacted by tapping the toggle, so autoplay is unlocked.

Edge case: a player who never touches the screen never gets music. That's correct behavior — by definition they haven't engaged.

---

## SFX hook point

`src/game/useGameController.ts` has two Take-the-Table jackpot moments:

| Site | Lines | What happens | Hook |
| ---- | ----- | ------------ | ---- |
| END_ROUND case | 152-165 | After jackpot resolution, `setJackpotInfo(...)` triggers the overlay animation. | Call `playTakeTheTable()` right before `setJackpotInfo`. Gated by `if (jackpotResult)`. |
| END_GAME case | 184-188 | Same pattern, game-ending jackpot. | Same — call right before `setJackpotInfo`. Gated by `if (jackpotResult)`. |

The singleton's `playTakeTheTable()` itself gates on `sfxEnabled` — call sites don't need to check. 2 LOC total in the controller (one import + two call lines minus the existing flow — net 3 LOC additions).

---

## Cleanup of the orphan settings hook + dead key

**Delete:**
- `src/hooks/useSettings.ts` (73 LOC, zero callers per audit verification).
- The `stacked.settings.v1` localStorage key isn't actively referenced after the file deletion, but persisted user data may exist. Add a one-time defensive cleanup: `localStorage.removeItem('stacked.settings.v1')` in `App.tsx`'s mount effect, so any returning user gets the dead key wiped on next visit. ~3 LOC.

**Verify post-deletion:**
- `grep useSettings src/` returns empty.
- `grep StackedSettings src/` returns empty.
- `grep 'stacked.settings.v1' src/` returns only the cleanup line (which can be removed in a future track once we're confident no users have it lingering).

---

## Persistence shape

**New key:** `stacked.audio.v1`

```ts
{
  musicOn: boolean;  // default true
  sfxOn: boolean;    // default true
}
```

Read on hook init via `loadAudioSettings()`. Defaults if missing/malformed. Write on every toggle via `saveAudioSettings()`.

**Migration:** none — fresh key. Old `stacked.settings.v1` is dropped (cleanup line above), no data carries over.

---

## Constraints checklist

| Constraint | Satisfied by |
| ---------- | ------------ |
| Engine purity — no audio imports in `src/engine/` | All audio in `src/audio/`; controller is in `src/game/`. Verified by grep post-build. |
| Native `HTMLAudioElement` only, no heavy deps | `package.json` unchanged. |
| Music + SFX toggles default ON | `DEFAULT_AUDIO_SETTINGS = { musicOn: true, sfxOn: true }`. |
| Music low default | `MUSIC_VOLUME = 0.30`. |
| 325-test baseline stays green | No changes to existing test surface area. Audio code lives outside test paths. |
| Light tests for settings persistence | Add `tests/audio/settingsStorage.test.ts` — 3 specs (read defaults, write/read roundtrip, malformed JSON → defaults). |
| Engine purity intact | Audio singleton in `main.tsx` per ticket? **Refining:** singleton lives in `src/audio/audioPlayer.ts`. The ticket says "in main.tsx" — the intent is "module-level + survives React tree." Putting it in its own module satisfies that better (testable, importable). `App.tsx` triggers initialization on first import. Calling out the deviation in the completion report. |
| Haptics deferred | No haptics code, no `hapticsOn` field in `stacked.audio.v1`. Add when Capacitor lands. |

---

## Tests to add

`tests/audio/settingsStorage.test.ts` — 3 specs:

1. `loadAudioSettings()` returns `{ musicOn: true, sfxOn: true }` when the key is absent.
2. `saveAudioSettings({ musicOn: false, sfxOn: true })` then `loadAudioSettings()` returns the same shape.
3. `localStorage.setItem('stacked.audio.v1', '{bad json')` then `loadAudioSettings()` returns defaults (no throw).

That's it. Audio playback itself is impractical to test in jsdom (no real audio output, only mockable elements). The crossfade logic could be unit-tested in isolation but adds complexity without much return; cover via playtest instead.

**New test count:** 325 → 328.

---

## Risks

1. **Browser autoplay blocking** — handled via the interaction-gate. iOS Safari is the strictest; the gate handles it. If a player has Music enabled by default but never clicks, no music. Acceptable.
2. **Crossfade seam audibility** — the 250ms ramp is a guess. Playtest will tune. Easy to adjust the constant.
3. **localStorage unavailable** (private browsing, quota exceeded) — `loadAudioSettings` returns defaults, `saveAudioSettings` silently fails. Same pattern as existing storage files; consistent.
4. **HMR creating duplicate singleton instances during dev** — Vite re-executes modules on edit. Workaround: stash on `(window as any).__stackedAudio` and reuse on re-init. ~6 LOC. Standard pattern.
5. **MP3 bundle size** — 2.4 MB music + 98 KB SFX = ~2.5 MB added to the app bundle. Vite will hash and lazy-load via dynamic import if we want. **Decision for V1:** import statically (eager bundle). The hit is one-time and the loop is part of the launch experience. If launch tooling complains we can switch to dynamic import later. ~1 LOC change.
6. **Drift between singleton state and React state** — the singleton is the source of truth for playback; React is the source of truth for the persisted toggles. The `useAudio` hook is the only writer to both — React state via `setState`, singleton via the setter calls. Single source of mutation. No drift if discipline is held.

---

## Definition of done

- Two audio files in `src/assets/audio/` with canonical names. ✓ (Step 1 done)
- `src/audio/audioPlayer.ts` singleton with the four-function API and two-instance crossfade.
- `src/audio/settingsStorage.ts` with the typed shape and read/write helpers.
- `src/audio/useAudio.ts` hook bridging React and singleton.
- `src/components/SettingsScreen.tsx` modal with Music + SFX toggles, brand tokens.
- Home-screen Settings entry point (small button or gear icon).
- `useGameController.ts` calls `playTakeTheTable()` at the two jackpot sites.
- `App.tsx` initializes audio system on mount, arms autoplay unlock, cleans up dead `stacked.settings.v1` key.
- `src/hooks/useSettings.ts` deleted.
- 3 new persistence tests in `tests/audio/settingsStorage.test.ts`.
- 325 → 328 tests green.
- `grep -r 'from.*audio' src/engine/` returns empty.
- `grep -r useSettings src/` returns empty.
- Playtest: music starts on first tap, loops seamlessly, SFX fires at Take-the-Table, toggles persist across reload.
