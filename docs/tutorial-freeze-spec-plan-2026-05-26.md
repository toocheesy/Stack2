# Tutorial Freeze — Spec + Plan

**Track:** `Fix — Freeze gameplay while tutorial overlay is active` — `36c2f266-2cac-81d3-a6a4-c7c152c6b0f8`.
**Small surgical refactor — combined spec + plan in one doc.**

---

## Diagnosis (read-only result)

**Active surfaces during tutorial today:**

| Source | Triggers | File:line |
| ------ | -------- | --------- |
| Initial bot turn on mount | `useEffect([])` fires `runBotTurn(state)` if state.currentPlayer !== 0 | `useGameController.ts:324-333` |
| Bot thinking + decision sequence | `setBotViz` + 3 awaited `wait()`s (1.5-2.5s thinking, 2s combo display, 500ms post-action) | `:223-319` |
| Recursive turn advance | end of runBotTurn calls `advanceRef.current(next)` | `:319` |
| Jackpot beats (in advanceRef) | 2500ms wait + setJackpotInfo | `:171, :195` |
| Inter-action settle | 500ms wait between bot turns | `:175, :317` |

**Player input** is already blocked — `TutorialOverlay`'s scrim has `pointerEvents: 'auto'`. Taps/drags don't reach GameView. ✓ no fix needed there.

**Bug class:** orchestration layer auto-fires regardless of overlay state. No `tutorialActive` signal threads into `useGameController`.

---

## Architecture

**Move tutorial state up from GameView to GameWrapper** so both `useGameController` AND `GameView` see it via the same source.

Why this isn't optional: `useTutorial` is called from GameView today, but `useGameController` is called from GameWrapper (one level up). Effect ordering means the tutorial-open setState fires on a later render than useGameController's mount effect — so even if we passed visible via a ref, the first mount of useGameController would have stale tutorialActive=false and fire the bot before the tutorial visually opens.

**Fix:** compute the initial visible flag synchronously at GameWrapper render time, pass it into `useTutorial(8, initialVisible)`. That way `tutorial.visible === true` on the very first GameWrapper render, and useGameController's `tutorialActive` prop is true from the jump.

---

## What changes

### 1. `useTutorial(totalSteps, initialVisible = false)`

Accept an optional `initialVisible` argument. Defaults false. Used by GameWrapper to start the tutorial open on first W1L1 entry without an effect round-trip.

### 2. `useGameController(seed, settings, currentLevelId, tutorialActive)`

Add `tutorialActive: boolean` as the fourth positional arg.

Internal:
- `tutorialActiveRef = useRef(tutorialActive)` updated on every render so async paths see the latest value.
- **Replace** the standalone initial-bot-turn `useEffect([])` at `:324-333` with a `useEffect([tutorialActive])` that:
  - Fires `runBotTurn(stateRef.current)` whenever `!tutorialActive && state.currentPlayer !== 0 && !botBusyRef.current && !gameOver`.
  - Covers both first-mount (when tutorial is not opening) AND tutorial-close resumption.
  - Mounted-ref setup stays in its own mount-only effect (no logic change there).
- `runBotTurn` first-line guard adds `|| tutorialActiveRef.current`.
- **Three gate checkpoints inside `runBotTurn`** after each `await wait(N)`:
  - After thinking delay (`:232`)
  - After bot combo display (`:281`)
  - After post-action settle (`:317`) — gate before the recursive `await advanceRef.current(next)` at `:319`
- On each gate hit: clean up visuals (`setBotViz(null)`, `setBotCombo(null)`), reset `botBusyRef.current = false`, return. State has not been mutated past the latest `setAndPersist` so resume re-runs cleanly.

### 3. GameWrapper

- Compute `tutorialShouldAutoOpen = currentLevelId === 1 && !loadTutorialSeen()` at the top (synchronous).
- Call `const tutorial = useTutorial(8, tutorialShouldAutoOpen)`.
- Move the replay-token effect from GameView to here: `useEffect(() => { if (token > 0) tutorial.open(); }, [token])`.
- Pass `tutorial.visible` as the 4th arg to `useGameController(seed, settings, currentLevelId, tutorial.visible)`.
- Pass the full `tutorial` API down to GameView via prop (replaces the in-GameView `useTutorial` call).

### 4. GameView

- Remove `useTutorial(8)` and the two effects (auto-fire + replay-token).
- Accept `tutorial: TutorialApi` as a prop.
- Use `tutorial.visible` / `tutorial.currentStep` / etc. where the local `tutorial` was used.
- `tutorialShowGhostActions = tutorial.visible` stays.
- Remove unused `loadTutorialSeen` and `useTutorial` imports.
- `tutorialReplayToken` prop is no longer needed on GameView (moved to GameWrapper).

### 5. App

- Same `tutorialReplayToken` state + `replayTutorial` callback. Already wired to GameWrapper.
- No changes needed; `tutorialReplayToken` continues to flow App → GameWrapper.

---

## Files modified

| File | Change | LOC delta |
| ---- | ------ | --------- |
| `src/tutorial/useTutorial.ts` | Add `initialVisible` parameter | +2 |
| `src/game/useGameController.ts` | Add `tutorialActive` param + ref, replace mount effect, add 3 gate checkpoints | ~+40 |
| `src/App.tsx` | GameWrapper: hoist tutorial state, compute initial visible, replay-token effect here, pass tutorial down | ~+25 |
| `src/components/GameView.tsx` | Remove local tutorial state + effects + tutorialReplayToken prop; accept `tutorial` prop | ~-30 |

**Net:** ~+40 LOC, with ~30 moved from GameView to GameWrapper.

---

## Tests

The bot-turn gate is inherently integration-shaped (touches React state + async + PRNG). Unit-testing it cleanly requires `@testing-library/react` which isn't a dep. Existing tutorial-state and persistence tests still cover the state-machine surface.

**Honest skip** the gate-integration test per ticket guidance. Playtest covers behavior:
- First W1L1 entry with bot dealer → bot does NOT fire while overlay is up.
- Replay-from-Settings mid-bot-turn → bot freezes (clean cleanup, no stuck spinners), resumes on dismiss.
- After dismiss → if it's a bot's turn, bot fires correctly without skipping.

Existing 336 tests stay green.

---

## Constraints checklist

| Constraint | How |
| ---------- | --- |
| Controller layer only, no `src/engine/` | All edits in `src/game/useGameController.ts`, `src/tutorial/`, `src/App.tsx`, `src/components/GameView.tsx` |
| Overlay does not mutate game state | Tutorial state is React + localStorage only. Bot turns gate BEFORE `setAndPersist`; state stays untouched on gated returns. |
| `tsc -b` clean | Typed prop additions; no `any` leaks |
| Tests green | 336 → 336 (no new tests, no removed tests) |
| No skipped or double turns | Mid-turn gate returns without dispatching; resume effect re-fires `runBotTurn` from the current persisted state. The bot starts fresh with the same PRNG state → makes the same decision. |

---

## Definition of done

- `useTutorial(8, initialVisible)` accepts the second arg.
- GameWrapper computes `tutorialShouldAutoOpen` synchronously and owns the tutorial state.
- `useGameController(s, settings, levelId, tutorialActive)` gates the bot-trigger paths.
- First W1L1 entry: bot doesn't fire, no thinking indicators, board dead-still.
- Replay mid-game: in-flight bot turn gets gated cleanly (visuals reset, no stuck spinner).
- Dismiss: bot turn resumes cleanly from persisted state.
- 336 tests still green. `tsc -b` exit 0.
- `grep -r "from .*tutorial" src/engine/` returns empty.
