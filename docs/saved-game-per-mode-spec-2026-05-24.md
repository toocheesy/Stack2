# Home-Screen Saved-Game Per-Mode Split — Spec

**Track:** `Home-Screen Saved-Game Per-Mode Split` — `36b2f266-2cac-81da-b50d-c73b33bc03e8`.
**Diagnosis input:** `docs/home-saved-game-diagnosis-2026-05-24.md`.
**Plan output:** `docs/saved-game-per-mode-plan-2026-05-24.md` (next).

---

## Goal

Replace today's single global "Continue saved game" link with per-mode resume affordances, driven by a `currentLevelId` field added to the persisted save. Fixes the orphan-save data-loss bug (Run save loading into Classic frame) and the Run-card descriptor mismatch in one pass.

---

## Persistence — schema v3

**File:** `src/game/persistence.ts`

Bump `SCHEMA_VERSION = 2 → 3`. Add `currentLevelId: number | null` to `PersistedSnapshot`:

```ts
interface PersistedSnapshot {
  version: number;
  game: GameState;
  tracker: PersistedTracker;
  currentLevelId: number | null;   // NEW: null = Classic, number = Run level
}
```

**`saveGame` signature** changes from `saveGame(state, tracker)` to `saveGame(state, tracker, currentLevelId)`. Three call sites in `useGameController.ts` (today: 1 — `setAndPersist`); the controller threads it through from a new prop.

**`LoadedSave` shape** gains `currentLevelId: number | null`:

```ts
export interface LoadedSave {
  game: GameState;
  tracker: CardTrackerState;
  currentLevelId: number | null;
}
```

**Migration (v2 → v3):** graceful. Any saved snapshot without `currentLevelId` is treated as `null` (Classic). No data loss, no wipe. Same pattern as the existing `dumpActive ?? false` default for pre-Sibling-1 saves.

```ts
// in loadGame, after isValidGameShape passes:
const currentLevelId = typeof parsed.currentLevelId === 'number'
  ? parsed.currentLevelId
  : null;
```

Legacy (bare GameState, pre-v2) save path also resolves to `currentLevelId: null`.

---

## Controller — thread `currentLevelId` to save

**File:** `src/game/useGameController.ts`

`useGameController` gains a `currentLevelId: number | null` parameter (the third argument, after `seed` and `settings`). It captures the value via `useRef` so the latest value is in scope for every `setAndPersist` call, then passes it to `saveGame`:

```ts
export function useGameController(seed: number, settings: GameSettings, currentLevelId: number | null) {
  // ...
  const currentLevelIdRef = useRef(currentLevelId);
  currentLevelIdRef.current = currentLevelId;

  const setAndPersist = useCallback((s: GameState) => {
    setState(s);
    stateRef.current = s;
    saveGame(s, trackerRef.current, currentLevelIdRef.current);
  }, []);
```

(Ref pattern matches the existing `stateRef` usage in the same function — avoids stale closure if `currentLevelId` changes during a mounted game.)

---

## App — savedSnapshot + per-mode handlers

**File:** `src/App.tsx`

### Read the saved snapshot once per render

```ts
const savedSnapshot = loadGame();
const savedIsClassic = savedSnapshot && savedSnapshot.currentLevelId === null;
const savedRunLevelId = savedSnapshot?.currentLevelId ?? null;
```

Re-runs on every App render; cost is one localStorage read. Acceptable per the diagnosis (same as today's `hasSave = !!loadGame()`).

### Handlers

**`continueClassic`** — used by the Classic card's Continue affordance:
```ts
const continueClassic = useCallback(() => {
  setCurrentLevelId(null);
  setScreen('game');
}, []);
```
useGameController internally calls `loadGame()` on mount and uses the saved state as initial state. No need to pass settings here — useGameController will use the saved game's own settings.

**`continueRunFromMap`** — invoked by ChapterMap's new "Resume Level N" callout:
```ts
const continueRunFromMap = useCallback((levelId: number) => {
  setCurrentLevelId(levelId);
  setSettings(settingsForLevel(levelId));
  setScreen('game');
}, [settingsForLevel]);
```

### Wiring

Pass `currentLevelId` to `useGameController` via GameWrapper:

```tsx
// GameWrapper:
const { ... } = useGameController(seed, settings, currentLevelId);
```

### Kill the global Continue link

The post-Sound+Settings footer in `TitleScreen` already lost the "Settings" button (moved to top-right gear). Remove the remaining `Continue saved game` link entirely — `onContinue` prop on `TitleScreen` becomes obsolete. Continue lives on the Classic card now.

### Fix the Run descriptor mismatch

Currently the descriptor branches two ways on `returning = (in-progress || complete)`, but the button branches three ways via `runStatus`. Change descriptor to branch three ways:

```tsx
const runDescriptor =
  runStatus === 'complete'   ? 'Run complete · start fresh' :
  runStatus === 'in-progress' ? 'Resume your run' :
                                /* fresh */ `${TOTAL_LEVELS} levels`;
```

---

## ClassicHeroCard — Continue affordance

**File:** `src/App.tsx` (`ClassicHeroCard` component, currently around line 333+)

Add optional `onContinue?: () => void` prop. When present, render a small secondary "Continue" pill button inside the card, sitting in the bottom row to the left of the existing PLAY pill:

```
[Capture · Combo · Win.        ]  [CONTINUE]  [PLAY →]
[Best of three rounds.         ]
```

Style: smaller than PLAY pill, dimmer brand tokens. Use jade outline + tan text (secondary visual hierarchy vs PLAY's jade-filled-tan-text). Tap must `e.stopPropagation()` so the card's existing `onClick={onPlay}` doesn't fire underneath.

**Card-level click handler change:** the card root currently has `onClick={onPlay}`. With a Continue button inside, the whole-card click for PLAY remains the primary affordance (tap anywhere on the card to start a new game), but Continue is a smaller targeted tap. stopPropagation on the Continue button handles the conflict.

When `onContinue` is undefined (no saved Classic game), only PLAY renders — exact current behavior.

---

## ChapterMap — Resume Level N callout

**File:** `src/components/ChapterMap.tsx`

Add two optional props:

```tsx
interface Props {
  onBack: () => void;
  onSelectLevel: (levelId: number) => void;
  savedRunLevelId?: number | null;      // NEW
  onResumeRun?: (levelId: number) => void;  // NEW
}
```

When `savedRunLevelId` is non-null AND `onResumeRun` is provided, render a callout banner **above the existing bottom-level-card** (between the map area and the bottom card). On tap → `onResumeRun(savedRunLevelId)`.

Banner visual: thin horizontal pill, brand tokens (jade bg or amber bg, tan text). Copy: "Resume Level N-N · in progress" with a small arrow. Hugs the right edge or full-width — match Marcus's design tokens.

The existing bottom "level card" stays as-is (always shows the active-progress level, separate from mid-match resume).

**Behavior edge cases:**
- `savedRunLevelId === activeIdx`: the resume callout and the bottom card both point at the same level. The callout still says "Resume" (resumes the saved match); the bottom card still says "START / RESUME" but that's about campaign progress, not mid-match. Acceptable. Two affordances, two semantics, both clear in copy.
- `savedRunLevelId !== activeIdx`: callout points to the saved level, bottom card points to the next progress level. Player can pick.

---

## Orphan-bug fix verification

With `currentLevelId` on the save:
- **Classic Continue** only appears on the Classic card when `savedSnapshot.currentLevelId === null`. A Run save (number) can never trigger this affordance.
- **Run Resume** only appears in ChapterMap when `savedSnapshot.currentLevelId !== null`. A Classic save can never trigger this affordance.
- A Run save can no longer load into a Classic frame because there is no path that does so — every entry point inspects `currentLevelId` first.

The orphan-tab-close bug from the diagnosis is now structurally impossible.

---

## Tests

**File:** `tests/game/persistence.test.ts` — add 3 specs:

1. **`saveGame writes currentLevelId and loadGame returns it`** — round-trip with `currentLevelId: 5`. Loaded value === 5.
2. **`saveGame with null currentLevelId round-trips as null`** — explicit Classic-save case.
3. **`v2 migration: legacy v2 snapshot (no currentLevelId) loads with null`** — write a v2-shape snapshot manually (`{ version: 2, game, tracker }`), load, expect `currentLevelId === null`.

The existing legacy-save tests (`legacy save (bare GameState...)`, `legacy save defaults dumpActive to false`) still pass — those paths default `currentLevelId: null` too.

Existing `saveGame + loadGame round-trip` and tracker tests need an update to pass the new third arg. Easiest: helper wrapper:

```ts
function save(s: GameState, t: CardTrackerState, currentLevelId: number | null = null) {
  saveGame(s, t, currentLevelId);
}
```

Use it instead of direct `saveGame()` calls. Test count: 328 → 331.

---

## Constraints checklist

| Constraint | Satisfied by |
| ---------- | ------------ |
| Engine purity intact | Persistence + UI only; `src/engine/` untouched. |
| Migration must be tested | New v2→v3 migration test. |
| Tests + `tsc -b` green | Update existing test fixtures + add 3 specs. |
| Marcus-approved home layout | Footer link removed (one less element); cards get per-mode affordances; no new chrome added. |
| Brand tokens | Jade/tan/brown on Classic Continue + ChapterMap callout. |
| No new heavy deps | Pure React + inline styles. |

---

## Out of scope (explicit)

- **Resume-Run-from-home-card.** Per spec the Run card RESUME always goes to chapter map, not straight into the match. Mid-match resume is reached via the chapter map's callout.
- **Save management UI** (delete saved game manually). Not needed; clearing is handled implicitly by new-game/quit flows.
- **Multiple parallel saves** (one Classic + one Run). Single slot still — Classic save and Run save overwrite each other. Not a launch blocker; if it becomes one, separate ticket.
- **Tracking which level a player was last in for the chapter map callout when no mid-match save exists.** The existing "active node" logic (first unlocked-but-incomplete level) covers that.

---

## Definition of done

- `persistence.ts` schema v3, `currentLevelId` field, graceful v2 migration to `null`.
- `useGameController` accepts and threads `currentLevelId` to `saveGame`.
- `App.tsx` reads `savedSnapshot`, exposes `continueClassic` + `continueRunFromMap`, removes global "Continue saved game" link, fixes Run descriptor to branch three ways.
- `ClassicHeroCard` accepts `onContinue?` and renders a small Continue pill when present.
- `ChapterMap` accepts `savedRunLevelId?` + `onResumeRun?` and renders a callout when both set.
- 3 new persistence tests; existing tests updated for the new `saveGame` signature.
- 328 → 331 tests green. `tsc -b` exit 0.
- Manual orphan-bug verification: a Run save cannot load into a Classic frame (confirmed structurally because no path routes a non-null `currentLevelId` save through the Classic Continue affordance).
