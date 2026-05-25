# Home Screen Saved-Game Handling — Pre-Build Read-Only Diagnosis

**Track:** `Home Screen Saved-Game Handling — Read-Only Diagnosis (pre-build)` — `36a2f266-2cac-8196-af1f-fa4f53adc69e`, P2, May 24 2026.
**Type:** Read-only. No code changes. No tests added.

---

## Headline verdict

**Per-mode saved-game separation is a state-shape change, not a UI wiring job.** The persisted save is a single global slot keyed `stacked-v2-game` with no mode discriminator — a mid-Run-match save and a Classic mid-match save are structurally indistinguishable on disk. Splitting Continue vs RESUME RUN per the TC spec requires adding mode context to the persisted snapshot.

**Two paths, both viable:**
- **Tonight minimal (~10 LOC, zero state-shape, zero migration):** kill the global "Continue saved game" link, fix the "Resume your run" copy mismatch when `runStatus === 'complete'`. Doesn't deliver per-mode resume; just removes the broken bits. Saved games get orphaned for now.
- **Week-1 full split (~60-80 LOC + grace migration):** add `currentLevelId: number | null` (or a `mode: 'classic' | 'run'` tag) to the persisted snapshot. Per-card Continue/Resume affordances, route correctly per mode. **Also fixes a real bug** (see Finding #6 below).

**Recommend doing both: minimal tonight to unblock launch surface; week-1 track for proper per-mode resume.**

---

## 1. Saved-game persistence model

**File:** `src/game/persistence.ts`
**Storage key:** `'stacked-v2-game'` at [persistence.ts:6](src/game/persistence.ts:6).
**Schema version:** `SCHEMA_VERSION = 2` at [persistence.ts:7](src/game/persistence.ts:7).

**Shape** (PersistedSnapshot, `persistence.ts:25-29`):
```ts
{
  version: number;
  game: GameState;        // full engine state — hands, board, scores, settings, etc.
  tracker: PersistedTracker;
}
```

**Single global slot. No mode keying.** `GameState.settings` carries `targetScore`, `bot1Personality`, `bot2Personality`, optional `hintStripEnabled`, optional `disableSeatingSwap` — none of these distinguish "this was a Run level 5 game" from "this was a Classic Calvin-vs-Nina game" except indirectly via bot mix. There is **no `mode` field, no `currentLevelId` field, no `source: 'classic' | 'run'` discriminator** anywhere in the persisted blob.

**Save call sites** (single slot is written from one function — [persistence.ts:60](src/game/persistence.ts:60) `saveGame`):
- `useGameController.ts:100` — inside `setAndPersist`, called on every state transition (`:134, :144, :160, :170, :183, :191, :304, :368, :408, :423, :437, :444, :451`).

**Load call site:** `useGameController.ts:87` inside `useState` initializer. Returns the saved GameState directly if present. No mode validation — just loads whatever's there.

**Clear call sites:**
- `useGameController.ts:192` — on END_GAME (game-over auto-clear).
- `App.tsx:32, 55, 61, 66, 75, 91` — on every nav transition (new game, home, world-map, play-again, next-level, level-select).

**So:** quitting mid-game via the in-app nav (Home button, World Map button, etc.) deletes the save. **Only orphan-save path is closing the tab mid-match.** That's how a Run match ends up loaded into a Classic frame (Finding #6).

---

## 2. The global "Continue saved game" link

**Location:** [App.tsx:218-224](src/App.tsx:218) inside `TitleScreen`.

```tsx
{onContinue && (
  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, flexShrink: 0 }}>
    <button onClick={onContinue} ...>
      Continue saved game
    </button>
  </div>
)}
```

- **Gated by `onContinue` prop**, passed from `App.tsx:129`:
  ```tsx
  const hasSave = !!loadGame();
  // ...
  onContinue={hasSave ? continueGame : undefined}
  ```
  `loadGame()` runs at every App render — minor inefficiency, not a correctness issue.

- **`continueGame` action** at `App.tsx:50-52`:
  ```tsx
  const continueGame = useCallback(() => {
    setScreen('game');
  }, []);
  ```
  Sets screen to 'game'. **Does NOT touch `currentLevelId`** — leaves whatever React state holds (defaults to `null` on cold app start). **This is the bug carrier** (Finding #6).

- **No mode awareness.** The link doesn't know if the saved game is from Classic or Run. It just loads whatever `loadGame()` returns into the active GameWrapper.

---

## 3. The Run — campaign progress vs mid-match save

**Two separate storage keys, two separate concerns:**

| Storage key | What | Where written | Where read |
| ----------- | ---- | ------------- | ---------- |
| `stacked_v2_adventure_progress` | Campaign progress: `unlockedLevels[]`, `starsPerLevel{}`, `lastCompleted`, `totalStars` | `progressManager.ts:190` (`saveProgress`), called from `App.tsx:486` after Run level completion | `progressManager.ts:207` (`loadProgress`), called from `App.tsx:484, 523`; also `progressManager.ts:248` (`getRunStatus`) for home-screen verb selection |
| `stacked_v2_jett_unlocked_classic` | Boolean — Jett available in Classic Setup | `progressManager.ts:168` after final-level completion at `App.tsx:487-489` | `progressManager.ts:160` (`isJettUnlockedInClassic`) presumably from `ClassicSetup` |
| `stacked-v2-game` | **Single saved-match slot** (shared by Classic AND Run) | `useGameController.ts:100` | `useGameController.ts:87` |

**Campaign progress and mid-match save are properly separated.** That's good. **What's NOT separated:** the mid-match save itself — a Run match-in-progress and a Classic match-in-progress write to and read from the same `stacked-v2-game` slot.

**Resume The Run today** (`App.tsx:128`, `TitleScreen.onAdventure`):
```tsx
onAdventure={() => setScreen('worldMap')}
```
Goes to the chapter map (`ChapterMap` component at `App.tsx:84-97`). **Does NOT load any mid-level saved match.** The chapter map only knows about completed-level progress, not mid-match saves. So if a player closes the tab mid-Run-level-5, then reopens, taps RESUME on the Run card → they land on the chapter map showing world progress, NOT back in their level-5 match.

The orphan mid-Run-match save sits in localStorage, invisible to the Run flow, but visible to the **global "Continue saved game" link** — which then loads it without level context. See Finding #6.

---

## 4. Home-screen entry-button logic

**File:** `src/App.tsx`, the `TitleScreen` component at `:162-280`.

**Run card verb hierarchy** is implemented via `runStatus: RunStatus` from `progressManager.getRunStatus()`. Three states:

| `runStatus` | Source ([progressManager.ts:248-262](src/engine/adventure/progressManager.ts:248)) | Button verb ([App.tsx:428](src/App.tsx:428)) |
| ----------- | -------- | ----------- |
| `'fresh'` | no `stacked_v2_adventure_progress` in localStorage | `BEGIN` |
| `'in-progress'` | save exists, < 12 levels completed (`(stars[id] ?? 0) > 0` for each level) | `RESUME` |
| `'complete'` | save exists, all 12 levels with ≥ 1 star | `NEW RUN` |

So the **button verb** is correct per spec. The **descriptor text** at `App.tsx:419-426` is wrong though:

```tsx
{returning ? (
  <><span style={{ color: TAN, fontWeight: 600 }}>Resume your run</span><br/><span style={{ color: 'rgba(255,255,255,0.5)' }}>{TOTAL_LEVELS} levels · 4 worlds</span></>
) : (
  <><span style={{ color: TAN, fontWeight: 600 }}>{TOTAL_LEVELS} levels</span><br/><span style={{ color: 'rgba(255,255,255,0.5)' }}>4 worlds to conquer</span></>
)}
```

`returning = runStatus === 'in-progress' || runStatus === 'complete'` (line 371). So in **both** RESUME and NEW RUN states, the descriptor reads "Resume your run." For NEW RUN (run complete), it should say something else — "Start a fresh run" or similar. **Copy bug, not a logic bug.** The button verb branches three ways, but the descriptor only branches two ways. Two-line fix.

---

## 5. Classic resume today

Yes, Classic matches are persisted to the same `stacked-v2-game` slot — every turn during play, via `useGameController.setAndPersist` (`useGameController.ts:100`). **No way to resume a Classic match other than the global "Continue saved game" link.** There's no per-mode resume affordance on the Classic card today.

`ClassicSetup` flow at `App.tsx:100-107` always calls `startWithSettings` → which calls `clearSavedGame()` at `:32` before starting fresh. So clicking PLAY on the Classic card **wipes any in-progress Classic save** and starts new. The Classic card has no opinion about an existing save.

---

## 6. The orphan-Run-save bug (active, not theoretical)

Repro:
1. Start Run level 5. `setAndPersist` writes the GameState to `stacked-v2-game` on every turn.
2. **Close the browser tab mid-match** (not via the in-app Home/World Map buttons — those clear the save at `App.tsx:55, 61`).
3. Reopen the app. `App.tsx:124` runs `loadGame()` → returns the saved Run match → `hasSave === true` → "Continue saved game" link shows.
4. Tap "Continue saved game" → `continueGame` → `setScreen('game')`.
5. `currentLevelId` in React state is `null` (cold app start). `GameWrapper` renders with `currentLevelId={null}`.
6. **The Run match is now loaded into a Classic-mode frame.** No level objective UI, no `LevelCompleteOverlay`, no star calculation, no campaign progress write on completion. The player plays out their level-5 game as if it were a Classic match, scores points, hits target, sees the generic Classic game-over screen, and nothing updates `stacked_v2_adventure_progress`.

**This is broken today.** The minimal fix (kill the global link) at least makes the Run save inaccessible/inert instead of mis-routing. The full per-mode split (week-1) properly resumes Run matches back into their level context.

Edge severity: orphan saves only happen on tab-close mid-match, which is rare but happens (phone hides app, browser eats tab, refresh during testing). For launch, the minimal fix is enough; the bug becomes invisible once the global link is gone. For long-term correctness, the per-mode split is needed.

---

## 7. Change surface — minimal vs full split

### Tonight minimal fix (~10 LOC, zero state-shape, zero migration)

**File: `src/App.tsx`**
1. **Remove** the "Continue saved game" footer at `:218-224`. Remove `onContinue` prop entirely from `TitleScreen` signature at `:162` and from the props destructure. Remove `hasSave` + `loadGame()` at `:124, :129`. Remove `continueGame` callback at `:50-52`.
2. **Fix the descriptor mismatch** at `:419-426`: branch three ways instead of two. `runStatus === 'complete'` → "Start a fresh run" or "Run complete · start over"; `'in-progress'` → "Resume your run"; `'fresh'` → existing fallback.
3. **Defensive cleanup** at app boot (optional but recommended): in `main.tsx`, if `loadGame()` returns truthy AND we're on a fresh cold start, just call `clearSavedGame()`. Eliminates orphan saves. **Optional** — could also defer to week-1.

**Net effect:** Run card RESUME goes to chapter map (today's behavior, correct). Classic card PLAY starts fresh (today's behavior, fine). No way to resume a mid-match Classic game (regression — but Classic matches are short, and resume-Classic wasn't called out in the TC spec as a launch requirement). Orphan Run saves can't mis-route into Classic frames. Copy mismatch fixed.

### Week-1 full per-mode split (~60-80 LOC + grace migration)

**File: `src/game/persistence.ts`**
1. Add `currentLevelId: number | null` field to `PersistedSnapshot`. Bump `SCHEMA_VERSION = 3`.
2. Update `saveGame` signature to accept `currentLevelId`. Update `loadGame` to return it on the `LoadedSave` shape.
3. Graceful migration: v2 snapshots → treat as Classic (currentLevelId = null). No data loss.

**File: `src/game/useGameController.ts`**
1. Pass `currentLevelId` through to `setAndPersist` → `saveGame`. Requires plumbing the prop down from App or having the controller accept it.
2. On load, return the `currentLevelId` to App so App can restore `setCurrentLevelId` before rendering.

**File: `src/App.tsx`**
1. Remove the global "Continue saved game" link (same as minimal).
2. **Classic card** — if a saved game exists AND `currentLevelId === null`, show a small `Continue ›` affordance under PLAY. Tap → setScreen('game') with the saved settings.
3. **Run card** — RESUME stays. If a saved game exists AND `currentLevelId !== null` (mid-level Run match), the chapter map should surface a "Resume Level N" callout when the player lands there — so RESUME → chapter map → optional "Resume Level N" tap → back into the match.

**Tests**: persistence has 10 existing tests at `tests/game/persistence.test.ts`. Add ~4 specs for the new field (presence after save, presence after load, missing-field migration → null, mode-correct routing).

---

## 8. Recommendation

1. **Tonight: minimal fix** to ship a coherent home screen for launch. Removes broken bits, fixes copy mismatch. Saved-game resume becomes effectively unsupported across both modes, but neither mode regresses observably (Classic was short anyway, Run has chapter-map progress to fall back on).
2. **Week-1: per-mode split track** with state-shape change for proper "Continue → Classic match" and "Resume → Run level-N match" behavior. Migration is trivial (v2 → v3, default `currentLevelId: null` = Classic).
3. **Out of this track entirely**: in-game pause/save UX, save-slot management, multiple parallel saves. Those are bigger separate concerns and not on the launch path.

---

## 9. Risks if we ship without either fix

1. Orphan Run saves mis-route into Classic frames on tab-close → silent data loss (no campaign progress update), confusing UX. Low-frequency but real.
2. Run card copy says "Resume your run" when `runStatus === 'complete'` → "RESUME a complete run" is contradictory; new players might think the button does something it doesn't.
3. The global "Continue saved game" link's detached visual position (below mode cards) communicates "this is a third option" when really it's a poorly-scoped resume affordance for the most recent ANY-mode match.

---

## 10. File:line summary

| Concern | Location |
| ------- | -------- |
| Save key | [`src/game/persistence.ts:6`](src/game/persistence.ts:6) |
| Save shape | [`src/game/persistence.ts:25-29`](src/game/persistence.ts:25) |
| saveGame entry | [`src/game/persistence.ts:60`](src/game/persistence.ts:60) |
| loadGame entry | [`src/game/persistence.ts:73`](src/game/persistence.ts:73) |
| clearSavedGame | [`src/game/persistence.ts:114`](src/game/persistence.ts:114) |
| Controller save plumbing | [`src/game/useGameController.ts:97-101`](src/game/useGameController.ts:97), [`:87-95`](src/game/useGameController.ts:87) |
| Home-screen hasSave check | [`src/App.tsx:124, 129`](src/App.tsx:124) |
| Continue-saved-game link | [`src/App.tsx:218-224`](src/App.tsx:218) |
| continueGame action | [`src/App.tsx:50-52`](src/App.tsx:50) |
| Run card BEGIN/RESUME/NEW RUN verb | [`src/App.tsx:428`](src/App.tsx:428) |
| Run card descriptor (mismatch bug) | [`src/App.tsx:419-426`](src/App.tsx:419) |
| getRunStatus | [`src/engine/adventure/progressManager.ts:248-262`](src/engine/adventure/progressManager.ts:248) |
| Run progress key | [`src/engine/adventure/progressManager.ts:STORAGE_KEY`](src/engine/adventure/progressManager.ts) (= `stacked_v2_adventure_progress`) |
| Jett unlock key | [`src/engine/adventure/progressManager.ts:JETT_UNLOCK_KEY`](src/engine/adventure/progressManager.ts) (= `stacked_v2_jett_unlocked_classic`) |
| App-side clearSavedGame call sites | `src/App.tsx:32, 55, 61, 66, 75, 91` |

Diagnosis complete. No code touched. Ready to size and spec the build per TC's choice (minimal tonight / full split week-1 / both).
