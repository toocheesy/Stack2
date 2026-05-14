# Post-Foundation Calibration — Diagnosis (Q3 + Q4)

**Track:** `VERIFY — Post-Foundation Calibration (Q3 chain threshold + Q4 cardtracker offset)` — read-only diagnosis, P2.
**Audit ref:** `docs/AI_AUDIT_REPORT.md` open questions 3 + 4 (line 334 + line 336 of the audit).
**Doctrine ref:** Notion `3562f2662cac8134b848d59ce9f08573`.
**Status:** Investigation complete. No code touched. Headline: **Q3 confirmed open; Q4 already fixed in Foundation but the audit's open question was never closed.**

---

## SECTION 1 — Q3: Capture Chain Threshold Hardcoded at 1.2x

### Current code path
`src/engine/ai/botDecision.ts:323` (inside `decideBotAction`, the `profile.useChainEval` branch):

```ts
if (profile.useChainEval) {
  const plan = evaluateChainCapture(state, playerIndex, state.hands[playerIndex], state.board);
  if (plan) {
    const bestCaptureTotal = actions
      .filter((a) => a.action === 'capture')
      .reduce((m, a) => Math.max(m, a.captureDetails?.totalPoints ?? 0), 0);
    if (plan.totalPoints > bestCaptureTotal * 1.2) {   // ← line 323, hardcoded
      const chainAction = chainPlanAsAction(plan, actions);
      ...
    }
  }
}
```

`evaluateChainCapture` itself lives at `src/engine/ai/evaluator.ts:504`. It returns a 2-turn capture plan (capture A now → capture B next turn). The threshold gates whether that plan promotes over the best single-turn capture.

### Confirmed hardcoded
Yes — the literal `1.2` at line 323 is not derived from any skill, profile, or function. Same code path for every bot with `useChainEval: true`.

### Who is affected
Personality inventory of `useChainEval`:

| Bot    | `useChainEval` | `riskThreshold` (RT) | `setupEngineering` (SE) | Current chain threshold |
| ------ | -------------- | -------------------- | ----------------------- | ----------------------- |
| Calvin | false          | 0.02                 | 1                       | N/A (chain eval off)    |
| Nina   | false          | 0.05                 | 4                       | N/A                     |
| Rex    | **true**       | 0.08                 | 7                       | **1.20x (hardcoded)**   |
| Jett   | **true**       | 0.10                 | 8                       | **1.20x (hardcoded)**   |

Rex and Jett — the only consumers — are calibrated identically here, which is exactly the pattern the Jett build generalized for three other scalars (`layer3Reliability(pa)`, `deckAttentionChance(da)`, `setupChainThreshold(se)`). This one was missed.

### Sibling hardcoded scalars inventory
Scanned `botDecision.ts` + `evaluator.ts` for similar bare multipliers in skill-conditional branches:

| Location                     | Value(s)        | What it gates                                                      | Already skill-scaled? |
| ---------------------------- | --------------- | ------------------------------------------------------------------ | --------------------- |
| `botDecision.ts:219-225`     | 1.35/1.30/1.25/1.20/1.15 | `setupChainThreshold(se)` — place-chain promotion         | Yes (SE)              |
| `botDecision.ts:248`         | 1.3 (placementDanger), 1.2 (boardControl) | Position-awareness Layer 3 weight bumps when previous action was a capture (PA ≥ 7) | Layer3 already gated by `layer3Reliability(pa)`; the multipliers themselves are bare. Worth flagging but lower priority — they're inside an already-skill-gated branch. |
| `botDecision.ts:323`         | **1.2**         | **Capture-chain promotion (this issue, Q3)**                       | **No**                |
| `evaluator.ts:125`           | 1.15            | `modifyWeightsForGameState` — generic late-game multiplier         | Not skill-scaled; not chain-related |
| `evaluator.ts:129`           | 1.2             | `modifyWeightsForGameState` — generic comeback multiplier          | Not skill-scaled; not chain-related |
| `evaluator.ts:180`           | 1.2 / 1.3 / 1.8 / 0.5 / 0.85 | `applyPressureExpansion` — hand-of-round + jackpot proximity multipliers (PH ≥ 4-6) | Gated by PH skill check but the multipliers themselves are bare |
| `evaluator.ts:740`           | 1.8, 1.2        | Personality-specific opponentDenial / boardControl bumps           | Not chain-related     |

**Recommendation:** Only Q3 (line 323) is in scope. `botDecision.ts:248` is a follow-up candidate (bare multipliers inside a skill-gated branch — half-generalized). The `applyPressureExpansion` and `modifyWeightsForGameState` multipliers are weight modifiers, not chain thresholds — different doctrine concern. Don't bundle.

### Recommended scaling skill: SE (`setupEngineering`), with RT as alternate

Two real candidates: `setupEngineering` (SE) and `riskThreshold` (RT). Each has a legitimate case.

**Case for SE (recommended):**
- Mirrors the existing `setupChainThreshold(se)` for place-chains. Both Rex's chain types (capture-chain and place-chain) would then derive from the same SE curve. Unified "chain threshold curve" across both chain types — exactly the pattern Stacy floated in the ticket.
- Rex SE=7, Jett SE=8 — both already on the curve at distinct breakpoints. Future bots (Mira, Talia) only need an SE value to inherit a sensible chain threshold.
- Semantically: "engineering a multi-turn plan" is what setupEngineering names. Capture-chain is exactly that.

**Case for RT:**
- "Should I take this riskier 2-turn plan over the safer 1-turn?" reads as a risk-tolerance dial.
- RT scale (0.02-0.10 across the roster) gives finer differentiation but doesn't currently feed a function — would need new breakpoints.
- RT is currently used as a target-score percentage gate (in the risk-threshold demotion at `botDecision.ts:339`). Reusing it for chain thresholds slightly overloads its semantics.

**Recommendation: SE.** Unifies with the sibling function, no semantic overload, breakpoints already validated on the place-chain side.

### Proposed value curve (SE-based)

```ts
function captureChainThreshold(se: number): number {
  if (se <= 5) return 1.40;
  if (se <= 7) return 1.30;   // Rex (SE 7) → 1.30
  if (se <= 8) return 1.20;   // Jett (SE 8) → 1.20 — preserves current Jett behavior
  return 1.15;
}
```

How the proposed curve plays out:

| SE     | Bot at this tier      | Threshold | vs current (1.20) | Effect                                                                              |
| ------ | --------------------- | --------- | ----------------- | ----------------------------------------------------------------------------------- |
| ≤ 5    | future Mira/Talia tier | 1.40      | +0.20             | Only takes obvious wins                                                              |
| ≤ 7    | Rex (SE=7)            | 1.30      | +0.10             | **Rex becomes more conservative** — chain must be 30% better, not 20%               |
| ≤ 8    | Jett (SE=8)           | 1.20      | 0                 | **Jett preserved at current default**                                                |
| ≥ 9    | future top-tier bots  | 1.15      | -0.05             | Aggressive on chains                                                                 |

This matches the ticket's "scale Rex DOWN from 1.2x to leave room for Jett" directive — Rex moves to 1.30, Jett stays at 1.20. The four buckets give room for future tiers above and below.

**Counter-proposal worth raising before lock-in:** the ticket text shows tier ranges (`Rex SE 4-5: 1.30x`, `Jett SE 5-6+: 1.20x`) that don't match the actual SE values (Rex=7, Jett=8). My curve assumes the *intent* (Rex more conservative than Jett, Jett at current) is what matters — and uses the actual SE values. If TC wants to shift the breakpoints (e.g., Rex SE 7 → 1.25x instead of 1.30x to be less aggressive a demotion), trivial to retune.

### Fix scope: **SMALL**
- Add `captureChainThreshold(se: number): number` next to `setupChainThreshold` in `botDecision.ts:219-225`.
- Change one call site at `botDecision.ts:323`: `bestCaptureTotal * 1.2` → `bestCaptureTotal * captureChainThreshold(profile.setupEngineering)`.
- Add ~3 tests (one per breakpoint band) in `tests/engine/ai/botDecision.test.ts`. The existing chain-eval tests should keep passing because Jett's SE=8 maps to 1.20x (current default).
- Bots calibration: Rex moves from 1.20 to 1.30. Stat card might shift — re-baseline check recommended after fix.

---

## SECTION 2 — Q4: CardTracker Initial Hands

### Headline: **Q4 is already addressed by Foundation. The audit's open question was never closed.**

The April 25 audit (`docs/AI_AUDIT_REPORT.md:336`) reported:
> Neither the LIVE nor v2 version records initial hand cards in the tracker (only board cards). This means the tracker underestimates `totalSeen` by 12 cards (4 per player) at game start.

That was true at audit time. **It is no longer true.** During Foundation work, the `seedInitialDeal()` function was added to `cardTracker.ts` and is called from `useGameController.ts` immediately after the board cards are recorded — bumping `totalSeen` by 12 at game start without recording specific cards. This is exactly Implementation Option 1 the ticket prefers.

### Current code path

`src/engine/ai/cardTracker.ts:98-107` — the seed function:
```ts
export function seedInitialDeal(
  tracker: CardTrackerState,
  unseenDealtCount: number,
): CardTrackerState {
  const next = cloneState(tracker);
  next.totalSeen += unseenDealtCount;
  next.deckRemaining = Math.max(0, DECK_SIZE - next.totalSeen);
  next.gamePhase = updateGamePhase(next);
  return next;
}
```

Notice: bumps `totalSeen` and `deckRemaining` only. Does NOT touch `seenCards` (the card-identity map) or `valueCounts` (per-rank counts). This is precisely the "counters-only, no identity leakage" shape TC's Option 1 calls for.

`src/game/useGameController.ts:85-94` — the caller:
```ts
const [state, setState] = useState<GameState>(() => {
  const saved = loadGame();
  if (saved) return saved;
  const initial = createInitialState(settings, prngRef.current, idGenRef.current);
  for (const card of initial.board) {
    trackerRef.current = recordPlacement(trackerRef.current, card);    // +4 board cards
  }
  trackerRef.current = seedInitialDeal(trackerRef.current, initial.hands.length * 4);  // +12 hand cards
  return initial;
});
```

And again on every new hand within a round at `useGameController.ts:142`:
```ts
case 'DEAL_NEW_HAND': {
  let next = dealNewHand(current);
  next = { ...next, currentPlayer: result.startingPlayer };
  trackerRef.current = seedInitialDeal(trackerRef.current, next.hands.length * 4);  // +12 each new hand
  ...
}
```

### Trace at game start

```
createCardTracker()           → totalSeen=0,  deckRemaining=52, gamePhase='early'
recordPlacement × 4 (board)   → totalSeen=4,  deckRemaining=48, gamePhase='early'  (4/52 = 7.7%)
seedInitialDeal(12) (hands)   → totalSeen=16, deckRemaining=36, gamePhase='mid'    (16/52 = 30.8% > 25%)
```

`totalSeen=16` and `gamePhase='mid'` immediately at game start. The 12-card offset the audit predicted does not appear. ✓

### Downstream consumers of `gamePhase` and `cardsRemaining` (full inventory)

I grepped for every reference. Inventory:

| Site                          | Field             | Used for                                                                                 | Sensitive to initial-phase miscalc? |
| ----------------------------- | ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| `evaluator.ts:341`            | `tracker.gamePhase` | `scoreCapture` — `+25 jackpotValue` when `late\|endgame` and not last capturer        | No — gates at `late` (≥50%), insensitive to `early` vs `mid` |
| `evaluator.ts:463`            | `tracker.gamePhase` | `scorePlacement` — `-10 jackpotValue` when `endgame` and not last capturer            | No — gates at `endgame` (≥75%)      |
| `cardTracker.ts:35-41`        | `tracker.gamePhase` | `updateGamePhase` derivation                                                            | N/A (this is the producer)          |
| `evaluator.ts:186`            | `state.deck.length` (NOT tracker) | `applyPressureExpansion` — PH ≥ 5 jackpot proximity gate `deck.length < 12` | **Insulated** — uses authoritative `state.deck.length`, not tracker |
| `evaluator.ts:560-590`        | `handCards`, `board` only | `evaluatePlaceChain` — SE ≥ 5 place-then-capture survival modeling                | **Insulated** — does not reference tracker at all |
| `cardTracker.ts:109-114`      | `valueCounts`     | `getRemainingOfRank` — rank-remaining estimate                                           | See note below                       |
| `cardTracker.ts:116-124`      | `valueCounts`     | `estimateDeckComposition`                                                                | See note below                       |

**Key finding:** Even if the audit's hypothesized bug *had* persisted, NONE of the gamePhase consumers gate at the 'early' vs 'mid' boundary. They only fire at `late` and `endgame`. The audit's predicted bot-behavior impact was overstated — the fix matters for correctness/observability, not for measurable bot decisions.

`applyPressureExpansion` is the one place the ticket specifically called out (PH ≥ 5 jackpot proximity). It uses `state.deck.length` directly, bypassing the tracker entirely — confirmed insulated from any tracker miscount.

`evaluatePlaceChain` (Setup Engineering's place-chain survival modeling) — does not touch the tracker at all; only `handCards` and `board`. Also insulated.

### Sibling concerns surfaced during this audit (NOT in scope of Q4, worth their own tickets)

These are real but distinct issues that surfaced while tracing the call graph:

**Sibling 1 — Persistence gap:** When `loadGame()` returns a saved game, the `useState` initializer hits `if (saved) return saved;` and **skips** both the `recordPlacement` loop and the `seedInitialDeal(12)` call. The tracker stays at the bare `createCardTracker()` defaults (`totalSeen=0, gamePhase='early'`) regardless of how far the saved game progressed. The tracker silently desyncs from game state on reload.

   - Severity: Medium-low. The tracker rebuilds approximately correctly after a few turns (recordCapture/recordPlacement on subsequent moves), but `seenCards` will lack history of pre-save cards, and `valueCounts` will undercount permanently for the resumed game.
   - Suggested follow-up: serialize tracker state alongside game state in `saveGame`/`loadGame`, OR rebuild the tracker from `state.board` + a `seedInitialDeal` call based on `state.deck.length` derivation when loading.

**Sibling 2 — Fragile caller pattern:** `createCardTracker()` itself does not seed the 12. The controller has to remember to call `seedInitialDeal(12)` after `recordPlacement` for board cards. If any future caller (tests, alternative entry points, a hypothetical headless simulator) uses `createCardTracker()` directly, they'll silently miss the seed.

   - Severity: Low. Test fixtures in `dynamicWeights.test.ts:131-167` already follow the pattern correctly, but it's load-bearing convention without a guard.
   - Suggested follow-up: either inline the 12 into `createCardTracker()` (with a board-card param) or add a `createGameTracker(boardCards)` convenience factory that does both steps. Make the seam less fragile.

**Sibling 3 — `valueCounts` doesn't reflect dealt hand cards (by design, per Option 1):** Because `seedInitialDeal` deliberately only touches `totalSeen` / `deckRemaining` (no card identities), `getRemainingOfRank` will overcount remaining cards per rank by up to 12 at game start — those 12 cards exist somewhere (opponent hands) but the tracker treats them as still in the deck. This is the **deliberate Option 1 tradeoff**, not a bug. Worth documenting somewhere so a future "fix" doesn't accidentally start leaking opponent hand info.

### Recommended fix shape: **No fix needed for Q4 as written.**
The audit's described issue is resolved. Recommend closing audit Q4 as "addressed during Foundation rework; verified May 13, 2026" with a pointer to `useGameController.ts:92` and `cardTracker.ts:98-107` as the implementing code.

If a fix track is desired anyway, it should target the **sibling concerns** above (especially #1, persistence), not the Q4 audit text directly. Those are separate scope.

### Cascading behavior changes: **None.** Re-baseline: **Not needed.**
- Bot behavior at game start: unchanged. Already operating with `totalSeen=16, gamePhase='mid'`.
- Stat card at `docs/stat-card-rebaseline-postfoundation-2026-05-06.md`: was generated against the current (already-fixed) code path. No re-baseline.

### Fix scope: **NONE for Q4 itself.** Sibling 1 (persistence) would be MEDIUM if pursued; Sibling 2 (factory) SMALL; Sibling 3 documentation only.

---

## SECTION 3 — Recommended Fix Strategy

### One CC track or two?

**One CC track, one subsystem.** With Q4 closed by inspection, only Q3 remains. The pattern doesn't need the multi-subsystem checkpointed shape of B1+B2 — Q3 is genuinely small.

If TC wants to bundle one of the Q4 siblings into the same track, the natural pairing is:
- **Sibling 2 (createCardTracker factory)** — pairs naturally with any tracker work, fits the "skill-driven generalization" theme of Q3. Small additive change.
- **Sibling 1 (persistence)** — distinct concern, separate scope. Should be its own track with its own checkpoint.

Recommendation: **Q3 standalone.** Open a separate ticket for Sibling 1 if it's worth doing now (not strictly required for launch readiness). Drop a one-line code comment for Sibling 3 (Option 1 tradeoff) as part of the Q3 track or in a docs PR.

### Independent code paths

Q3 lives entirely in `src/engine/ai/botDecision.ts` (one new function near line 219, one call-site change at line 323, related tests). No overlap with Q4 or the End-of-Hand fix's `turnManager.ts` / `gameState.ts` / `useGameController.ts` paths. Safe to land in isolation.

### Recommended subsystem order if combined

Not applicable for the single-subsystem case. If TC bundles Sibling 2:
1. **Subsystem 1 — Q3 chain threshold (small):** add `captureChainThreshold(se)`, change call site, tests.
2. **Subsystem 2 — Sibling 2 factory (small):** add `createGameTracker(boardCards)` (or inline 12 into `createCardTracker`), migrate the two existing callers, update test fixtures.

Both are small. One CC pass with one checkpoint between would be fine if combined.

---

## Summary table

| Question | Status                          | Root cause                                                     | Fix scope                                  |
| -------- | ------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| **Q3**   | Open                            | `botDecision.ts:323` — hardcoded `1.2x` on `useChainEval` branch | **SMALL** — add `captureChainThreshold(se)` |
| **Q4**   | **Already fixed in Foundation** | `seedInitialDeal(12)` already called from `useGameController.ts:92` | **NONE** — recommend closing audit Q4     |

**No code, types, or tests modified in this track.** Diagnosis only.
