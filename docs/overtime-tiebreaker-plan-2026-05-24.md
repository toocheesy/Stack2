# Overtime Tie-Breaker — Plan

**Spec:** `docs/overtime-tiebreaker-spec-2026-05-24.md`.
**Five subsystems, executed in order. Each is a discrete edit.**

---

## S1 — Type: add `isOvertime` to TurnResult.END_ROUND

**File:** `src/engine/types/index.ts`

At the END_ROUND variant of `TurnResult` (lines 168-173), add a required `isOvertime: boolean` field. Doc-comment one line: overtime continuation per doctrine 5.4.

```ts
| {
    type: 'END_ROUND';
    scores: Scores;
    jackpotResult: JackpotResult | null;
    newDealer: PlayerIndex;
    isOvertime: boolean;        // doctrine 5.4
  }
```

END_GAME variant unchanged.

---

## S2 — Type + state: add `isOvertime` to GameState

**File:** `src/engine/types/index.ts`

Add `isOvertime: boolean` to the `GameState` interface (after `dumpActive` at :116). One-line doc comment: true during `gamePhase === 'roundEnd'` when the round-end was triggered by a tie at/above target.

**File:** `src/engine/core/gameState.ts`

Three init/reset points:
- `createInitialState` at :91-109 — add `isOvertime: false` to the returned object.
- `startNewRound` at :269-285 — add `isOvertime: false` to the returned object (carries over from `...state` but we want to explicitly reset; the cumulative scores carry but the overtime flag belongs to the prior round-end window).

(`dealNewHand` already uses `...state` spread so doesn't need a change — `isOvertime` carries through, which is correct mid-round.)

---

## S3 — Engine: rewrite turnManager game-end branch

**File:** `src/engine/core/turnManager.ts`

Replace lines 78-97 (the qualifyingWinners block) with three-way logic. Keep the `projectJackpot` call and `targetScore` read above unchanged.

```ts
const indices: PlayerIndex[] = [0, 1, 2];
const scoresAtMax: { player: PlayerIndex; score: number }[] = indices.map((i) => ({
  player: i,
  score: projectedOverall[SCORE_KEYS[i]],
}));
const maxScore = Math.max(...scoresAtMax.map((s) => s.score));
const leaders = scoresAtMax.filter((s) => s.score === maxScore);

if (maxScore >= target) {
  if (leaders.length === 1) {
    const winner = leaders[0].player;
    return {
      type: 'END_GAME',
      scores: projectedOverall,
      jackpotResult,
      winner,
      winnerName: PLAYER_NAMES[winner],
    };
  }
  // Doctrine 5.4 — tied leaders at/above target trigger overtime.
  // Game does NOT end. Continue into a new round; recursion is automatic
  // via re-entry into determineTurnResult at the next round boundary.
  const newDealer = ((state.currentDealer + 1) % 3) as PlayerIndex;
  return {
    type: 'END_ROUND',
    scores: projectedOverall,
    jackpotResult,
    newDealer,
    isOvertime: true,
  };
}

const newDealer = ((state.currentDealer + 1) % 3) as PlayerIndex;
return {
  type: 'END_ROUND',
  scores: projectedOverall,
  jackpotResult,
  newDealer,
  isOvertime: false,
};
```

(Two `newDealer` computations are intentional — keeps the two return statements independent and readable; refactor later if it bothers anyone.)

---

## S4 — Controller: thread the flag onto persisted state

**File:** `src/game/useGameController.ts`

At the END_ROUND case (`:150-171`), capture `result.isOvertime` and include it when setting `gamePhase: 'roundEnd'`. Line 170 today:

```ts
setAndPersist({ ...stateRef.current, gamePhase: 'roundEnd' as const });
```

becomes:

```ts
setAndPersist({ ...stateRef.current, gamePhase: 'roundEnd' as const, isOvertime: result.isOvertime });
```

END_GAME case (:173-198) unchanged — game-over is mutually exclusive with overtime.

Optional defensive default for old persisted localStorage games: in the rehydration path, `isOvertime: state.isOvertime ?? false`. Locate via grep for `setAndPersist` or `getSavedGame` to confirm shape. If the rehydration code spreads the saved object directly, undefined-tolerant access via `state.isOvertime === true` is enough — the field is only read for overlay branching (future track), so undefined behaves as false naturally. **Decision: skip the rehydration patch unless we hit a TS error. Add it then.**

---

## S5 — Tests: replace tiebreaker block, add 6 specs

**File:** `src/engine/core/__tests__/gameLogic.test.ts`

**Delete** the existing `tiebreaker` describe at `:259-274` entirely. The `'lastCapturer wins when scores are tied at target'` test asserts retired behavior. The `'returns null when nobody has reached target'` test calls dead `findWinner` and is redundant with the new specs (new specs cover the same scenario via `determineTurnResult`).

**Add** new describe block `describe('overtime tie-breaker (doctrine 5.4)', ...)` at the same location with 6 specs targeting `determineTurnResult`. All use a round-boundary state (empty hands, empty deck, board cleared or held by lastCapturer for jackpot, scores configured to hit each branch).

Test helper pattern (each spec):
```ts
function endOfRoundState(opts: { p0: number; p1: number; p2: number; board?: Card[]; lastCapturer?: PlayerIndex; targetScore?: number }): GameState {
  // build a state with all hands empty, deck empty, scores set via addScore,
  // optional board for jackpot projection, optional non-default targetScore.
}
```

Six specs:

1. **`'END_GAME when sole leader is strictly highest at/above target'`** — p0=310, p1=200, p2=150 → END_GAME, winner=0.
2. **`'END_GAME picks strictly highest when multiple are above target'`** — p0=320, p1=305, p2=100 → END_GAME, winner=0 (NOT a tie because 320 > 305).
3. **`'END_ROUND with isOvertime=true when two players tied at max at/above target'`** — p0=300, p1=300, p2=200 → END_ROUND, isOvertime=true.
4. **`'END_ROUND with isOvertime=false when nobody at target'`** — p0=200, p1=200, p2=200 → END_ROUND, isOvertime=false.
5. **`'recursion — overtime that ties again triggers another overtime; resolves on sole leader'`** — start tied → overtime; simulate startNewRound + addScore to break tie → END_GAME. Confirms recursion is structural, not state-tagged.
6. **`'non-default targetScore (500) — tied at 500 triggers overtime; sole at 600 ends game'`** — same scenarios with `targetScore: 500` to prove no hardcoded 300.

Jackpot projection in test states: provide an empty board OR a board with `lastCapturer` set so `projectJackpot` runs cleanly. Spec 5 specifically wants to advance to a real new round, so it uses the controller-style flow: call `determineTurnResult` → if END_ROUND, run `startNewRound` (via direct call), addScore to one player to break the tie, then re-run `determineTurnResult` and expect END_GAME.

**Existing `findWinner` describe + `resolveRoundEnd` describe** at `:299-336` stay untouched — they test dead code that still passes against unchanged dead code. Out of scope per the spec.

**Test count:** 321 baseline − 2 deleted (`lastCapturer wins` + `returns null`) + 6 new = 325. Or 326 if the "returns null" spec stays because it's still passing against the dead path. Final count confirmed at suite-run time.

---

## Order of operations

1. **S1** (types) — add `isOvertime` to TurnResult.END_ROUND.
2. **S2** (types + state) — add `isOvertime` to GameState + reset in init/startNewRound.
3. **S3** (engine) — turnManager three-way branch. **TS compiler will flag missing field in all return statements until S1 is in.** So S1 before S3.
4. **S4** (controller) — thread to state. **TS will flag `result.isOvertime` access in controller until S1 is in.**
5. **S5** (tests) — replace tiebreaker block, add 6 specs.
6. **Vitest run** — confirm 321 → ~325-326 green.

Each step is small enough to land without checkpoint review. No commit between steps; one commit at the end after tests are green.

---

## Confirmations for completion report

- [ ] turnManager three-way branch in place.
- [ ] isOvertime on TurnResult.END_ROUND + GameState.
- [ ] Controller threads flag to state on END_ROUND.
- [ ] `lastCapturer` still routed to `applyJackpot` (untouched).
- [ ] Six tests added, one or two retired.
- [ ] 321 → 325-326 tests green.
- [ ] `git grep "from 'react'"` in `src/engine/` returns empty.
- [ ] `git grep "from 'motion'"` in `src/engine/` returns empty.
- [ ] No `Math.random()` introduced.
- [ ] Dead `roundManager.ts` + `EventBus` untouched (flagged for separate cleanup ticket).
