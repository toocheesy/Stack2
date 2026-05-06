# Move-Space Coverage Audit Report

**Date:** May 4, 2026
**Auditor:** Claude Code (Opus) on Hulk
**Ticket:** Step 0 — Move-Space Coverage Audit (READ-ONLY)
**Priority:** P1 (blocks Foundation engine work)
**Status:** GAPS FOUND

---

## 1. SUMMARY

| Metric | Value |
|---|---|
| States tested | 10,000 |
| Hand-card checks | 25,120 |
| States clean (PASS) | 9,433 (94.3%) |
| States with gaps (FAIL) | 567 (5.67%) |
| Total individual gaps found | 3,075 |
| Scoring mismatches | 0 |
| Best-capture misses | 332 (1.3% of checks) |
| Total points lost to gaps | 4,165 |

### Gap Breakdown by Category

| Category | Count | % of Gaps |
|---|---|---|
| `four-plus-card-sum` | 1,439 | 46.8% |
| `multi-slot-uses-missing-single` | 1,636 | 53.2% |
| `multi-card-pair` | 0 (see note) | 0% |
| `face-card-edge` | 0 | 0% |
| `ace-edge` | 0 | 0% |
| `other` | 0 | 0% |

**Note on multi-card-pair:** Zero single-slot gaps because the engine can
reach the same board cards using multiple slots. The gap manifests only at
the multi-slot level (categorized under `multi-slot-uses-missing-single`)
when 3+ matching cards plus additional capture groups exceed the 3-slot
limit. Confirmed via hand-crafted test C1 (see Section 2.2).

---

## 2. SPECIFIC GAPS IDENTIFIED

### 2.1 GAP: 4+ Card Sum Subsets Not Enumerated

**Description:** `findAllCaptures()` only checks sum subsets of exactly 2
and 3 board cards. Valid sums of 4 or more cards are never found.

**Root cause:** `captureValidator.ts:183`
```typescript
for (const size of [2, 3]) {
  const subsets = subsetSumsToValue(board, handCard.value, size);
```

The loop hardcodes sizes 2 and 3. The underlying `subsetSumsToValue()`
function (line 143-166) is correct and works for any size — it is simply
never called with size > 3.

**Frequency:** 1,439 direct gaps in 10,000 states (14.4% of all gaps).
Additionally causes 1,636 cascading multi-slot gaps (see 2.3).

**Severity:** HIGH. Affects both single-slot and multi-slot captures.
Blocks the engine from finding high-value Ace-stacking plays that the
doctrine identifies as strategically critical (Section 1.2, 1.6, 1.12).

**Examples from randomized testing:**

| Hand | Board (relevant cards) | Missed Sum | Points Missed |
|---|---|---|---|
| 9♣ | A♦, 5♣, A♣, 2♦ | A+5+A+2 = 9 (4 cards) | Single-slot: 45 pts |
| 10♣ | 5♥, A♣, A♥, 3♥ | 5+A+A+3 = 10 (4 cards) | Single-slot: 45 pts |
| 9♠ | 2♣, 2♥, A♣, 4♦ | 2+2+A+4 = 9 (4 cards) | Single-slot: 25 pts |

**Hand-crafted confirmation (Test C4):**

- 4-card: Hand 10♥, Board [A♦, 2♠, 3♣, 4♥]. Sum A+2+3+4=10. Engine
  returns 0 sum options. Ground truth finds it: 40 pts.
- 5-card: Hand 10♥, Board [A♣, A♦, A♠, A♥, 6♣]. Sum A+A+A+A+6=10.
  Engine returns 0 sum options. Ground truth finds it: 75 pts.

**Realistic 4+ card sums possible in STACKED:**

| Sum Target | Example Composition | Card Count |
|---|---|---|
| 4 | A+A+A+A | 4 |
| 5 | A+A+A+2 | 4 |
| 6 | A+A+A+3 or A+A+2+2 | 4 |
| 7 | A+A+A+4 or A+A+2+3 | 4 |
| 8 | A+A+2+4 or A+A+3+3 or A+2+2+3 | 4 |
| 9 | A+A+A+6 or A+A+2+5 or A+A+3+4 or A+2+3+3 | 4 |
| 10 | A+2+3+4 or A+A+2+6 or A+A+3+5 or 2+2+3+3 | 4 |
| 6 | A+A+A+A+2 | 5 |
| 7 | A+A+A+A+3 or A+A+A+2+2 | 5 |
| 8 | A+A+A+2+3 | 5 |
| 9 | A+A+A+2+4 or A+A+2+2+3 | 5 |
| 10 | A+A+A+A+6 or A+A+A+2+5 or A+A+A+3+4 or A+A+2+2+4 or A+A+2+3+3 or A+2+2+2+3 | 5-6 |

These are all mathematically valid and occur in real game states, especially
on dense boards (8+ cards) with multiple Aces present.

---

### 2.2 GAP: Multi-Card Pairs Not Enumerated as Single-Slot Options

**Description:** `findAllCaptures()` generates one `CaptureOption` per
matching board card. It does not generate options for 2+ matching board
cards in a single slot, even though the validation layer
(`validateComboSlot`, line 28-35) accepts them.

**Root cause:** `captureValidator.ts:172-179`
```typescript
for (const b of board) {
  if (b.rank === handCard.rank) {
    options.push({
      type: 'pair',
      boardCards: [b],
      points: handCardPoints + calculateCardPoints(b),
    });
  }
}
```

Each matching board card generates a separate 1-card pair option. Subsets
of 2+ matching cards are never generated.

**Frequency:** 0 direct single-slot gaps (the engine reaches the same board
cards via multi-slot arrangement). The gap manifests only when multi-card
pairs + additional groups exceed 3 slots.

**Severity:** MEDIUM. Only impacts multi-slot captures where slot
efficiency matters. Confirmed via hand-crafted test C1:

- Hand: 5♥, Board: [5♣, 5♠, 5♦, 2♥, 3♣]
- Ground truth: slot1=[5♣,5♠,5♦] (3-card pair) + slot2=[2♥,3♣] (sum=5)
  captures ALL 5 board cards for **30 pts**
- Engine: best 3-slot = [5♣]+[5♠]+[2♥,3♣] = 4 board cards for **25 pts**
- Engine CANNOT capture all 5 board cards because it needs 3 slots for
  3 individual pair options, leaving no room for the sum group alongside
  all 3 pairs
- **5 points lost** per occurrence

This gap becomes strategically significant when 3+ matching cards appear
alongside sum-capturable groups — exactly the apex capture scenario the
doctrine prioritizes (Section 1.2).

---

### 2.3 GAP: Cascading Multi-Slot Failures

**Description:** Because `findAllCaptures()` misses 4+ card sums and
multi-card pairs, `findBestMultiSlotCapture()` inherits both gaps. It
operates on the incomplete option list from `findAllCaptures()`, so it
cannot build multi-slot captures that require missing options in any slot.

**Root cause:** `findBestMultiSlotCapture()` (line 203-249) is
architecturally correct — it exhaustively searches all non-overlapping
2-3 combinations of the options it receives. The problem is upstream:
incomplete input from `findAllCaptures()`.

**Frequency:** 1,636 multi-slot gaps in 10,000 states.

**Severity:** HIGH. This is where the doctrine's apex play concern hits
hardest. Multi-slot captures are STACKED's highest-value play (Section
1.2). When the engine can't see a 4+ card sum option, it can't place it
in a slot, and the entire multi-slot combination built around it is
invisible.

**Worst-case example from randomized testing:**
- Hand: 10♦, Board: [Q♠, 10♠, 9♣, 10♣, Q♦, A♠, 3♦, 3♥, A♥, 7♥, 5♦, Q♣]
- Ground truth best: **80 pts**
- Engine best: **50 pts**
- **30 points lost** — the engine misses a multi-slot capture that uses a
  4+ card sum slot

---

## 3. SCORING VERIFICATION

**Result: PASS — Zero scoring mismatches.**

All captures that the engine DOES find are scored correctly per the
doctrine value hierarchy:

| Card | Expected | Engine |
|---|---|---|
| Ace | 15 pts | 15 pts |
| K/Q/J/10 | 10 pts | 10 pts |
| 2-9 | 5 pts | 5 pts |

Both `calculateCardPoints()` and `calculateCardsPoints()` in `scoring.ts`
use the correct `SCORE_VALUES` lookup table. Multi-slot scoring correctly
sums hand card points (once) plus all captured board card points.

The issue is not scoring incorrectness — it is capture invisibility.

---

## 4. WHAT IS WORKING CORRECTLY

The audit confirms these engine behaviors are correct:

- **Face card pair-only enforcement:** Face cards (J/Q/K) never appear in
  sum slots. Face card pairs are found reliably. (Tests C3)
- **Ace sum vehicle behavior:** Aces correctly count as 1 in sum
  calculations and score 15 when captured. A+A+7=9 (3-card sum) is found.
  (Tests C2)
- **2-card and 3-card sums:** All sum subsets of size 2 and 3 are found
  exhaustively. (Tests C4, randomized)
- **Multi-slot combination logic:** `findBestMultiSlotCapture()` correctly
  finds the best non-overlapping combination of the options it receives.
  Overlap checking is correct. (Tests C1, C5)
- **Multi-slot scoring:** Points calculated correctly for multi-slot
  captures. (Tests C5, randomized)
- **Multiple base options:** When a hand card has multiple valid captures
  against the board, all are found and ranked by points. (Test C5)

---

## 5. RECOMMENDATION

### Fix BEFORE Foundation engine work (P1):

**1. Extend sum subset sizes in `findAllCaptures()`**

Change `captureValidator.ts:183`:
```typescript
// CURRENT (misses 4+ card sums):
for (const size of [2, 3]) {

// NEEDED (covers all valid sums):
const maxSumSize = Math.min(board.length, 10);
for (let size = 2; size <= maxSumSize; size++) {
```

The `subsetSumsToValue()` function already handles arbitrary sizes
correctly. Only the call site needs to change. Performance impact is
negligible — sum targets max at 10, so large subsets prune early
(sum exceeds target).

**2. Generate multi-card pair options in `findAllCaptures()`**

Add subset enumeration for matching board cards:
```typescript
// CURRENT: generates only 1-card pair options
for (const b of board) {
  if (b.rank === handCard.rank) {
    options.push({ type: 'pair', boardCards: [b], ... });
  }
}

// NEEDED: also generate 2+ card pair options
const matchingBoard = board.filter(b => b.rank === handCard.rank);
for (let size = 1; size < (1 << matchingBoard.length); size++) {
  const subset = matchingBoard.filter((_, i) => size & (1 << i));
  options.push({ type: 'pair', boardCards: subset, ... });
}
```

This lets `findBestMultiSlotCapture()` pack multiple matching cards into
one slot, freeing other slots for additional captures.

### Deferrable:

**3. `findBestMultiSlotCapture` returns only the best result**

Currently the function returns a single `MultiSlotCapture | null`. If the
Foundation engine evaluator needs to compare multiple multi-slot options
for strategic reasons (e.g., one option scores less but leaves a better
board state), this would need refactoring to return all valid multi-slot
captures. Not a coverage gap — just a design consideration for the
strategic evaluation layer.

**4. No architectural concerns**

The combo builder's validation layer (`validateComboSlot`,
`validateFullCombo`) correctly handles all capture types including
multi-card pairs, 4+ card sums, and multi-slot combinations. The gap is
entirely in the enumeration layer, not in validation or game rules. Fixing
enumeration does not require architectural changes.

---

## 6. TEST HARNESS LOCATION

| Deliverable | Path |
|---|---|
| Brute-force enumerator | `tests/coverage/brute-force-enumerator.ts` |
| Test harness | `tests/coverage/move-space-coverage.test.ts` |
| This report | `docs/coverage-audit-2026-05-04.md` |

The test harness is reusable infrastructure. Run `npx vitest run tests/coverage/move-space-coverage.test.ts` after any engine changes to move enumeration. The randomized audit uses seed `20260504` for reproducibility.

**Test count after audit:** 242 total (21 new audit tests + 221 existing).
All pass.
