# Overtime Tie-Breaker — Spec

**Track:** `Overtime Tie-Breaker — Game-End Logic Fix (doctrine 5.4)` — `36a2f266-2cac-81e6-8cd1-c80edfca18f7`.
**Diagnosis input:** `docs/overtime-tiebreaker-diagnosis-2026-05-24.md` (+ correction noted below).
**Plan output:** `docs/overtime-tiebreaker-plan-2026-05-24.md` (next).

---

## Correction to diagnosis assumption

The original ticket framed the fix as living in `src/engine/roundManager.ts`. Mid-build review showed that file's `findWinner` + `resolveRoundEnd` are **dead code in production** — only `gameLogic.test.ts` and the `engine/index.ts` barrel re-export touch them. Same for the `EventBus` class (no `bus.emit()` anywhere in production paths).

The **actual production game-end decision** is `determineTurnResult` at `src/engine/core/turnManager.ts:51-106`, called every turn from `useGameController.ts:125`. At round boundary it projects the jackpot and decides `END_ROUND` vs `END_GAME` via the `qualifyingWinners` block at `turnManager.ts:83-97`. That block has **no `lastCapturer` tiebreak at all** — on tied leaders at/above target the loop only updates `winner` on strict `>`, so the first qualifier in `[0, 1, 2]` order wins (Player always beats Bot 1, Bot 1 always beats Bot 2).

**Scope decision (confirmed with TC):** fix `turnManager.ts` only. Leave dead `roundManager.ts` and `EventBus` alone — flag as separate dead-code cleanup ticket later. Expose `isOvertime` on the `TurnResult.END_ROUND` variant (not on `EventBus` events, which are unused).

---

## What changes

### 1. `src/engine/core/turnManager.ts` — game-end branch

Replace the `qualifyingWinners` block at `:83-97` with three-way logic:

- Compute `maxScore` across `projectedOverall`.
- If `maxScore < targetScore` → return `END_ROUND` (existing path, `isOvertime: false`).
- If `maxScore >= targetScore` AND exactly one player has `=== maxScore` → return `END_GAME` with that player.
- If `maxScore >= targetScore` AND two or more players have `=== maxScore` → return `END_ROUND` with `isOvertime: true`. Game does NOT end. The controller will continue into a new round with cumulative scores preserved (existing END_ROUND continuation).

`isOvertime: false` is set on the non-overtime END_ROUND for symmetry (clearer state, easier overlay branching later).

### 2. `src/engine/types/index.ts` — TurnResult shape

Add `isOvertime: boolean` to the `END_ROUND` variant of the `TurnResult` union. Required (not optional) so the controller and tests don't have to guard for `undefined`. `END_GAME` does not gain the flag — game-over is mutually exclusive with overtime.

### 3. `src/game/useGameController.ts` — thread the signal onto state

The controller already handles `END_ROUND` at `:150-171`: applies jackpot, persists state, sets `gamePhase: 'roundEnd'`. Add the `isOvertime` flag onto the persisted state so the future overlay track can read it via `state.isOvertime`.

This adds **one field to `GameState`**: `isOvertime: boolean`. Initialized to `false` in `createInitialState`, set to `true` when the controller persists an overtime END_ROUND, reset to `false` when `startNewRound` runs (so the flag describes "this round IS overtime," not "previous round was overtime").

### 4. `src/engine/core/gameState.ts` — state field initialization

- `createInitialState` returns `isOvertime: false`.
- `startNewRound` returns `isOvertime: false` (overrides on next END_ROUND if tie persists).

The controller is responsible for FLIPPING the flag to `true` after `startNewRound` runs IF the new round is an overtime continuation — wait, that's wrong. Cleaner: the controller persists `isOvertime: true` BEFORE calling `startNewRound` (during the roundEnd phase). Then `startNewRound` resets to `false`. The new round itself isn't "in overtime" from a state-flag perspective; what's "in overtime" is the round-end overlay that's about to show.

**Revised:** `isOvertime` lives on the state ONLY during `gamePhase === 'roundEnd'`. It's set by the controller when the END_ROUND TurnResult carries `isOvertime: true`. `startNewRound` resets it to `false`. The overlay (future track) reads it while `gamePhase === 'roundEnd'`.

### 5. Test updates — `src/engine/core/__tests__/gameLogic.test.ts`

**Replace** the existing `'lastCapturer wins when scores are tied at target'` test at `:262-268` with new doctrine-5.4 behavior tests. The old test asserts behavior that doctrine 5.4 explicitly retires.

**Add** six new specs covering the build ticket's test list (full list below).

Tests can be authored against `determineTurnResult` directly — that's the function under test. The dead `findWinner` reference in the existing tiebreaker test will be removed; tests for the dead `findWinner` and `resolveRoundEnd` describe blocks stay UNCHANGED (still pass against the existing dead code; we're not touching it).

### 6. Out of scope (explicit non-changes)

- `src/engine/roundManager.ts` — dead. Untouched.
- `src/engine/events.ts` — dead EventBus + unused `round_end` payload. Untouched.
- `src/components/RoundEndOverlay.tsx` — no UI in this track.
- `src/engine/ai/evaluator.ts` `lastCapturer` references — in-round AI denial bonuses, unaffected.
- Adventure mode (`src/engine/adventure/`) — overtime trigger only fires on `>= targetScore` ties; Adventure levels resolve on objective, not game-end target, so overtime is structurally unreachable in adventure flow. No changes needed.

---

## Doctrine + constraint checklist

| Constraint | How spec satisfies |
| --- | --- |
| Doctrine 5.4 — tie at/above target → full additional round, recursive until clear winner | `END_ROUND` with `isOvertime: true` on ties; controller continues via existing END_ROUND flow; recursion automatic via re-entry into `determineTurnResult` next round-end. |
| Game-over check is round-boundary only | `determineTurnResult` only reaches the qualifyingWinners block when both `anyPlayerHasCards(state) === false` AND `state.deck.length < 12` — same round-boundary gate as today. |
| `targetScore` configurable, never hardcode 300 | Continue reading `state.settings.targetScore` (already used at `turnManager.ts:76`). |
| Pure-function engine — no React/Motion/DOM/window | All changes are in `turnManager.ts`, `types/index.ts`, `gameState.ts`. Controller change in `useGameController.ts` already uses React (hook file) but adds no new React imports — just threads a boolean. |
| Immutable state — return new state objects | Existing `setAndPersist` spreads state; same pattern. |
| Seeded PRNG only — no `Math.random()` | No new randomness introduced. |
| Serializable JSON actions/events | `isOvertime: boolean` is JSON-native. `TurnResult` and `GameState` stay serializable. |
| `lastCapturer` still needed for jackpot resolution | `applyJackpot` (`gameState.ts:231-234`) untouched. `lastCapturer` only loses its role in the dead `roundManager.findWinner`, which we're leaving alone anyway. **Production code never used `lastCapturer` as a game-over tiebreaker** — that role only existed in dead code. |
| Expose `isOvertime` signal for future UI | Via `TurnResult.END_ROUND.isOvertime` + `GameState.isOvertime` during `gamePhase === 'roundEnd'`. |

---

## Tests to add (per build ticket)

All in `src/engine/core/__tests__/gameLogic.test.ts`, replacing the `tiebreaker` describe block. Each test exercises `determineTurnResult` on a round-boundary state (deck empty, all hands empty):

1. **Sole leader at/above target, strictly highest** → `END_GAME`, that player wins, `isOvertime` n/a (END_GAME variant has no flag).
2. **Player above target but NOT highest** (another sole player higher, also above target) → `END_GAME`, highest wins.
3. **Two players tied at max, both at/above target** → `END_ROUND` with `isOvertime: true`. Game does NOT end.
4. **Nobody at/above target** → `END_ROUND` with `isOvertime: false`. (Confirms the symmetry default.)
5. **Recursion** — start state with two players tied at max → END_ROUND/overtime, simulate `startNewRound`, addScore to break the tie → END_GAME with sole leader. Confirms recursion is path-driven, not state-flagged.
6. **Non-default `targetScore` (500)** — all the above hold with `targetScore: 500`. Specifically: two players at 500-500, third at 200 → overtime. Two players at 500-500, third at 600 → END_GAME (sole leader, but at 600 not 500).

Total new specs: 6. Replaces 1 deleted spec. Net add: +5. Test count: 321 → 326.

(Existing `findWinner returns null when nobody has reached target` test at `:270-273` stays as-is — it tests the dead `findWinner` and remains green against unchanged dead code. Same for the `resolveRoundEnd` describe block at `:297-336`. None of those are in scope to change.)

---

## Risks

1. **`gameState.isOvertime` field addition is a state-shape change.** Persisted localStorage games from before this build won't have the field. Reading `state.isOvertime` from old persisted state returns `undefined` → falsy → no overlay change. Safe by default. Add a tiny rehydration default if controller depends on strict boolean: `isOvertime: state.isOvertime ?? false`.
2. **Type checker may catch every `TurnResult.END_ROUND` consumer that doesn't handle the new field.** Required field forces explicit handling. Only consumer is `useGameController.ts:150`. One-line fix.
3. **No production code uses `EventBus` or `roundManager`, but tests do.** Leaving them alone is safe — tests continue passing — but technically the "remove lastCapturer game-over tiebreaker" ask in the ticket isn't fully satisfied in `roundManager.findWinner`. Recommend a follow-up ticket to either retire that dead path or align it with doctrine 5.4 for documentation consistency. Not a launch blocker.

---

## Definition of done

- `turnManager.ts` returns `END_ROUND` with `isOvertime: true` on tied leaders at/above target.
- `types/index.ts` `TurnResult.END_ROUND` carries required `isOvertime: boolean`.
- `useGameController.ts` threads the flag onto `GameState` during round-end persistence.
- `gameState.ts` initializes and resets `isOvertime: false`.
- 6 new tests pass. Old `lastCapturer` tiebreaker test removed.
- 321 → 326 tests green.
- No new React/Motion/DOM imports in engine files.
- `lastCapturer` still flowing through jackpot resolution (confirm via `applyJackpot` tests still green).
