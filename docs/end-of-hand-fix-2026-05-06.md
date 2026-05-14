# End-of-Hand + Round Mechanics — Fix Impact

**Track:** `FIX TRACK — End-of-Hand + Round Mechanics (B2 + B1)` — P1, engine fix, May 6 2026.
**Diagnosis ref:** `docs/end-of-hand-diagnosis-2026-05-06.md`.
**Doctrine ref:** Notion `3562f2662cac8134b848d59ce9f08573` — sections 2.7 (Forced-Placement Dump) and 5.7 (Round-To-Round Position Rotation).
**Status:** Both subsystems landed. 278 of 278 tests pass. `npm run build` clean. Awaiting TC merge.

---

## Subsystem 1 — B2: Round position rotation lock (doctrine 5.7)

### Before
`src/engine/core/turnManager.ts:63-69` rotated the new-hand starting player to `(currentPlayer + 1) % 3` whenever `lastAction === 'place'`. That's a hand-boundary rotation. Doctrine says rotation only at round boundary.

```ts
// before
if (state.deck.length >= 12) {
  const startingPlayer: PlayerIndex =
    state.lastAction === 'place'
      ? (((state.currentPlayer + 1) % 3) as PlayerIndex)
      : state.currentPlayer;
  return { type: 'DEAL_NEW_HAND', startingPlayer };
}
```

### After
Single block replaced with `(currentDealer + 1) % 3`. `currentDealer` is preserved across hands by `dealNewHand` (only `startNewRound` mutates it), so the round's first player is locked for the duration of the round.

```ts
// after
if (state.deck.length >= 12) {
  // Position locks for the whole round — first player is always
  // (dealer + 1) % 3, regardless of who placed last in the previous
  // hand. Round-boundary rotation lives in startNewRound.
  // Doctrine 5.7.
  const startingPlayer = ((state.currentDealer + 1) % 3) as PlayerIndex;
  return { type: 'DEAL_NEW_HAND', startingPlayer };
}
```

### Files modified
- `src/engine/core/turnManager.ts` — single block replacement, ~6 lines changed.

### Tests added
`tests/engine/core/turnManager.test.ts` — 3 new tests after the existing `'all empty + deck >= 12 → DEAL_NEW_HAND'` (which only checked `r.type`):

1. `startingPlayer is always (currentDealer + 1) % 3` — basic invariant with one fixture.
2. `startingPlayer ignores who placed last in the prior hand (lock)` — sweeps `currentPlayer ∈ {0,1,2}` × `lastAction ∈ {'place','capture'}` (6 combinations) with a fixed `currentDealer`. All must return the same locked first player.
3. `startingPlayer rotates only when the dealer rotates (round boundary)` — sweeps dealer ∈ {0,1,2} → expected starting players {1,2,0}.

### Untouched (intentional)
- `src/engine/core/gameState.ts:264-265` — round-boundary rotation in `startNewRound`. Already correct per diagnosis. Not touched.
- `dealNewHand` — does not mutate `currentPlayer` or `currentDealer`. Already correct.

---

## Subsystem 2 — B1: Forced-Placement Dump mechanic (doctrine 2.7)

### What was missing
Before this fix, the trigger condition was *detected* in `turnManager.ts` (lone-player branch, formerly lines 58-60), but the dump itself was not implemented:
- No `dumpActive` field on `GameState`.
- No capture lockout in `useGameController.submitCombo`.
- No SUBMIT-button gate in `GameView`.
- No force-place override in `botDecision`.
- Player rolled back onto turn with full submit-combo capability.

### What landed

#### 1. State field
`src/engine/types/index.ts` — added to `GameState`:
```ts
// Doctrine 2.7 — Forced-Placement Dump: true when only one player has
// cards left and they have just placed. Captures are locked out until
// a new hand is dealt or a new round starts.
dumpActive: boolean;
```
Also added `dumpActive?: boolean` to the `CONTINUE_TURN` variant of `TurnResult`, so `turnManager` can signal the transition.

#### 2. Lifecycle owners
| Transition                     | Site                                  |
| ------------------------------ | ------------------------------------- |
| Initialize false (game start)  | `gameState.ts` `createInitialState`   |
| Set true (trigger fires)       | `turnManager.ts` lone-player branch (returns `dumpActive: true` in TurnResult; controller applies) |
| Reset false (new hand dealt)   | `gameState.ts` `dealNewHand`          |
| Reset false (new round)        | `gameState.ts` `startNewRound`        |
| Backward-compat default false  | `persistence.ts` `loadGame`           |

The lone-player branch in `turnManager.ts`:
```ts
if (skipCurrent && state.hands[state.currentPlayer].length > 0) {
  // Doctrine 2.7 — Forced-Placement Dump trigger: current player just
  // placed, others are empty, current still has cards. Capture window
  // shuts. Subsequent turns are forced placements.
  return { type: 'CONTINUE_TURN', nextPlayer: state.currentPlayer, dumpActive: true };
}
```

#### 3. Capture lockouts (4 call sites)

**`src/game/useGameController.ts` — `submitCombo`:**
```ts
if (s.dumpActive) return 'Place only — last cards';
```
Returns the message string before `validateFullCombo`/`executeCapture` can fire. The existing `error` toast surface in `GameView` displays it briefly if the player somehow gets through (defense-in-depth).

**`src/game/useGameController.ts` — `CONTINUE_TURN` handler:**
```ts
const next = {
  ...current,
  currentPlayer: result.nextPlayer,
  dumpActive: result.dumpActive ?? current.dumpActive,
};
```
Applies the flag from the `TurnResult` while preserving the existing value otherwise.

**`src/components/GameView.tsx` — SUBMIT button:**
- `disabled={!comboValid || state.dumpActive}` — visually grays out.
- Adds a TAN hint line beneath the SUBMIT/RESET row when `isPlayerTurn && state.dumpActive`: **"Last cards — place only"**. Plain language per ticket — no "dump" jargon.

**`src/engine/ai/botDecision.ts` — `decideBotAction`:**
- After `evaluateAllActions`, if `state.dumpActive`, filter to `place` actions and pick the top-scored. Calvin's `preferHighestNumberCardOnPlace` preference still applies. Skips chain-eval, sum preference, risk-threshold gate, and mistake-roll branches for the dump path. If no place actions are available (shouldn't happen with a non-empty hand), falls through to the normal flow as a safety net.

#### 4. Persistence backward-compat
`src/game/persistence.ts` — `loadGame`:
```ts
const data = JSON.parse(raw) as Partial<GameState>;
// ...validity check unchanged
return { ...(data as GameState), dumpActive: data.dumpActive ?? false };
```
Saves from pre-fix builds default to `dumpActive: false` on load. Saves from post-fix builds round-trip the field correctly.

### Files modified
- `src/engine/types/index.ts`
- `src/engine/core/gameState.ts`
- `src/engine/core/turnManager.ts`
- `src/game/useGameController.ts`
- `src/game/persistence.ts`
- `src/components/GameView.tsx`
- `src/engine/ai/botDecision.ts`

### Tests added (11 new)
- `tests/engine/core/gameState.test.ts` (+3) — `createInitialState` defaults `dumpActive=false`; `dealNewHand` clears `dumpActive=true → false`; `startNewRound` clears `dumpActive=true → false`.
- `tests/engine/core/turnManager.test.ts` (+2) — lone-player branch returns `CONTINUE_TURN` with `dumpActive: true`; normal `CONTINUE_TURN` path leaves `dumpActive` falsy.
- `tests/engine/ai/botDecision.test.ts` (+2) — with `dumpActive=true` and an obvious capture (Ace + Ace) on the board, bot returns `place` across 10 seeds; sanity test confirming the same fixture permits capture when `dumpActive=false`.
- `tests/game/persistence.test.ts` (NEW, 4 tests) — returns null when empty; round-trip preserves `dumpActive: true`; pre-fix save without `dumpActive` defaults to `false` on load; `clearSavedGame` wipes the slot.

### Test fixtures extended
`state(overrides)` factories in 4 test files added `dumpActive: false`:
- `tests/engine/ai/botDecision.test.ts`
- `tests/engine/ai/evaluator.test.ts`
- `tests/engine/core/captureValidator.test.ts`
- `tests/engine/core/turnManager.test.ts`

### Skipped (called out)
The ticket listed 6 specific test cases. #11 was "submitCombo blocked when dumpActive". Exercising it as a unit test requires a React renderer harness for `useGameController`, which doesn't exist in the project. Standing it up for one assertion was a worse trade than skipping. The `submitCombo` gate is a single-line check (`if (s.dumpActive) return 'Place only — last cards';`); verifiable via code review and TC playtest.

---

## Aggregate state

- **Tests:** 278 of 278 passing (was 264 pre-track; +3 from B2, +11 from B1).
- **TypeScript:** `npx tsc -b` clean across `src/` and `tests/`.
- **Production build:** `npm run build` succeeds in ~425 ms. Bundle 406.85 KB / 125.45 KB gzip.
- **Coverage audit:** test suite includes `tests/coverage/` (brute-force enumerator + move-space-coverage). All passing.

---

## Doctrine references confirmed implemented

### 5.7 — Round-To-Round Position Rotation
- ✅ Position locked across hands within a round (`turnManager.ts` `DEAL_NEW_HAND` branch now uses `(currentDealer + 1) % 3`).
- ✅ Position rotates only at round boundary (`gameState.ts` `startNewRound`, untouched, was already correct).
- ✅ Dealer locked across hands (`dealNewHand` does not mutate `currentDealer`).

### 2.7 — Forced-Placement Dump Mechanic
- ✅ Trigger: current places AND has cards left AND others empty (`turnManager.ts` lone-player branch).
- ✅ Capture window slams shut at first place (`dumpActive` set on the trigger transition).
- ✅ Subsequent turns are forced placements (`submitCombo` gate + UI gate + bot gate).
- ✅ Mechanic clears on next hand or new round (`dealNewHand` + `startNewRound` reset).
- ✅ No doctrine jargon in user-facing copy ("Last cards — place only").

---

## TC manual playtest checklist (pre-merge)

Run `npm run dev` against `http://localhost:8090`. Wipe localStorage in DevTools first.

### B2 (round position lock)
1. Start a fresh Classic game (any target / any bots). Note who goes first in **Round 1, Hand 1**.
2. Play through the round naturally. As the deck depletes and new hands are dealt, **the same player should go first in Hand 2, Hand 3, etc.** of Round 1.
3. When the deck empties + jackpot resolves and **Round 2** begins, the dealer should advance by +1 and the first player should shift accordingly.
4. Round 2's first player should then stay locked across its hands (just like Round 1).
5. Failure mode to watch for: the first player switching mid-round (TC's original observation: R2 H1 = TC, R2 H2 = different player). This should no longer happen.

### B1 (forced-placement dump)
6. Reach a state where one bot has emptied first and you / the other bot still have cards. (Easiest: play a small target so it happens within a few hands; or seed via DevTools snippet below.)
7. The moment the lone player places after the others empty: SUBMIT button greys out, "Last cards — place only" hint appears below the combo strip. Tapping a board card and SUBMIT should not fire a capture.
8. The lone player can still tap RESET and rebuild a combo, but SUBMIT stays disabled. They can drag/place cards normally.
9. If a bot is the lone player: bot keeps placing across multiple turns even with obvious pair captures available on the board (e.g., bot holds Ace, board has Ace).
10. Once the lone player's hand empties → new hand dealt → dump clears → SUBMIT re-enables → captures allowed again.
11. End of round: jackpot resolves → tap Continue → new round dealt → dump cleared (just in case it was active when the round ended).

### Persistence backward-compat
12. With a post-fix build running and an active save, force-set `dumpActive: true` mid-game (DevTools snippet below). Reload. State restored with dump active. Wipe + restart — fine.
13. Optional: if you have an old save from before this fix in localStorage, loading it should not lock you out of captures (defaults `dumpActive: false`).

### Force-progress dev snippets

Force the game state into a dump scenario for fast verification:
```js
// In an active Classic game, after at least 1 hand has played:
const s = JSON.parse(localStorage.getItem('stacked-v2-game'));
s.dumpActive = true;
localStorage.setItem('stacked-v2-game', JSON.stringify(s));
location.reload();
```

Strip `dumpActive` to simulate a pre-fix save:
```js
const s = JSON.parse(localStorage.getItem('stacked-v2-game'));
delete s.dumpActive;
localStorage.setItem('stacked-v2-game', JSON.stringify(s));
location.reload();
// Should load fine, dumpActive defaults to false.
```

Reset the slot:
```js
localStorage.removeItem('stacked-v2-game');
```

---

## Known caveats / follow-ups

- **No `useGameController` test harness.** The `submitCombo` dump gate (1-line check) is verified by code review + TC playtest, not by an automated unit test. If a controller harness is later stood up (testing-library/react), this gate is a natural target.
- **Hint copy** ("Last cards — place only") is provisional. If you want different phrasing — e.g., a touch warmer, or a brief explanation of what placed cards do — easy retune in `GameView.tsx`. No jargon was introduced.
- **Hint strip integration deferred.** The ticket flagged it as optional ("nice-to-have"). The hint surface added beneath the combo strip is sufficient for the dump UX. The Adventure-mode hint strip in `GameView` (W1+W2 only) wasn't repurposed for dump — they coexist cleanly.
- **Adventure-mode interaction.** B2 fix is global — applies to Classic and Adventure equally. B1 dump mechanic also applies to both modes; nothing Adventure-specific. The Adventure `disableSeatingSwap` flag added during the restructure is independent of these fixes.
- **No Foundation engine internals modified.** Personalities, scoring, evaluator core logic, awareness scaling — all untouched per ticket.
- **No `findAllCaptures` or scoring changes.**

---

## After this ships

Per ticket post-completion checklist:
1. TC reviews this doc.
2. TC runs `npm test` locally — all 278 pass.
3. TC plays through a full Classic game (verifies B2 + B1 under playtest, both modes if desired).
4. TC commits + pushes.
5. **Two doctrine violations resolved.** Playtest list shrinks by two.
