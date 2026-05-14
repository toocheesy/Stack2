# Bot Architecture Audit + Placement Value Violation + Rex Underperformance — Diagnosis

**Track:** `VERIFY — Bot Architecture Audit + Doctrine 3.2 Placement Violation + Rex Underperformance` — read-only diagnosis, P1.
**Trigger:** TC playtest of post-calibration-fix build. Score 430/285/45 at target 300; Nina placed an Ace while holding a 5.
**Doctrine ref:** Notion `3562f2662cac8134b848d59ce9f08573` — sections 3.2 (Placement Value Tier List), 7.3 (Tier = Depth Not Breadth), 1.10 (Reactive Strategy).
**Status:** Investigation complete. **No code touched.** Headline: **all three threads converge on the same root cause** — `scorePlacement()` doesn't enforce doctrine 3.2, and that violation compounds with Rex's risk-threshold gate to produce the underperformance.

---

## SECTION 1 — Doctrine 3.2 Placement Value Diagnosis (Thread 1)

### What doctrine 3.2 says (per ticket text)
- Low-value cards (2-9) get placed first.
- High-value cards (face + Ace) get deferred.
- Deferring high-value cards is a **primary placement principle**.

### `scorePlacement()` factor inventory
`src/engine/ai/evaluator.ts:372-475` — full factor list:

| Factor                  | Dimension          | When it fires                                                                                                          |
| ----------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Place-to-Plant setup    | `rawPoints` (positive) | SE ≥ 3 AND placing a face card AND remaining hand has a matching face. Doctrine 3.3 face-plant setup.            |
| Jackpot Trap bonus      | `rawPoints` (positive) | SE ≥ 7 AND placed face is in selectiveDeck.oddOnes AND handNumber ≥ 3. Doctrine 6.4.                              |
| Odd-One Trap penalty    | `placementDanger` (negative) | Placing a face whose rank is in selectiveDeck.oddOnes. Selective deck awareness only.                          |
| Same-rank pair risk     | `placementDanger` (negative) | For every rank still remaining, if `rank === handCard.rank` then `danger += SCORE_VALUES[rank]`.                |
| Calvin-aware face safety | `placementDanger` mod | If `nextOpponent.preferHighestNumberCardOnPlace === true` AND placed is face: pair danger × 0.3.                  |
| Sum-capture risk        | `placementDanger` (negative) | For each non-face opponent rank > placedValue with `boardCanSumTo(needed)`: `danger += SCORE_VALUES[rank]`.     |
| Endgame jackpot penalty | `jackpotValue` (negative) | gamePhase === 'endgame' AND not last capturer: jackpotValue -= 10.                                              |

### What's missing
**The card's intrinsic value (`SCORE_VALUES[handCard.rank]`) is NOT a placement factor.** It's referenced only inside `pairDanger`, which is an **indirect proxy** ("if my pair-able card gets captured, opponent gets 15 pts for Ace, 10 pts for 10/face, 5 pts for 2-9").

Two missing axes:
1. **Future-value-loss / opportunity cost.** An Ace held in hand can score 15+ pts when used in a capture. A 5 in hand can score 5+ pts in a capture. Placing the Ace means giving up the bigger capture opportunity. `scorePlacement` doesn't encode this.
2. **Doctrine-locked floor.** Doctrine 3.2 frames "defer high-value cards" as a primary principle, not a soft preference. The current scoring is purely soft (weighted), so when pair-danger collapses, value-deferral collapses with it.

### The 10-and-face loophole (critical, present in current code)
Walk through `scorePlacement` for **placing a 10** (handCard.rank='10', placedValue=10, placedIsFace=false):
1. Loop over ranks. Same-rank 10: `pairDanger = SCORE_VALUES['10'] = 10`. → `danger += 10` (if 10s remain).
2. For every other rank: `opponentValue ≤ placedValue` (every rank's value is ≤ 10), so `continue`. Face ranks: `if (isFace(rank)) continue;` also skipped.
3. **Result:** `danger = 10` (pair only). No sum-capture risk possible.

Same for **placing a face card** (J/Q/K, placedIsFace=true, placedValue=0):
1. Same-rank face: `pairDanger = 10`. → `danger += 10` (if same-rank face remains).
2. For every other rank: `if (placedIsFace) continue;` → skip everything else.
3. **Result:** `danger = 10` if remaining same-rank face, else `danger = 0`.

Compare to **placing a 5** (placedValue=5, placedIsFace=false):
1. Same-rank 5: `pairDanger = 5`.
2. Ranks 6-10: each contributes `SCORE_VALUES[rank]` if `boardCanSumTo(R - 5)`. Multiple potential dangers.
3. **Result:** `danger ≈ 5 + (5..30) = 10..35` typically.

**A 10 has lower placement-danger than a 5 in almost every board state.** Bots actively prefer placing 10s and faces over 2-9s — the exact opposite of doctrine 3.2.

This is silent, deterministic, and affects every bot except Calvin (who escapes via `preferHighestNumberCardOnPlace`).

### Tracing Nina's specific [A, 5] scenario
Assume a typical mid-round state. Nina's overall game state at the moment she chose to place: trailing, board has some mixed ranks. Her placementDanger weight is 0.7 base, possibly modified.

**Place Ace** (handCard.rank='A', placedValue=1, placedIsFace=false):
- Same-rank A: pairDanger = `SCORE_VALUES['A'] = 15`. Only contributes if any Ace remains in the tracker view (deck + hands, excluding captured).
- Ranks 2-10 (non-face): each contributes `SCORE_VALUES[rank]` if `boardCanSumTo(opponentValue - 1)`.
  - Rank 3: needed = 2. Possible if board has 2 cards summing to 2 (two Aces).
  - Rank 5: needed = 4. Possible if board has 4 (e.g., 2+2, 3+1, 4 alone... wait, `boardCanSumTo` requires a subset summing to 4 — possible with 2+2 or 4-alone is one card so still works; actually let me re-check).
  - ... ranks 4-10 all generate potential danger contingent on board.
- Typical mid-game total: `danger ≈ 15 + 20..50 = 35..65`.
- If Aces are exhausted from the tracker (rare but possible — 3 Aces captured or in known locations), pair-A danger = 0 and total drops to `0 + 20..50 = 20..50`.

**Place 5** (handCard.rank='5', placedValue=5):
- Same-rank 5: pairDanger = 5.
- Ranks 7-10 (non-face, > 5): each contributes `SCORE_VALUES[rank]` if board can sum to (rank - 5).
  - Rank 7: needed = 2 (two Aces).
  - Rank 8: needed = 3 (Ace + 2).
  - Rank 9: needed = 4 (Ace + 3 or 2 + 2).
  - Rank 10: needed = 5 (Ace + 4 or 2 + 3).
- Typical: `danger ≈ 5 + 15..35 = 20..40`.

**Comparison:**
- *Typical* state with Aces still in play → Ace danger (35-65) > 5 danger (20-40). 5 has higher score (less negative). Nina should place 5. ✓ doctrine-aligned.
- *Edge case* with Aces tracked as exhausted → Ace danger drops to 20-50. Could overlap or even fall below 5's range. Doctrine 3.2 still says defer, but the math doesn't enforce it.
- *Mistake roll* (Nina mistakeRate = 0.08): top-half pool. If `actions.length >= 4` (likely with a 4-card hand), `half = 2`. With ordering "place 5 best, place Ace second," 8% chance mistake roll picks Ace.

### Why Nina actually placed the Ace (most likely)
Two non-exclusive paths:
1. **Mistake roll** at 8% rate caught Ace-over-5 once across many placements during the game. Stochastically expected.
2. **Tracker state put pair-A danger near zero.** Late-round game where Aces have been seen, pair-danger drops, and any incidental capture target on the board (a remaining Ace would feed the Ace pair attack) pushes 5's sum-risk above Ace's now-collapsed pair-risk.

Neither of these would happen under doctrine 3.2 if it were enforced as a hard floor.

### Why Calvin escapes
`src/engine/ai/botDecision.ts:399-405` and the `calvinNumberCardPick` helper in `evaluator.ts:760-771`:
```ts
if (
  profile.preferHighestNumberCardOnPlace &&
  chosen.action === 'place'
) {
  const highest = calvinNumberCardPick(state.hands[playerIndex]);
  if (highest && highest.id !== chosen.handCard.id) {
    const swap = actions.find(
      (a) => a.action === 'place' && a.handCard.id === highest.id,
    );
    if (swap) chosen = swap;
  }
}
```
Calvin's flag swaps his chosen placement to his highest 2-9 number card. **Hardcoded, binary, per-personality.** Other bots don't get this override.

### The gap, summarized
- Calvin enforces doctrine 3.2 via a hardcoded post-decision swap flag.
- Nina, Rex, Jett rely on `scorePlacement.placementDanger` indirectly approximating value-deferral via `pairDanger`.
- The approximation fails in three places: (a) 10/face placements have artificially low danger because the sum-risk loop short-circuits; (b) Ace pair-danger collapses when Aces are tracked as exhausted; (c) mistake rolls can flip ordering on edge cases.

### Proposed solution shape
Two angles, can be combined:

**Universal placement-value penalty (universal rule, doctrine-locked):**
Add a new dimension to `scorePlacement` that penalizes placement of high-value cards independent of pair/sum capture risk. Something like:
```ts
const valueLossPenalty = (placedIsFace || placedValue === 1 || placedValue === 10)
  ? SCORE_VALUES[handCard.rank] * VALUE_LOSS_FACTOR
  : 0;
```
Apply universally (all bots), tier the magnitude by a skill. Calvin's `preferHighestNumberCardOnPlace` flag becomes redundant or remains as a strict-floor override (top of the tier).

**Skill-scaled value-deferral preference (mirrors doctrine 7.3 tier=depth pattern):**
Introduce a `placementIntelligence` skill (new) or repurpose an existing skill (`setupEngineering` is a natural fit). Scale how strictly the bot follows the value-tier rule:
- Low PI: weak preference (current scorePlacement behavior).
- Mid PI: explicit penalty for placing 10/face/A.
- High PI: strict avoidance, fall back to placing 2-9 unless no 2-9 in hand.

Calvin's hardcoded behavior is the strictest tier (place HIGHEST 2-9). Other bots could get softer versions of the same rule.

**Recommendation:** combine both. Add a universal `valueLossPenalty` to `scorePlacement` as a baseline floor, then scale strictness with skill (Calvin SE=1 = strict, Jett SE=8 = soft). The strict end keeps Calvin's tell; the soft end gives Nina/Rex/Jett doctrine 3.2 compliance without losing Calvin's distinct identity.

### Cross-check: does higher PI buy current bots ANY value-deferral?
**No.** Currently:
- `positionAwareness` modifies placementDanger × 0.7-1.2 (multipliers, no value-tier logic).
- `setupEngineering` ≥ 3 enables face-plant setupValue (POSITIVE rawPoints for face placement) — actually slightly counter-productive to doctrine 3.2 since it makes face placement MORE attractive when a face-plant chain is detected.
- `deckAwareness` enables `selectiveDeck` info → `oddOnes` penalty for placing solo face cards.
- `opponentAwareness` enables `nextOpponent` info → `preferHighestNumberCardOnPlace` Calvin-detection bonus on face placements.
- `pressureHandling` modifies rawPoints/jackpotValue/placementDanger via multipliers — no value-tier logic.

The closest existing thing is the Odd-One Trap penalty (`scorePlacement:419-425`), which fires only when placing a face whose rank is one of the last-remaining in the deck. Narrow case.

### Fix scope estimate: **MEDIUM**
- New scoring factor in `scorePlacement` (4-6 lines).
- New scaling function (similar to `captureChainThreshold(se)`) OR reuse SE/RT/new skill.
- Adjust `scoreCapture`/`evaluatePlaceChain` if value-deferral interacts with face-plant setup (it does — face-plant setup intentionally PLACES faces; need to ensure the universal penalty doesn't kill that mechanic for SE ≥ 3 bots).
- Update tests in evaluator.test.ts (~6 new tests).
- Stat-card re-baseline plausible since Rex/Jett will play noticeably differently.

---

## SECTION 2 — Nina vs Rex Architecture Audit (Thread 2)

### Side-by-side comparison table

| Field                             | Calvin | Nina  | Rex   | Jett  | Classification              |
| --------------------------------- | ------ | ----- | ----- | ----- | --------------------------- |
| **Weights**                       |        |       |       |       |                             |
| rawPoints                         | 1.0    | 1.0   | 0.8   | 0.7   | Skill-driven (smooth)       |
| chainPotential                    | 0.0    | 0.5   | 1.0   | 1.0   | Skill-driven (smooth)       |
| placementDanger                   | 0.1    | 0.7   | 1.0   | 1.2   | Skill-driven (smooth)       |
| opponentDenial                    | 0.0    | 0.3   | 0.9   | 1.0   | Skill-driven (smooth)       |
| jackpotValue                      | 0.0    | 0.4   | 1.0   | 1.0   | Skill-driven (smooth)       |
| boardControl                      | 0.0    | 0.3   | 0.8   | 1.0   | Skill-driven (smooth)       |
| mistakeRate                       | 0.25   | 0.08  | 0.02  | 0.005 | Skill-driven (smooth)       |
| **Binary feature flags**          |        |       |       |       |                             |
| `allowMultiSlot`                  | false  | TRUE  | TRUE  | TRUE  | **LEGACY BINARY HARDCODE**  |
| `useChainEval`                    | false  | false | TRUE  | TRUE  | **LEGACY BINARY HARDCODE**  |
| `preferSumsOnTie`                 | false  | TRUE  | false | false | LEGITIMATE STYLISTIC FLAVOR |
| `preferHighestNumberCardOnPlace`  | TRUE   | false | false | false | **LEGACY BINARY HARDCODE** (Calvin-only enforcement of doctrine 3.2; should be universal — see Section 1) |
| **Skill values**                  |        |       |       |       |                             |
| riskThreshold                     | 0.02   | 0.05  | 0.08  | 0.10  | Skill-driven (smooth)       |
| deckAwareness                     | 2      | 5     | 7     | 8     | Skill-driven                |
| opponentAwareness                 | 1      | 4     | 7     | 8     | Skill-driven                |
| positionAwareness                 | 2      | 5     | 8     | 9     | Skill-driven                |
| pressureHandling                  | 1      | 5     | 9     | 9     | Skill-driven                |
| setupEngineering                  | 1      | 4     | 7     | 8     | Skill-driven                |

### Code paths that branch on the four binary flags

| Flag | Consumer | Behavior |
| ---- | -------- | -------- |
| `allowMultiSlot` | `botDecision.ts:292` (passed to `evaluateAllActions`) | When false, multi-slot captures are not added to the action list. Calvin literally cannot see multi-slot captures. |
| `allowMultiSlot` | `botDecision.ts:159, 171` (in `opponentInfoFor`) | Used in opponent modeling — opponents flag their multi-slot capability. |
| `allowMultiSlot` | `evaluator.ts:217` (`OpponentInfo` field) | Currently only the field exists; consumers don't yet branch on opponent's multi-slot capability differently. Reserved. |
| `useChainEval` | `botDecision.ts:327` | When true, `evaluateChainCapture` runs and its plan can be promoted via `captureChainThreshold(se)` (the Q3 fix). When false, no chain evaluation. |
| `preferSumsOnTie` | `botDecision.ts:323` (calls `applyNinaSumPreference`) | Re-sorts ties: sum-type captures beat pair-type captures when totals are equal. |
| `preferHighestNumberCardOnPlace` | `botDecision.ts:312, 399`; `evaluator.ts:401, 436` | Calvin: post-decision swap to highest 2-9 in hand. **Also leaks**: opponents who model Calvin (`nextOpponent.preferHighestNumberCardOnPlace`) get face-safety bonuses in scorePlacement. |

### Classification + proposed generalization

#### `allowMultiSlot` → LEGACY BINARY HARDCODE
**Natural skill:** `setupEngineering` or a new "captureComplexity" attribute.
**Why:** seeing multi-slot captures is a perceptual/computational skill — exactly the kind of breadth-of-search that should scale with intelligence rather than be on/off.
**Proposed curve:** gate by `setupEngineering`:
- SE ≤ 2 (Calvin): no multi-slot.
- SE ≥ 3: 2-slot captures visible.
- SE ≥ 5: 3-slot captures visible.
Or simplest: SE ≥ 3 unlocks all multi-slot. Calvin (SE=1) keeps current behavior.
**Fix scope:** SMALL. One call-site at `botDecision.ts:292`, one gate function, ~3 tests.

#### `useChainEval` → LEGACY BINARY HARDCODE
**Natural skill:** `setupEngineering`. Chain evaluation is multi-turn planning — a setup-engineering skill in the exact sense the word is used.
**Why:** the existing `chainPotential` weight (Calvin 0, Nina 0.5, Rex 1.0, Jett 1.0) already encodes appetite for chain captures. `useChainEval` is the binary gate for whether the bot even LOOKS for chains. The two are redundant — `chainPotential = 0` means even if you find a chain, you don't reward it. Should consolidate: `chainPotential > 0` is sufficient to gate chain evaluation.
**Proposed curve:** drop `useChainEval` entirely. Use `profile.weights.chainPotential > 0` as the gate. Or: SE ≥ 5 enables chain evaluation (matches current Rex SE=7, Jett SE=8). Or: thresholded via a new `chainEvaluationDepth` skill.
**Fix scope:** SMALL. Remove flag, change one call-site at `botDecision.ts:327`, ~2 tests.

#### `preferSumsOnTie` → LEGITIMATE STYLISTIC FLAVOR
**Recommendation:** KEEP as flag. Nina being a "sum specialist" is identity, not skill depth.
**Why:** doctrine doesn't explicitly say sums > pairs or vice versa — both produce captures, sums slightly less common. Nina's preference is character. Could rename for clarity (`captureStyle: 'sum' | 'pair' | 'neutral'`) but that's cosmetic.

#### `preferHighestNumberCardOnPlace` → LEGACY BINARY HARDCODE (special case)
**Recommendation:** Generalize via Section 1's universal placement-value penalty. **Calvin's flag stays as the strictest tier** (force highest 2-9), but doctrine 3.2 becomes a universal soft rule that all bots respect to scaling degrees.

This consolidates Threads 1 and 2: the doctrine 3.2 violation is the LEGACY BINARY HARDCODE that affects this flag. Fix one, fix both.

### Priority order if multiple fixes warranted

1. **`preferHighestNumberCardOnPlace` + doctrine 3.2** (Section 1 fix). Highest priority — currently the cause of observed regressions (Nina placing Ace, Rex donating face/10).
2. **`useChainEval`** removal. Low-risk consolidation. Chain potential weight already does the job.
3. **`allowMultiSlot`** SE-gating. Slightly more risk (changes Calvin's action space if SE threshold is wrong) but architecturally cleanest.
4. **`preferSumsOnTie`** — keep, optionally rename for clarity. No fix needed; doctrine 7.3 allows flavor.

### Note on `src/shared/personalities.ts`
This file contains UI display metadata (name, color, label, flavor strings) for personalities, including pending placeholders for Mira and Talia. It's not strategic logic — totally separate from `src/engine/ai/personalities/`. Don't conflate the two during fix work.

---

## SECTION 3 — Rex Underperformance Root Cause (Thread 3)

### Headline
**Primary suspect: the risk-threshold gate at `botDecision.ts:372-393` compounds with the doctrine 3.2 violation (Section 1) to make Rex repeatedly demote captures AND then donate high-value cards to opponents.** This is sufficient on its own to explain a 45/300 score with TC at 430.

### Hypothesis tests (code evidence below each)

#### H1 — Q3 chain threshold too conservative (1.20 → 1.30)
**Verdict:** contributing but small. Not primary.
- Pre-Q3: Rex took any chain plan > 1.20x best single. Post-Q3: Rex needs > 1.30x.
- The (1.20x, 1.30x] band that flipped from "take chain" to "take single" is narrow. Maybe 1-2 decisions per game.
- Even if Rex skipped a marginal chain, he'd take the single — not pass entirely. So this affects scoring magnitude on those decisions, not whether captures happen at all.
- Magnitude estimate: ~5-15 pts per game, not 240+ pts.

#### H2 — B1 dump mechanic over-firing
**Verdict:** very unlikely. Trigger conditions check out.
- `turnManager.ts:58-62` lone-player branch only fires when: `anyPlayerHasCards`, `state.lastAction === 'place'`, AND `findNextPlayerWithCards(skipCurrent=true)` returns null.
- This requires both other players to have empty hands AND current to have just placed.
- For Rex to be incorrectly stuck in dump: someone else would need to have all empty hands when they actually have cards. The hand-length check uses `state.hands[p].length > 0` — directly trustworthy.
- `dumpActive` reset on `dealNewHand` (gameState.ts) and `startNewRound` (gameState.ts). No path leaves it stale.
- `decideBotAction:300-313` filter forces placement only when `state.dumpActive === true`. Doesn't affect captures outside dump.
- **Could not find an edge case where dump fires incorrectly for Rex.**

#### H3 — Doctrine 3.2 violation compounds (this is real)
**Verdict:** PRIMARY SUSPECT (compounds with H4 below).
- See Section 1: bots prefer placing 10/face/Ace over 2-9 in many board states. Rex has no override.
- Each face/10 Rex places becomes a 10-15 pt opportunity for TC or Nina.
- Over a 3-round game with ~12 placements each, Rex could donate 60-120 pts directly through bad placement choices.

#### H4 — Risk threshold gate at RT=0.08 (target 300 → 24-pt cutoff)
**Verdict:** PRIMARY SUSPECT.

`botDecision.ts:372-393`:
```ts
if (profile.riskThreshold > 0 && targetScore > 0) {
  const threshold = targetScore * profile.riskThreshold;
  const topAction = actions[0];
  if (
    topAction.action === 'capture' &&
    topAction.captureDetails &&
    topAction.captureDetails.totalPoints < threshold
  ) {
    const bestPlace = actions.find((a) => a.action === 'place');
    if (bestPlace && bestPlace.score.placementDanger > -threshold) {
      actions = [bestPlace, ...actions.filter((a) => a !== bestPlace)];
    }
  }
}
```

For Rex at target 300, threshold = **24 points**. Captures below 24 raw points get demoted to placements IF best-placement danger < 24.

**Common Rex captures and their fate:**

| Capture                  | Raw pts | < 24 threshold? | Likely demoted? |
| ------------------------ | ------- | --------------- | --------------- |
| pair 2-9 (e.g., 5+5)     | 10      | YES             | If bestPlace danger < 24 |
| pair 10 / face (10+10)   | 20      | YES             | Yes likely      |
| pair Ace (A+A)           | 30      | NO              | Not demoted     |
| sum 6 (e.g., 6=2+4)      | ~12     | YES             | Often demoted   |
| sum 10 (10 alone)        | 10      | YES             | Often           |
| multi-slot (2 slots)     | 15-40   | Maybe           | Sometimes       |
| chain (Q3-promoted)      | 1.30×best | Often > 24   | Not demoted     |

**The demote condition's second clause** `bestPlace.score.placementDanger > -threshold` evaluates to `danger < 24`. Per Section 1: face placement danger ≈ 10, 10 placement danger ≈ 10, both well below 24. So the demote condition fires constantly.

**Compounded behavior trace:**
1. Rex's turn. Best action: capture 5+5 = 10 pts.
2. RT gate: 10 < 24. Demote check.
3. bestPlace = a face card placement (danger ~10). `-10 > -24` is true.
4. **Promote face card placement above the capture.**
5. Rex places a King.
6. Opponent (TC or Nina) captures the King next turn for 10 pts.
7. Rex passed on a 10-pt capture AND donated 10 pts to opponents. Net: -20 pts vs taking the capture.
8. Repeat 4-8 times in a round.

This is the smoking gun.

#### H5 — Conservative mode firing inappropriately
**Verdict:** Did NOT fire. Rex at 45 was never leading. `evaluator.ts:743` requires `myScore - maxOpponent >= target * 0.20` (60-pt lead at target 300). Confirmed not the cause.

#### H6 — Denial mode causing capture avoidance
**Verdict:** No. Denial mode (`evaluator.ts:739-740`) raises `opponentDenial` 0.9 → 1.8 and `boardControl` 0.8 → 1.2. Both are POSITIVE weight bumps on CAPTURE scoring (opponentDenial is added in `scoreCapture`). Pulls captures UP relative to placements. Helps not hurts.

The risk-threshold gate uses raw `totalPoints` not weighted total, so denial bonuses don't help captures pass the gate. Captures that would have been promoted by denial bonus (denial value pushes weighted total above placement) get pre-emptively demoted by the raw-points gate. **The RT gate is essentially blind to denial mode's bonus.**

#### H7 — Cross-fix interactions
**Verdict:** no new emergent behavior from B1+B2+Q3+Sibling 1. Each fix is well-scoped:
- B1 dump: only affects play when one player has cards left. Irrelevant to mid-game capture decisions.
- B2 rotation: corrects who-goes-first-each-hand; doesn't affect Rex's individual choices.
- Q3 chain threshold: contributes per H1 above. Marginal.
- Sibling 1 persistence: makes tracker reliable across reloads. If anything, helps Rex (accurate gamePhase, accurate selectiveDeck). Doesn't hurt.

### Primary suspect ranking

1. **H4 (Risk-threshold gate at 0.08 × 300 = 24)** + **H3 (Doctrine 3.2 violation)**. These compound. The RT gate decides "don't capture small" and then steers the bot toward placement; doctrine 3.2 violation steers the placement toward high-value cards (10/face), donating to opponents.
2. **H1 (Q3 chain threshold)**. Minor contribution to conservatism.
3. Everything else: not implicated.

### Impact magnitude estimates

Per-game (target 300):
- H4: Rex passes on ~6-10 captures of 10-23 pts each. Lost: 60-200 pts (if he'd captured those instead).
- H3 compounding: Rex donates ~4-6 face/10 cards. Opponents convert ~50-70%. TC+Nina gain: 30-60 pts that should have been Rex's points-not-lost.
- H1: marginal, 5-15 pts.

Combined: easily 100-250+ pts of swing from these two issues alone. Matches the 45-vs-285-vs-430 observed pattern.

Calvin escapes H3 via `preferHighestNumberCardOnPlace` (he never donates faces). Calvin's RT is also 0.02 so almost nothing gets demoted. Calvin is structurally insulated from this failure mode.

Nina has RT 0.05 (15-pt threshold) so she suffers from H3+H4 but at smaller magnitude than Rex. Her 285 score reflects mid-severity.

Rex's RT 0.08 (24-pt threshold) lands in the **maximum-blast-radius zone**: high enough to demote most pair-2-9 and sum captures, low enough that he isn't catching the bigger captures.

Jett RT 0.10 (30-pt) is even more aggressive but Jett's higher skills (`captureChainThreshold` at 1.20x, better awareness modifiers, etc.) compensate by finding bigger chain plans. Rex sits in the unhappy middle.

### Recommendations (NOT to fix in this track)

- **Fix H3 (Doctrine 3.2)** — see Section 1. This is the structural fix; without it Rex bleeds via placements regardless of RT.
- **Cap the RT gate at an absolute minimum**, e.g., `threshold = Math.min(targetScore * profile.riskThreshold, 15)`. Or only demote when `bestPlace` danger is meaningfully lower (e.g., `danger < threshold * 0.5`).
- **Use weighted score in the gate**, not raw `totalPoints`. The gate currently ignores denial bonus. `actions[0].score.total` already incorporates weights and modifiers; gating on that respects the bot's actual preference rather than a doctrine-naive raw-points cutoff.
- **Re-baseline** after H3+H4 fixes. Rex's stat-card should shift significantly. Nina and Jett less so.

---

## SECTION 4 — Recommended Fix Strategy

### One CC track or multiple?

**Recommend one CC track with three subsystems, ordered for risk:**

1. **Subsystem 1 — Doctrine 3.2 placement value enforcement.** Add `valueLossPenalty` to `scorePlacement` as a universal floor; introduce a skill-scaled strictness curve. Calvin's existing `preferHighestNumberCardOnPlace` stays as the strict-floor tier. Tests in evaluator.test.ts. **Biggest behavioral shift — gets first checkpoint.**

2. **Subsystem 2 — Risk-threshold gate fix.** Either (a) cap the absolute threshold at ~15 pts, (b) use weighted score instead of raw `totalPoints`, or (c) tighten the demote condition (require bigger danger margin). Recommend (b) as the cleanest doctrine-aligned fix. Smaller scope, but landed AFTER Subsystem 1 so we can evaluate whether the doctrine 3.2 fix alone closes the Rex gap.

3. **Subsystem 3 — Binary flag generalization.** `useChainEval` retire (use `chainPotential > 0` as the gate). `allowMultiSlot` gate behind `setupEngineering ≥ 3`. `preferSumsOnTie` keep as flavor. `preferHighestNumberCardOnPlace` keep as Calvin's strict-floor tier. Smaller, architectural-cleanliness scope. Could be deferred to a future track if the first two close the regressions.

### Independent code paths or overlapping concerns?

Thread 1 (Section 1) and Thread 3 (Section 3) are **deeply overlapping** — the doctrine 3.2 violation is the multiplier on Rex's RT failure. Fix Section 1 first to remove the compounding before tuning the RT gate.

Thread 2 (Section 2) is mostly **independent architectural cleanup** that can land in the same track or a separate one. Doesn't gate the gameplay regression fixes.

### Recommended subsystem order if combined

1. Section 1 fix (doctrine 3.2 universal + skill-scaled penalty) → manual playtest.
2. Section 3 fix (RT gate weighted-score or threshold cap) → manual playtest.
3. Section 2 fix (binary flag generalization) → manual playtest.

Between #1 and #2: if Rex's score normalizes after #1 alone, #2 is optional. Worth checkpointing.

### Marcus design pass?

**Not required for any of these.** The fixes are scoring/decision-layer mechanics that change BOT BEHAVIOR but not user-facing visuals or copy. The "Last cards — place only" hint copy from the B1 fix is the only player-facing copy in recent work; no equivalent here. Marcus brief stays at "Adventure visual paint + character art" scope, deferred.

### Re-baseline assessment

After Section 1 fix: **strongly recommended.** Rex's behavior shifts substantially (stops donating faces) and his observed score should rise meaningfully against opponents.

After Section 3 fix: **recommended.** RT gate change rebalances capture-vs-place decisions across all bots.

After Section 2 fix: probably noise-level since flag consolidation is mostly architectural.

`docs/stat-card-rebaseline-postfoundation-2026-05-06.md` is the current live baseline. A re-baseline after the fix track should be drafted with the same protocol.

---

## Summary table

| Issue | Status | Root cause | Files | Fix scope |
| ----- | ------ | ---------- | ----- | --------- |
| **Thread 1: Doctrine 3.2 violation** | Open | `scorePlacement()` lacks intrinsic-value penalty; pair-danger is an indirect proxy that collapses to zero when source rank exhausted; 10/face placements have artificially low danger from sum-risk short-circuit | `evaluator.ts:372-475` | **MEDIUM** |
| **Thread 2: Binary flag legacy** | Architectural | 4 binary flags predating skill point system. `preferHighestNumberCardOnPlace` overlaps Thread 1 | `botDecision.ts:292, 323, 327, 399`; personality files | **SMALL-MEDIUM** depending on consolidation depth |
| **Thread 3: Rex 45/300 underperformance** | Open (compound) | RT gate (target × 0.08 = 24 raw-pt cutoff) demotes most captures → forced to place → Thread 1 violation steers placement toward face/10 → donates points to opponents | `botDecision.ts:372-393` + `evaluator.ts:372-475` | **SMALL** for RT gate; rest covered by Thread 1 fix |

**No code, types, or tests modified in this track.** Diagnosis only.
