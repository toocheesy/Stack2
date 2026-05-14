# End-of-Hand + Round Mechanics — Diagnosis

**Track:** `VERIFY — End-of-Hand + Round Mechanics (B1 + B2)` — read-only diagnosis, P1.
**Doctrine ref:** `3562f2662cac8134b848d59ce9f08573` (sections 2.7 and 5.7 — currently listed as "pending" in the doctrine page; ticket text restates the rules inline, which is what this diagnosis treats as authoritative).
**Status:** Diagnosis complete. **No code changed.** Fix track to be drafted by Stacy.

---

## SECTION 1 — Forced-Placement Dump Diagnosis (B1)

### Doctrine 2.7 (per ticket)
- **Trigger:** a player places a card AND still has cards left AND is the only player with cards left (others have empty hands).
- **On trigger:** capture window slams shut at first place.
- **During the dump:** every subsequent turn by that player is a forced placement. No captures allowed regardless of board.

### Does the mechanic exist in code?
**No.** The trigger condition is *detected* (the turn correctly returns to the same player), but there is no flag, no capture lockout, and no UI affordance enforcing forced placement. The player retains full submit-combo capability.

### Where the trigger condition is detected — but nothing else happens

`src/engine/core/turnManager.ts:51-61`:
```ts
export function determineTurnResult(state: GameState): TurnResult {
  if (anyPlayerHasCards(state)) {
    const skipCurrent = state.lastAction === 'place';
    const next = findNextPlayerWithCards(state, skipCurrent);
    if (next !== null) {
      return { type: 'CONTINUE_TURN', nextPlayer: next };
    }
    if (skipCurrent && state.hands[state.currentPlayer].length > 0) {
      return { type: 'CONTINUE_TURN', nextPlayer: state.currentPlayer };  // ← dump branch
    }
  }
  ...
}
```

The branch on line 58–60 fires exactly when the doctrine trigger is met:
- `anyPlayerHasCards(state) === true` (current player still has cards),
- `state.lastAction === 'place'` (current player just placed),
- `findNextPlayerWithCards(state, skipCurrent=true)` returns null (the other two are empty).

It rolls the turn back to the same `state.currentPlayer`. **But it sets no flag, mutates no state — the returned `TurnResult` is just `{ type: 'CONTINUE_TURN', nextPlayer: state.currentPlayer }` with no marker that this is a dump scenario.**

### Why captures aren't blocked

`GameState` (`src/engine/types/index.ts:94-111`) has no field representing "forced placement active". It tracks `lastAction: 'capture' | 'place' | null`, `lastCapturer`, `gamePhase`, and per-hand metadata — but nothing for the dump phase.

`useGameController.submitCombo()` (`src/game/useGameController.ts:368-405`) only validates with `validateFullCombo(s)` and checks `botBusyRef`/`currentPlayer === 0`. There is no dump-phase short-circuit:

```ts
const submitCombo = useCallback((): string | null => {
  if (botBusyRef.current) return 'Not your turn';
  const s = stateRef.current;
  if (s.currentPlayer !== 0) return 'Not your turn';

  const validation = validateFullCombo(s);
  if (!validation.isValid) return validation.errors[0] ?? 'Invalid combo';
  ...
  const next = executeCapture(s, vc);  // executes regardless of dump state
  ...
}, [setAndPersist]);
```

`GameView.tsx` exposes the SUBMIT button purely on `isPlayerTurn && hasCombo && !botCombo` and `comboValid`:
```tsx
{isPlayerTurn && hasCombo && !botCombo && (
  <div style={{ display: 'flex', gap: 6 }}>
    <Btn label="SUBMIT" primary disabled={!comboValid} onClick={handleSubmit} />
    <Btn label="RESET" onClick={actions.resetCombo} />
  </div>
)}
```
No dump gating. Drag/tap into combo slots is also unrestricted.

Bot side: `botDecision.decideBotAction` (called from `useGameController.runBotTurn` line 246) chooses `capture` whenever `decision.action === 'capture'`. There is no dump-phase override that would force `place`.

### What the player observed, traced to code

1. Players 1 and 2 empty their hands. Player 0 still has cards.
2. Player 0 places a card. `executeTurn` → `placeCard` → `lastAction = 'place'`.
3. `advanceRef.current(next)` → `determineTurnResult`.
4. Branch on lines 58–60 fires → `CONTINUE_TURN, nextPlayer: 0`.
5. Player 0 is back on turn. `isPlayerTurn === true`. SUBMIT button is enabled if combo valid. **Capture executes normally.** Doctrine violated.

### Gap vs doctrine 2.7

| Doctrine                                              | Code today                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Capture window shuts the moment dump triggers         | No flag exists; window stays open                                         |
| All subsequent turns by lone player are forced places | Player gets free turns, can capture or place at will                      |
| Bots also forced to place during dump                 | Bots evaluate captures normally                                           |
| Dump persists until current player's hand is empty    | No state to "persist" — turn behavior never differs from a normal turn    |

### Surgical fix scope estimate
**Medium.** Touch points (estimate, for fix-track planning only — not implemented here):

1. `src/engine/types/index.ts` — add a `dumpActive: boolean` (or equivalent) field to `GameState`.
2. `src/engine/core/gameState.ts` — initialize false in `createInitialState`; reset on `dealNewHand` and `startNewRound` (after a deal, lone-player condition no longer holds).
3. `src/engine/core/turnManager.ts:58-60` — when entering the lone-player branch, signal the new flag state via the `TurnResult` (e.g., `CONTINUE_TURN_FORCED_PLACE` variant or carry a `dumpActive: true` payload). Or set the flag inside `useGameController` when this branch returns the same `currentPlayer` after a place.
4. `src/game/useGameController.ts:368` — short-circuit `submitCombo` when `state.dumpActive`.
5. `src/components/GameView.tsx` — hide SUBMIT/combo-build affordances when `state.dumpActive`; render a "FORCED PLACEMENT" hint (good candidate for the existing hint strip surface).
6. `src/engine/ai/botDecision.ts` — when `state.dumpActive`, force `decideBotAction` to return a placement action (skip capture evaluation entirely).
7. Tests: at minimum 3 new tests in `tests/engine/core/turnManager.test.ts` covering the lone-player branch and the dump-active reset on `dealNewHand`. Plus a `useGameController` integration test verifying `submitCombo` rejects when dump is active.

The core change is one boolean on `GameState`. Everything else is plumbing — flipping it on the trigger, resetting it on hand/round boundary, and gating the four call sites that currently allow captures.

---

## SECTION 2 — Round Position Rotation Diagnosis (B2)

### Doctrine 5.7 (per ticket)
- **HAND** = one deal of 4 cards.
- **ROUND** = first deal through deck empty + jackpot resolution.
- **GAME** = one or more rounds until target reached.
- Position rotates **only at the start of a new round**.
- Within a single round (multiple hands as deck depletes), positions are locked: dealer is dealer for the whole round; first player is first player for the whole round.

### Where turn order is assigned at hand start

The bug is a single 5-line block in `turnManager.determineTurnResult`:

`src/engine/core/turnManager.ts:63-69`:
```ts
if (state.deck.length >= 12) {
  const startingPlayer: PlayerIndex =
    state.lastAction === 'place'
      ? (((state.currentPlayer + 1) % 3) as PlayerIndex)  // ← rotates per-hand
      : state.currentPlayer;
  return { type: 'DEAL_NEW_HAND', startingPlayer };
}
```

This is the only place the new-hand starting player is computed. The result is consumed by `useGameController` at `src/game/useGameController.ts:135-143`:
```ts
case 'DEAL_NEW_HAND': {
  let next = dealNewHand(current);
  next = { ...next, currentPlayer: result.startingPlayer };  // ← applies the rotation
  ...
}
```

`dealNewHand` itself (`src/engine/core/gameState.ts:111-124`) does not touch `currentPlayer` or `currentDealer` — it only deals cards and increments `handNumber`. So the per-hand rotation is entirely owned by the snippet above.

### Is it firing on hand boundary or round boundary?

**Hand boundary.** This branch is reached whenever all hands are empty mid-round AND there are still ≥12 cards in the deck (enough to deal 4 to each of 3 players for the next hand). That condition fires at every hand boundary within a round. By contrast, round-boundary rotation lives in `startNewRound`:

`src/engine/core/gameState.ts:264-265`:
```ts
const newDealer = ((state.currentDealer + 1) % 3) as PlayerIndex;
const currentPlayer = ((newDealer + 1) % 3) as PlayerIndex;
```
That correctly advances the dealer +1 once per round.

So we have **two rotation mechanisms in conflict**:
1. **Hand-boundary rotation** in `turnManager.ts:65-67` — incorrect per doctrine 5.7.
2. **Round-boundary rotation** in `gameState.ts:264-265` — correct.

`currentDealer` is preserved across hands (only changes in `startNewRound`). The first player of the round is fixed by definition: `(currentDealer + 1) % 3`. Hand-boundary rotation overwrites that within the round.

### Trace of TC's observation

- Round 2 begins. `startNewRound` runs: `currentDealer` advances by +1 (round-start rotation, correct). `currentPlayer = (currentDealer + 1) % 3` (the round's first player).
- Hand 1 plays out. The last action that empties the hands is some player placing — `lastAction === 'place'`. Suppose player 0 placed last.
- `determineTurnResult` is called. `anyPlayerHasCards` is now false. `state.deck.length` is still ≥12 (deck has roughly 36 - hand-cards-placed-back-onto-board; usually still >12 after one hand). Branch falls through to lines 63-69.
- `state.lastAction === 'place'` → starting player = `(currentPlayer + 1) % 3` = 1. **Player 1 starts hand 2 instead of the round's locked first player (whoever was originally `currentDealer + 1`).**

This matches TC's report: R2 H1 = TC went first, R2 H2 = Player 2 went first.

### Gap vs doctrine 5.7

| Doctrine                                              | Code today                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Position rotates only at round boundary               | Rotates at every hand boundary too (when `lastAction === 'place'`)        |
| First player locked for the whole round               | First player drifts based on who placed last in each hand                 |
| Dealer locked for the whole round                     | Dealer is correctly preserved (only `startNewRound` mutates it)           |

Note that the dealer field is fine — only `currentPlayer` is being incorrectly mutated at the hand boundary.

### Surgical fix scope estimate
**Small.** The fix is in one block in one file. Replace `turnManager.ts:63-69` with:

```ts
if (state.deck.length >= 12) {
  const startingPlayer = ((state.currentDealer + 1) % 3) as PlayerIndex;
  return { type: 'DEAL_NEW_HAND', startingPlayer };
}
```

That makes the new hand's first player always equal to the round's first player (locked-in by `currentDealer`, which doesn't move within a round).

Tests: the existing `'all empty + deck >= 12 → DEAL_NEW_HAND'` test at `tests/engine/core/turnManager.test.ts:134-140` only asserts `r.type` — the bug is uncovered by current tests. Fix track should add ~2 tests asserting `startingPlayer === (currentDealer + 1) % 3` regardless of `currentPlayer` and `lastAction` at hand-end.

---

## SECTION 3 — Recommended Fix Strategy

### One track or two?

**Recommend one CC track that fixes both, but as two distinct subsystems with their own checkpoints.** Rationale:

- B1 and B2 both live in `turnManager.determineTurnResult`, so a single CC pass over that file is efficient. Splitting would double the read/write context for the same file.
- They are **independent code paths** within `determineTurnResult`: B1 is the lone-player branch (lines 58-60), B2 is the deal-new-hand branch (lines 63-69). Neither fix touches the other branch.
- B1 has wider ripple (GameState type + reset sites + UI gate + bot gate + tests), so it deserves its own checkpoint to verify lockout semantics before moving on.
- B2 is a one-block change with one test addition — fits naturally as a quick second checkpoint.

Suggested track shape:
- **Subsystem 1 (B2):** small, fast — fix `turnManager.ts:63-69`, add 2 tests, checkpoint.
- **Subsystem 2 (B1):** medium — add `dumpActive` to GameState, plumb through reset sites, gate submitCombo + UI + bot decision, add tests, checkpoint.

Doing B2 first is purely pragmatic: it's the smaller change and gets the more obvious doctrine violation off the board immediately, so any subsequent B1 play-testing already has correct turn order.

### Are they related code paths?

**Same file (`turnManager.ts`), different branches.** Both branches start from the same prelude (`anyPlayerHasCards`, `findNextPlayerWithCards`) but diverge before either fix point. No shared logic to refactor between them.

### Cascading concerns

**B1 → B2:** none. Adding a `dumpActive` flag and gating captures has no effect on hand-boundary rotation logic.

**B2 → B1:** weak. After B2 lands, the round's first player is fixed, which means the lone-player branch behavior is more predictable across hands (the same player always starts each hand). This makes the dump trigger condition slightly more deterministic but doesn't change whether it fires — that's still driven by `lastAction === 'place'` and hand emptiness.

**Either fix and `dealNewHand` reset:** if B1 lands first and stores `dumpActive` on `GameState`, the reset on `dealNewHand`/`startNewRound` is a one-line `dumpActive: false` set. Test factories (already extended for `handNumber` etc. in the Adventure restructure) need one more field. No structural concern.

**Either fix and Adventure mode:** neither bug intersects with the Adventure-specific `disableSeatingSwap` flag added during the restructure. That flag operates on `createInitialState` (game start), not on hand/round transitions. Safe to fix without re-touching Adventure plumbing.

**Either fix and persistence:** `saveGame`/`loadGame` round-trips the entire `GameState`. If B1 adds a `dumpActive` field, in-flight saves from before the fix won't have it — `loadGame` should default it to `false` to be safe (similar to how progressManager defaults missing fields). Worth flagging in the B1 fix track.

---

## Summary

| Bug | Mechanic exists?         | Root cause                                              | Files involved                                                                                                                                                                              | Fix scope |
| --- | ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| B1  | No (trigger detected, no enforcement) | No `dumpActive` flag; no capture lockout in submit/UI/bot paths | `engine/types/index.ts`, `engine/core/gameState.ts`, `engine/core/turnManager.ts`, `game/useGameController.ts`, `components/GameView.tsx`, `engine/ai/botDecision.ts`, plus tests           | Medium    |
| B2  | Partially (round rotation correct; hand rotation wrong)        | `turnManager.ts:63-69` rotates first player per-hand instead of locking to `(currentDealer + 1) % 3` | `engine/core/turnManager.ts`, plus 2 tests in `tests/engine/core/turnManager.test.ts`                                                                                                       | Small     |

**No code, types, or tests modified in this track.** Diagnosis only.
