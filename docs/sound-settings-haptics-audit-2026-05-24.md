# Sound + Settings + Haptics — Pre-Spec Read-Only Audit

**Track:** `Sound + Settings + Haptics — Read-Only Audit (pre-spec)` — `36a2f266-2cac-8105-8aac-e94436a6a18b`, P2, May 24 2026.
**Type:** Read-only. No code, no tests. Diagnosis doc only.

---

## Headline verdicts

| Component | State today | Verdict |
| --------- | ----------- | ------- |
| **Audio infrastructure** | Greenfield. Zero playback code, zero audio files, no `howler`/`use-sound`/`HTMLAudioElement` anywhere in `src/`. Nothing in `package.json`. | Ship in this track. Trivial via a single `HTMLAudioElement` at App level. No dep needed. |
| **Settings screen** | No `Settings*.tsx` component exists. There IS an orphaned `useSettings` hook (`src/hooks/useSettings.ts`) with `soundOn: boolean` and `gameSpeed` fields — **defined but never imported or used anywhere in `src/`.** Dead code from an earlier iteration. | Build a new Settings screen. Reuse the orphan `useSettings` shape as a starting point (rename/extend), OR scrap it and start fresh. Either works. |
| **Capacitor + haptics** | **NOT installed.** No `@capacitor/*` packages in `package.json`. No `capacitor.config.ts`. Zero `import` of any Capacitor module. Zero `navigator.vibrate` calls anywhere. Greenfield + the mobile wrapper isn't built yet (per ticket framing). | **Haptics should defer to the Capacitor wrapper track.** Pre-mobile-wrapper, even the `@capacitor/haptics` web shim falls back to `navigator.vibrate()` — which iOS Safari does NOT support. On the primary playtest device (iPhone per recent screenshots), shipping haptics now means they silently do nothing. See section 3. |
| **Music mount point** | App-level. The `App` component (`src/App.tsx`) is the highest-stable mount above the screen switch. Mounting an `<Audio>` element here (or initializing a singleton in `main.tsx`) keeps the loop alive across home → setup → game → roundEnd → gameOver transitions. | Recommend a module-level singleton initialized once in `main.tsx` and controlled by a tiny `useAudio` hook. Survives StrictMode re-mounts and React tree changes. |
| **Persistence shape** | Two parallel storage systems exist (none for sound). See section 5. | Add a fresh small key (`stacked.audio.v1`) with `{ musicOn: boolean; sfxOn: boolean; hapticsOn: boolean }`. Or fold into the orphan `useSettings` rewrite. |

**Recommended track shape:** ship **Audio + Settings** as one bundle now (web-native, low risk, no platform gaps). **Defer haptics implementation** to the Capacitor wrapper track. Include the haptics toggle UI in Settings now, **disabled with explanatory copy until the wrapper ships** (or hidden behind a feature flag). Avoids a silent no-op on iOS Safari.

---

## 1. Audio infrastructure — greenfield

**Grep result:** zero hits for `audio | Audio | howler | use-sound | playSound | HTMLAudioElement | \.mp3 | \.wav | \.ogg` across `src/`.

**`package.json` deps** ([package.json:14-37](package.json:14)):
```
@fontsource/inter, @fontsource/jetbrains-mono, motion, react, react-dom
+ dev: eslint, vite, vitest, typescript, tailwindcss, @types/*
```
**No audio library.** No carry-over from any earlier Stack1 iteration.

**Assets directory** (`src/assets/`): contains `hero.png`, `react.svg`, `vite.svg`. No audio files.
**Public directory** (`public/`): contains `favicon.svg`, `icons.svg`. No audio files.

**Verdict:** total greenfield. Build path:
- Drop a single `~30-90s` smooth-jazz loop file (probably `public/audio/jazz-loop.mp3` + optionally a low-bitrate `.ogg` fallback for Firefox). Web-native, no dep.
- Drop the Take-the-Table SFX (`public/audio/take-the-table.mp3` or similar).
- Either:
  - **Option A (recommended):** initialize a singleton `HTMLAudioElement` for the loop in `main.tsx` so it survives all React re-renders and StrictMode double-invocation. Wrap in a small `useAudio` hook that reads from `useSettings` for the toggle state.
  - **Option B:** add a thin third-party (`howler` ~30KB, popular) if we want multi-track crossfades or sprite-based SFX. Almost certainly overkill for one music loop + one SFX.

Option A is the right call for what Marcus locked.

---

## 2. Settings screen — greenfield + orphan code

**No `Settings*.tsx` component exists.** Glob for `src/**/Settings*.tsx` returns empty.

**There IS an orphan hook:** `src/hooks/useSettings.ts` (73 lines). Its interface:

```ts
export interface StackedSettings {
  bot1: Difficulty;
  bot2: Difficulty;
  targetScore: number;
  gameSpeed: GameSpeed;     // 'slow' | 'normal' | 'fast'
  soundOn: boolean;
}
```

Storage key: `stacked.settings.v1`. Has `useSettings()`, `DEFAULT_SETTINGS`, persistence helpers, `reset()` that also clears the (also dead) `stacked.adventure.progress` key.

**Verified dead via grep:** `useSettings`, `StackedSettings`, `soundOn`, `gameSpeed` — only hits are inside `src/hooks/useSettings.ts` itself. Nothing imports it. Nothing else references these symbols. Dead code from an earlier iteration.

**Where settings actually live today:**
- `App.tsx:15-19` — `DEFAULT_SETTINGS: GameSettings = { targetScore: 300, bot1Personality: 'beginner', bot2Personality: 'intermediate' }`. Held in App's `useState`, threaded to `ClassicSetup` for editing and `GameWrapper` for play.
- `engine/types/index.ts` — the `GameSettings` interface used by the engine.
- `stacked-v2-game` localStorage — embedded inside the persisted game (covered in the saved-game diagnosis).

**Verdict for the Settings screen:**
- New `<SettingsScreen />` component, mounted from a Settings button (likely on the home screen — possibly in the existing footer slot vacated when the "Continue saved game" link gets killed by the home-saved-game track).
- **Reuse the orphan `useSettings` hook as a starting point** — rename/repurpose. Specifically: drop `bot1`/`bot2`/`targetScore`/`gameSpeed` (those don't belong in app-wide settings, they're per-match), keep `soundOn` as the seed for the audio toggles. Add `musicOn`, `sfxOn`, `hapticsOn`.
- OR write fresh. Either works; the dead hook is 73 lines, not worth the churn unless we want the existing storage key migration.

**Recommend:** scrap the orphan, write fresh. It's faster than reusing 73 lines of dead code that has fields you don't want. Use a clean storage key like `stacked.audio.v1` to avoid migrating dead user data.

---

## 3. Capacitor + haptics — THE LOAD-BEARING VERDICT

**Capacitor is NOT installed.** Audit:

| Check | Result |
| ----- | ------ |
| `@capacitor/*` in `package.json` deps | None. |
| `@capacitor/*` in devDeps | None. |
| `capacitor.config.ts` / `capacitor.config.json` at repo root | Does not exist (root listing: LICENSE, README.md, eslint.config.js, package*.json, tsconfig*.json, vite.config.ts, src/, public/, tests/, docs/, dist/, node_modules/). |
| `import.*capacitor` anywhere in `src/` | Zero hits (case-insensitive). |
| `import.*haptics` anywhere in `src/` | Zero hits. |
| `navigator.vibrate` calls | Zero hits. |
| `ios/` or `android/` Capacitor project folders | None. |

**Doc mention:** `docs/adventure-restructure-impact-2026-05-06.md:164` lists "Capacitor mobile wrapper" as a future track ("Remaining: ... web domain swap, Capacitor mobile wrapper, app store submission — all polish/launch readiness"). So Capacitor was always planned for a separate track, never started.

**What this means for haptics:**

`@capacitor/haptics` provides three runtimes:
1. **iOS native** (via the Capacitor iOS wrapper) — calls `UIImpactFeedbackGenerator` / `UISelectionFeedbackGenerator`. Real haptics.
2. **Android native** (via the Capacitor Android wrapper) — calls `Vibrator.vibrate(VibrationEffect)`. Real haptics.
3. **Web shim** — delegates to `navigator.vibrate(durationMs)` (the Web Vibration API).

**The Web Vibration API has a critical platform gap:**
- **Android Chrome:** supported. Works.
- **Firefox (desktop + mobile):** supported.
- **Desktop Chrome/Edge:** supported but no hardware vibrator (silent no-op).
- **iOS Safari:** **NOT supported.** `navigator.vibrate` is `undefined`. Apple has refused to implement Web Vibration since 2016 — there is no workaround.

**The primary playtest device is iPhone** (per recent session memory — `?unlock` URL flow on iPhone). Shipping `@capacitor/haptics` pre-wrapper means:
- iPhone playtest (the actual device): silent no-op. Zero feedback.
- Desktop playtest: silent no-op (no hardware).
- Android playtest (if any): vibrates, but inconsistently across devices (Android vibration intensity isn't great via web shim).

**Recommendation: defer haptics implementation to the Capacitor wrapper track.** Without the wrapper, haptics are silent-no-op on the platform that matters. Building the haptics call sites now and watching them silently fail to fire on iOS would be wasted work and false confidence.

**Two viable paths for the Settings UI:**

**Path A — defer entirely (recommended):**
- Don't ship the haptics toggle in Settings yet.
- Add it together with the Capacitor wrapper track.
- Settings UI ships clean with just Music + SFX toggles.

**Path B — ship UI, defer implementation:**
- Ship the haptics toggle in Settings now, **disabled** with copy: "Available in the iOS/Android app."
- The toggle state persists but doesn't call anything until the Capacitor wrapper lands.
- Pro: Settings UI is "complete-looking" at launch.
- Con: communicates a feature that doesn't work yet, may invite "why doesn't it work" feedback.

**Path C — ship best-effort web fallback:**
- Install `@capacitor/haptics` now and use the web shim.
- Works on Android Chrome/Firefox, silent no-op on iOS Safari and desktop.
- **NOT recommended** because the primary playtest device (iPhone) gets nothing, and we'd be claiming a feature works that observably doesn't.

**Recommend Path A** — cleanest. Defer haptics entirely to the Capacitor wrapper. Settings ships with Music + SFX only at launch.

---

## 4. Music mount point

Goal: persistent looping background track that survives:
- `home` ↔ `setup` ↔ `worldMap` ↔ `game` screen transitions (controlled by `App.tsx` `screen` state at `App.tsx:22`)
- Component remounts triggered by `key={seed}` on `GameWrapper` (`App.tsx:112`) when the player restarts a level or starts a new round
- React 19 StrictMode double-invocation (`main.tsx:50` — `<StrictMode>` wraps `<App />`)

**Three mount candidates:**

| Mount | Pros | Cons |
| ----- | ---- | ---- |
| Inside `<App />` (e.g. a child `<MusicPlayer />` component) | Easy access to React state for the toggle. | Re-renders when App re-renders. Survives screen switches BUT a `<audio>` element rendered in React must be carefully memo'd or the element gets re-created and the loop restarts. Workable with `useRef` + manual element management; not idiomatic React. |
| Module-level singleton in `main.tsx` | **Survives EVERY React event** including StrictMode double-invocation. Imported anywhere. The `useAudio` hook just reads/controls it. Single source of truth for "is the loop playing." | Requires a tiny imperative API (`audioInstance.play()` / `.pause()` / `.setVolume()`). Mocking in tests means stubbing the module — easy. |
| Service-worker-driven Web Audio API | Survives even tab backgrounding (sort of). | Overengineered. Smooth jazz doesn't need this. |

**Recommend the module-level singleton in `main.tsx`** — keeps the looping element outside React's tree entirely. The `useAudio` hook becomes:

```ts
// src/audio/audioPlayer.ts (sketch)
const musicEl = new Audio('/audio/jazz-loop.mp3');
musicEl.loop = true;
musicEl.volume = 0.4;

export function setMusicEnabled(on: boolean) {
  if (on) musicEl.play().catch(() => { /* autoplay blocked */ });
  else musicEl.pause();
}
```

Two notes:
1. **Browser autoplay policy** — modern browsers block `audio.play()` until the user interacts with the page. The first time `setMusicEnabled(true)` is called BEFORE any user click, it'll be blocked. Easy fix: start music only on the first user interaction (the first tap on a card or menu). Track a `hasUserInteracted` flag and call `play()` lazily.
2. **Singleton + HMR** — Vite's hot reload will re-execute the module on edits, which could create a second Audio element. Common workaround: stash on `window.__stackedMusic` and reuse on re-init. Trivial.

---

## 5. Existing toggle / persistence shape

**Three localStorage systems exist today, none for audio:**

| Key | Purpose | Schema | File |
| --- | ------- | ------ | ---- |
| `stacked-v2-game` | In-progress match (engine state + tracker) | v2 wrapped shape, schema versioned | [persistence.ts:6](src/game/persistence.ts:6) |
| `stacked_v2_adventure_progress` | Run campaign progress (unlocked levels, stars) | `{ unlockedLevels, starsPerLevel, lastCompleted, totalStars }` | [progressManager.ts:STORAGE_KEY](src/engine/adventure/progressManager.ts) |
| `stacked_v2_jett_unlocked_classic` | Jett-in-Classic boolean | raw `'true'` / absent | `progressManager.ts:JETT_UNLOCK_KEY` |
| `stacked.settings.v1` | **DEAD** — orphan hook never used | `StackedSettings` (5 fields) | `useSettings.ts:14` |

**Recommend a new clean key:** `stacked.audio.v1` storing `{ musicOn: boolean; sfxOn: boolean }` (plus `hapticsOn` later when Capacitor lands). Don't extend the dead `stacked.settings.v1` — repurposing the orphan adds churn for zero benefit. Don't bury inside `stacked-v2-game` — sound is app-wide, not per-match.

**Migration:** none needed. New key, fresh defaults (both on).

---

## 6. Recommended track shape + sizing

**Track A — Audio + Settings (ship now, ~150-200 LOC + assets)**

1. **Assets** — drop `public/audio/jazz-loop.mp3` (~30-90s loop, looping carefully so the seam isn't audible) + `public/audio/take-the-table.mp3`. Total weight goal under ~600KB for both.
2. **`src/audio/audioPlayer.ts`** — module-level singleton with `setMusicEnabled`, `setSfxEnabled`, `playTakeTheTable`. ~40 LOC.
3. **`src/audio/useAudio.ts`** — tiny React hook that reads from settings storage and calls the singleton's setters. ~30 LOC.
4. **Trigger wiring** — `playTakeTheTable()` call in the place where the jackpot resolves (likely `useGameController.ts:152-165` near `setJackpotInfo`). 1 LOC.
5. **`src/components/SettingsScreen.tsx`** — minimal modal/overlay with Music + SFX toggles. ~80-120 LOC. Triggered from a small gear icon on the home screen (or wherever Marcus's spec puts it).
6. **`src/audio/settingsStorage.ts`** — fresh `stacked.audio.v1` key + `{ musicOn, sfxOn }` shape. ~30 LOC.
7. **First-user-interaction unlock** — `App.tsx` add a one-time click listener that triggers initial music playback (gates around browser autoplay block). ~10 LOC.

Risks: browser autoplay policies (handled by the user-interaction gate). Mobile Safari iOS plays inline `<audio>` but sometimes requires `playsInline` and user interaction; manageable. Volume balancing across the loop and the SFX — needs a quick playtest pass.

**Track B — Capacitor wrapper + haptics (later)**

When the Capacitor mobile wrapper is built (separate planned track), add:
- `@capacitor/haptics` install
- `src/haptics/hapticsPlayer.ts` — tiny wrapper around `Haptics.impact({ style: ImpactStyle.Light })` and friends
- Trigger wiring at: capture commit, place commit, illegal move attempt, round-end, jackpot resolved.
- Settings toggle for `hapticsOn`.

This track is naturally coupled to the wrapper because that's where it actually starts to work. Splitting now adds zero value.

---

## 7. Honest skips

| Item | Status | Reason |
| ---- | ------ | ------ |
| Audio asset selection / production | Out of scope. Audit is read-only. | TC + asset designer choose tracks; track A doesn't block on this — placeholder audio works for spec/build. |
| Test coverage for audio | Will be minimal (mock the singleton, assert toggle state). | Audio is hard to test in jsdom and not worth heavy coverage. |
| Cross-browser auto-play matrix testing | Done during build playtest, not audit. | Chrome/Safari/Firefox iOS/Android all need a quick check. |

---

## 8. File:line summary

| Concern | Location |
| ------- | -------- |
| Settings hook (dead orphan) | [`src/hooks/useSettings.ts`](src/hooks/useSettings.ts) — 73 LOC, zero callers |
| App-level screen switch (music mount candidate) | [`src/App.tsx:22, 109-122`](src/App.tsx:22) |
| Main bootstrap (recommended singleton init site) | [`src/main.tsx:49-53`](src/main.tsx:49) |
| Jackpot resolution (Take-the-Table SFX trigger candidate) | [`src/game/useGameController.ts:152-165`](src/game/useGameController.ts:152) |
| Existing storage keys | `src/game/persistence.ts:6` (`stacked-v2-game`); `src/engine/adventure/progressManager.ts` (`stacked_v2_adventure_progress`, `stacked_v2_jett_unlocked_classic`); `src/hooks/useSettings.ts:14` (`stacked.settings.v1` — DEAD) |
| package.json | [`package.json:14-37`](package.json:14) — no audio, no Capacitor |
| Capacitor mention in docs | `docs/adventure-restructure-impact-2026-05-06.md:164` — listed as future track |

---

## 9. Final verdict

1. **Audio infra: greenfield + cheap.** Ship in the next track with a native `HTMLAudioElement` singleton. ~200 LOC + assets.
2. **Settings screen: greenfield.** Build fresh. Discard the orphan `useSettings` hook (consider deleting it in the same track to drop the dead code).
3. **Capacitor haptics: defer.** Cannot fire on iOS Safari without the native wrapper. Shipping the toggle now would be cosmetic only. Bundle with the future Capacitor wrapper track.
4. **Music mount: module-level singleton in `main.tsx`.** Survives everything React can throw at it.
5. **Persistence: new `stacked.audio.v1` key**, `{ musicOn, sfxOn }`. Add `hapticsOn` later. Don't reuse the dead `stacked.settings.v1`.

**Track-shape recommendation:** "Sound + Settings" ships as one bundle, "Haptics" gets folded into the eventual Capacitor wrapper track. Two tickets, not three.

Audit complete. No code touched. Ready to spec + build "Sound + Settings" whenever TC greenlights.
