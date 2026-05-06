# Move-Space Coverage Audit — Post-Fix Report

**Date:** May 4, 2026 (post-fix run: May 5, 2026)
**Auditor:** Claude Code (Opus) on Hulk
**Ticket:** FIX TRACK — Move-Space Enumeration (P1)
**Status:** ALL GAPS CLOSED

---

## 1. PRE-FIX vs POST-FIX

| Metric | Pre-Fix | Post-Fix | Delta |
|---|---|---|---|
| States tested | 10,000 | 10,000 | — |
| Hand-card checks | 25,120 | 25,120 | — |
| Pass rate | 94.3% | **100.0%** | +5.7% |
| States with gaps | 567 | **0** | -567 |
| Total gaps | 3,075 | **0** | -3,075 |
| Scoring mismatches | 0 | **0** | — |
| Best-capture misses | 332 | **0** | -332 |
| Points lost to gaps | 4,165 | **0** | -4,165 |

### Gap Categories — All Zeroed

| Category | Pre-Fix | Post-Fix |
|---|---|---|
| `four-plus-card-sum` | 1,439 | 0 |
| `multi-slot-uses-missing-single` | 1,636 | 0 |
| `multi-card-pair` | 0 | 0 |
| `face-card-edge` | 0 | 0 |
| `ace-edge` | 0 | 0 |

---

## 2. FIXES APPLIED

### Fix 1 — Extended Sum Subset Sizes

**File:** `src/engine/core/captureValidator.ts`
**Location:** `findAllCaptures()`, line 183

```typescript
// BEFORE (hardcoded sizes 2 and 3):
for (const size of [2, 3]) {

// AFTER (iterates up to board size):
const maxSumSize = Math.min(board.length, 10);
for (let size = 2; size <= maxSumSize; size++) {
```

The underlying `subsetSumsToValue()` function was already correct for
arbitrary sizes — only the call site was limiting it. Sum targets max
at 10 (highest non-face card value), so large subsets prune early when
their running sum exceeds the target.

### Fix 2 — Multi-Card Pair Subset Enumeration

**File:** `src/engine/core/captureValidator.ts`
**Location:** `findAllCaptures()`, lines 172-179

```typescript
// BEFORE (one option per matching board card):
for (const b of board) {
  if (b.rank === handCard.rank) {
    options.push({ type: 'pair', boardCards: [b], ... });
  }
}

// AFTER (every non-empty subset of matching board cards):
const matchingBoard = board.filter((b) => b.rank === handCard.rank);
for (let mask = 1; mask < 1 << matchingBoard.length; mask++) {
  const subset: Card[] = [];
  for (let i = 0; i < matchingBoard.length; i++) {
    if (mask & (1 << i)) subset.push(matchingBoard[i]);
  }
  options.push({ type: 'pair', boardCards: subset, ... });
}
```

Max 4 cards per rank in a standard deck = 2^4 - 1 = 15 pair options
per matching rank. Performance impact: negligible.

---

## 3. HAND-CRAFTED TEST RESULTS (ALL PASS)

| Test | Pre-Fix | Post-Fix |
|---|---|---|
| C1: Engine finds 3-slot apex capture | PASS | PASS |
| C1: Engine finds apex with multi-card pair slots | FAIL (25 vs 30 pts) | **PASS (30 pts)** |
| C2: Engine finds A+A+7=9 (3-card sum) | PASS | PASS |
| C2: Engine finds A+A+A+6=9 (4-card sum) | FAIL (not found) | **PASS (55 pts)** |
| C2: Ace as base captures high-value cards | PASS | PASS |
| C3: Face card pairs only, no sums | PASS | PASS |
| C3: Face cards never in sum slots | PASS | PASS |
| C3: Face card multi-slot pair capture | PASS | PASS |
| C4: Engine finds 2+3+4=9 (3-card sum) | PASS | PASS |
| C4: Engine finds A+2+3+4=10 (4-card sum) | FAIL (not found) | **PASS (40 pts)** |
| C4: Engine finds A+A+A+A+6=10 (5-card sum) | FAIL (not found) | **PASS (75 pts)** |
| C5: Multiple base options, best multi-slot | PASS | PASS |
| C5: Higher-scoring options ranked above lower | PASS | PASS |
| C6: Placement always legal | PASS | PASS |
| C6: Face card placement legal with pairs | PASS | PASS |

---

## 4. FULL TEST SUITE

**242 tests pass. Zero failures. Zero regressions.**

- 221 original tests (engine, AI, adventure, utilities)
- 21 audit tests (10K randomized + 15 hand-crafted + 5 scoring)

No new tests were added in this fix track. Existing audit tests were
updated to assert the engine FINDS captures it previously missed.

---

## 5. IMPACT ON BOTS

With both fixes applied, `findAllCaptures()` now returns the complete
set of legal single-slot captures, and `findBestMultiSlotCapture()` now
operates on complete input. Downstream effects:

- **Nina and Rex** (`allowMultiSlot: true`): Will now see and select
  multi-slot apex captures that use 4+ card sums or multi-card pairs
  in slots. This directly addresses TC's reports of missed multi-slot
  captures in real games.

- **Calvin** (`allowMultiSlot: false`): Unaffected for multi-slot. Will
  now see 4+ card sum single-slot captures (marginal improvement), but
  his `mistakeRate: 0.25` and static weights limit practical impact.

- **Evaluator pipeline**: No changes needed. `evaluateAllActions()` in
  `evaluator.ts` consumes `findAllCaptures()` and
  `findBestMultiSlotCapture()` without modification. More options flow
  through the same scoring and ranking pipeline.

---

## 6. WHAT'S NEXT

Per Stacy's ticket:

1. TC reviews fixes and runs tests locally
2. TC merges and pushes
3. Stat card baselines from the May 3 Position Audit are now stale —
   re-measurement needed against the fixed engine (Track 2)
4. Foundation engine work is unblocked

---

## 7. DELIVERABLE LOCATIONS

| Deliverable | Path | Status |
|---|---|---|
| Engine fix | `src/engine/core/captureValidator.ts` | Modified |
| Pre-fix audit report | `docs/coverage-audit-2026-05-04.md` | Unchanged (baseline) |
| Post-fix audit report | `docs/coverage-audit-2026-05-04-postfix.md` | New |
| Brute-force enumerator | `tests/coverage/brute-force-enumerator.ts` | Unchanged |
| Test harness | `tests/coverage/move-space-coverage.test.ts` | Updated (gap assertions → find assertions) |
