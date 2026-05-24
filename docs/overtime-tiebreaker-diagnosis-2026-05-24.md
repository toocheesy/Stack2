# Overtime Tie-Breaker — Pre-Build Read-Only Diagnosis

**Track:** `Overtime Tie-Breaker — Read-Only Diagnosis (pre-build)` — P2, May 24 2026.
**Paired build ticket:** `36a2f266-2cac-81e6-8cd1-c80edfca18f7` (Waiting - Other until this returns).
**Type:** Read-only. No code touched. No tests added. Diagnosis only.

---

## Headline

**The current game-over check is exactly what the build ticket assumes — no surprises, no pre-existing overtime logic hiding anywhere, no `targetScore` hardcoding.** The build track as written fits cleanly. One implementation note (call out in build): `findWinner` is exported and used by a dedicated `tiebreaker` test that asserts the old `lastCapturer`-wins behavior — that test must be replaced with the new overtime semantics, not just updated. Change surface is ~30 LOC engine + ~6 new tests + 1 test rewrite. No UI work in scope.

---

## 1. Round-boundary game-over check — location and shape

**File:** `src/engine/roundManager.ts`
**Function:** `findWinner(state: GameState): PlayerIndex | null` — [roundManager.ts:17-38](roundManager.ts:17)
**Call site:** `resolveRoundEnd(state, prng, idGen)` — [roundManager.ts:44-95](roundManager.ts:44), specifically the check at [roundManager.ts:65-74](roundManager.ts:65)

`resolveRoundEnd` is the only round-boundary game-over path. It runs in this order:
1. **Jackpot resolution** ([:51-62](roundManager.ts:51)) — applies any remaining board to `lastCapturer`, emits `jackpot_resolved`.
2. **Game-over check** ([:65-74](roundManager.ts:65)) — calls `findWinner(current)`. If non-null, sets `gamePhase='gameOver'`, emits `game_over`, returns.
3. **Round-end continuation** ([:77-94](roundManager.ts:77)) — sets `gamePhase='roundEnd'`, emits `round_end`, calls `startNewRound`, emits `new_round_started` + `deck_count_changed`.

The check is round-boundary-only and post-jackpot — matches doctrine 5.4's "never mid-round" constraint already.

---

## 2. Current behavior (stated plainly)

```ts
// roundManager.ts:17-38 — current implementation, verbatim shape
export function findWinner(state: GameState): PlayerIndex | null {
  const target = state.settings.targetScore;       // dynamic ✓ (no hardcoded 300)
  const indices: PlayerIndex[] = [0, 1, 2];
  const qualifying = indices.filter(
    (i) => state.overallScores[SCORE_KEYS[i]] >= target,
  );

  if (qualifying.length === 0) return null;        // → new round (correct)

  let winner = qualifying[0];
  for (const i of qualifying) {
    const iScore = state.overallScores[SCORE_KEYS[i]];
    const wScore = state.overallScores[SCORE_KEYS[winner]];
    if (iScore > wScore) {
      winner = i;
    } else if (iScore === wScore && state.lastCapturer === i) {
      winner = i;                                  // ← TIEBREAKER (to be removed)
    }
  }
  return winner;
}
```

Behavior summary, by scenario:

| Scenario | Current outcome | Doctrine 5.4 outcome | Match? |
| -------- | --------------- | -------------------- | ------ |
| Nobody at/above target | Returns `null` → `startNewRound` runs. | Same — normal round end. | ✓ |
| Sole player at/above target, strictly highest | Returns that player → `gameOver`. | Same — clear sole leader, game ends. | ✓ |
| Player above target, but another sole player is higher (also above target) | Returns the higher player → `gameOver`. | Same — clear sole leader. | ✓ |
| **Two+ players tied at max, all at/above target** | Returns whichever tied player matches `state.lastCapturer` (or the first qualifier if `lastCapturer` isn't among them). **Game ends with arbitrary winner.** | **OVERTIME — no game-end. `startNewRound` runs with cumulative scores preserved. Recursive until clear sole leader emerges.** | ✗ — **only divergence.** |

**The only behavioral gap** between current code and doctrine 5.4 is the tied-leaders-at-or-above-target case. Everything else already matches the spec.

---

## 3. Pre-existing overtime / tie-breaker search

Grep across `src/` for: `overtime`, `tiebreak`, `tie-break`, `tied`, `isOvertime`, `extraRound`.

| Hit | Location | What it is | Relevant? |
| --- | -------- | ---------- | --------- |
| `overtime`, `isOvertime`, `extraRound` | (zero hits in src/) | — | No pre-existing overtime logic anywhere. |
| `tied` | `src/engine/adventure/__tests__/adventure.test.ts:200,204` | Adventure star-rating tests ("returns 3 when tied with both bots"). Unrelated to game-end. | No. |
| `Tiebreaker` / `tiebreaker` | `roundManager.ts:15` (docblock), `gameLogic.test.ts:259-274` (test describe + 1 spec) | Names the existing `lastCapturer` mechanism. | **Yes — must be replaced/updated by build.** |
| `lastCapturer` | 18 hits across `roundManager.ts`, `gameState.ts`, `turnManager.ts`, `evaluator.ts`, `types/index.ts`, and several tests | Used in TWO distinct roles: **(A) jackpot resolution** (`applyJackpot` reads `lastCapturer` to award the remaining board — `gameState.ts:231-234`, `turnManager.ts:31-34`, tests in `gameLogic.test.ts:173-188`), and **(B) game-over tiebreaker** (`roundManager.ts:32`, `gameLogic.test.ts:262-268`). | **(A) must stay. (B) must go.** Doctrine 5.4 supersedes (B); the build ticket already calls this out correctly. |

**Verdict: zero pre-existing overtime logic. Nothing to NOT rebuild.** The only adjacent surface area is the `lastCapturer`-as-tiebreaker placeholder, which doctrine 5.4 explicitly retires.

---

## 4. `startNewRound` reusability for overtime

**Reusable as-is. No branch needed.**

`src/engine/core/gameState.ts:250-286` — `startNewRound` already:
- Builds a fresh shuffled deck via `shuffleDeck(createDeck(idGenerator), prng)` — ✓ doctrine 5.4 "fresh deck."
- Spreads `...state` first, so **cumulative `overallScores` carry over** automatically — ✓ doctrine 5.4 "cumulative scores."
- Resets per-round `scores` via `emptyScores()` — ✓.
- Increments `currentRound: state.currentRound + 1` — ✓ doctrine 5.4 "`roundNumber++`."
- Resets `handNumber: 1` — ✓ doctrine 5.4 "`handNumber` reset."
- Resets `lastCapturer: null`, `lastAction: null`, `combination: emptyCombination()`, `dumpActive: false` — ✓ clean slate.
- Rotates dealer via `(state.currentDealer + 1) % 3` — ✓ matches normal continuation.
- Sets `gamePhase: 'playing'` — ✓ unblocks the next round.

There is **no "this is a normal round" assumption baked in.** The function is fully general and reusable for overtime without a code-path branch. The recursion the build ticket describes ("each subsequent round-end re-runs this same check") falls out of `resolveRoundEnd` calling `startNewRound` and the next round-end re-entering `resolveRoundEnd → findWinner` — automatic, no extra plumbing.

---

## 5. `targetScore` confirmation

**Dynamically read. No hardcoded 300 in the check.**

- `roundManager.ts:18` — `const target = state.settings.targetScore;`
- That is the **only** reference to `targetScore` in `roundManager.ts`.
- Grep for the literal `300` in `src/engine/`: zero hits in `roundManager.ts`, `core/gameState.ts`, or `events.ts`. Default `300` is set in settings construction only, not in the game-end check.

The build ticket's "do not hardcode 300" constraint is already satisfied. The new code only needs to keep using `state.settings.targetScore` the same way.

---

## 6. Round-end / game-over events and UI consumption

**Events emitted** (`src/engine/events.ts:3-15`):
- `jackpot_resolved` — emitted always at round end (whether game continues or not).
- `round_end` — emitted only when game continues into a new round. Payload: `{ type: 'round_end'; roundNumber: number; roundStats: [RoundStats, RoundStats, RoundStats] }`. **This is the payload the build ticket suggests extending with `isOvertime?: boolean`.**
- `game_over` — emitted only when `findWinner` returns non-null. Payload: `{ type: 'game_over'; winner: PlayerIndex; gameStats: [...] }`.
- `new_round_started` — emitted right after `round_end`. Payload: `{ type: 'new_round_started'; roundNumber: number }`. **Could alternatively carry the `isOvertime` flag.**
- `deck_count_changed` — fires after `new_round_started`.

**UI consumption pattern** — UI does NOT subscribe to `round_end` or `game_over` via `EventBus.on()` in production code. It reads `state.gamePhase` directly:
- `src/game/useGameController.ts:170` — sets `gamePhase: 'roundEnd'` on the persisted state.
- `src/game/useGameController.ts:190` — sets `gamePhase: 'gameOver'` on the persisted state.
- `src/game/useGameController.ts:449` — `if (s.gamePhase !== 'roundEnd') return;` guards the continuation handler.
- `src/components/GameView.tsx:642` — `<RoundEndOverlay visible={state.gamePhase === 'roundEnd'} ... />`.

**Implication for the future overtime-UI track:** since the overlay reads `gamePhase` (not events), the `isOvertime` signal needs to live on the **state** that the controller persists, not just on the transient event payload. Cleanest option: add `isOvertime: boolean` to `GameState` (or to `roundStats`), set it in `startNewRound` when called from the overtime branch, and let `RoundEndOverlay` read it via the existing `state` prop. Adding it to the `round_end` event payload too is fine for symmetry but isn't load-bearing for the overlay.

**This is informational only — the build ticket explicitly says "expose, don't build."** The signal-on-event approach the ticket proposes works; the controller will need a tiny pass-through later to expose it on state when the overlay track ships. Worth a single sentence in the build's "REPORT ON COMPLETION" so the next track knows the threading.

---

## 7. Recommended change surface + scope estimate

### Files to modify
| File | Change | LOC est. |
| ---- | ------ | -------- |
| `src/engine/roundManager.ts` | Replace `findWinner` body (or change its return type) and add the tied-leaders branch in `resolveRoundEnd` that calls `startNewRound` instead of emitting `game_over`. | ~25-35 |
| `src/engine/events.ts` | Add `isOvertime?: boolean` to the `round_end` payload (or to `new_round_started`). | ~1-2 |

### Files to update
| File | Change | LOC est. |
| ---- | ------ | -------- |
| `src/engine/core/__tests__/gameLogic.test.ts` | **Replace** the existing `'lastCapturer wins when scores are tied at target'` test ([line 262-268](src/engine/core/__tests__/gameLogic.test.ts:262)) with the new doctrine-5.4 behavior. Keep the `'returns null when nobody has reached target'` test ([line 270-273](src/engine/core/__tests__/gameLogic.test.ts:270)) as-is. Add ~6 new specs per the build ticket's test list. | ~70-90 net add |

### Files NOT to touch
- `src/engine/core/gameState.ts` — `startNewRound` and `applyJackpot` already correct for overtime continuation and jackpot resolution.
- `src/engine/core/turnManager.ts` — `lastCapturer` jackpot-resolution use is the (A) role and stays.
- `src/engine/ai/evaluator.ts` — `lastCapturer` references at `:198`, `:371`, `:513` are all in-round AI scoring heuristics (denial bonuses), unrelated to game-end tiebreak. Leave alone.
- `src/components/**`, `src/game/useGameController.ts` — out of scope for engine-only build per the ticket.

### Scope
**Small surgical track.** ~30 LOC engine change, ~6 new tests, 1 test rewrite. Test count moves from 321 → ~326-327 (depending on how many of the 6 build-ticket test cases collapse into shared specs). No new files. No React/Motion/DOM imports added to engine.

---

## 8. Does the paired build ticket still fit as written?

**Yes — fits cleanly. No revisions needed.** Single implementation note worth flagging in the build's spec step:

> **Note for build:** `findWinner` is currently a separately exported function consumed by both `resolveRoundEnd` AND a dedicated `tiebreaker` describe-block in `gameLogic.test.ts:259-274`. The build can either (a) change `findWinner`'s return type to `{ kind: 'winner'; player: PlayerIndex } | { kind: 'tie'; players: PlayerIndex[] } | { kind: 'none' }` and have `resolveRoundEnd` branch on it, or (b) inline the new logic into `resolveRoundEnd` and either delete `findWinner` or reshape it. Either works. Option (a) keeps `findWinner` testable in isolation; option (b) collapses the surface area. Spec step should pick one before plan step.

Everything else in the build ticket — engine-only, `lastCapturer` stays for jackpot, `isOvertime` signal exposed not built, day-one architecture rules, test list — lands as written.

---

## 9. Risks / things to watch in the build

1. **Hand 3 Fork PA logic** (`evaluator.ts:198`) reads `state.lastCapturer` for an in-round denial bonus. Confirm the build does NOT touch `state.lastCapturer` outside the jackpot path — the AI evaluator must keep seeing it accurately. Current code preserves this; just don't accidentally null it.
2. **Adventure mode** (`src/engine/adventure/`) wraps the engine for level objectives. Overtime triggering on a non-target level objective could affect star calculation — but per `findWinner`'s `targetScore` gate, overtime only fires when both `>=` target AND tied, which Adventure levels with low targets could plausibly hit. Worth a quick spec-step look at whether Adventure cares; my read is it doesn't (Adventure resolves on level objective, not on overall game-end), but the build should double-check before merging.
3. **Persistence** (`useGameController.ts:170, 190`) — controller persists `gamePhase` to localStorage. Overtime is just another round, so a tied-leaders state mid-overtime would persist as `gamePhase: 'playing'` cleanly with cumulative `overallScores`. No new persistence shape needed for the engine track.

---

## 10. Verdict

- **Scope is small.** ~30 LOC engine + ~6 tests + 1 test rewrite.
- **No hidden pre-existing logic** to coordinate with.
- **`startNewRound` is fully reusable** — recursion falls out automatically.
- **`targetScore` already dynamic** — no hardcoding to fix.
- **Build ticket fits as written**, with one spec-step decision (return-type-reshape vs inline) called out above.
- **UI signal threading** (state vs event-payload) is informational for the future UI track, doesn't change engine work.

Greenlight to flip `36a2f266-2cac-81e6-8cd1-c80edfca18f7` to Ready and run the standard spec → plan → build flow.

---

*Diagnosis conducted May 24, 2026 against `main`. Read-only. No code or test changes. 321-test baseline untouched.*
