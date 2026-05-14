# Canonical Bot Evaluator Rebuild — Impact

**Track:** `BUILD — Canonical Bot Evaluator Rebuild` — P1, architectural rebuild, May 14 2026.
**Spec (source of truth):** Notion `3602f266-2cac-8112-ae14-efefcba79f86` — "CANONICAL BOT EVALUATOR — Architecture Spec (May 14, 2026)".
**Ticket (execution):** Notion `3602f266-2cac-8129-91f4-d53530c05044` — "BUILD — Canonical Bot Evaluator Rebuild".
**Doctrine ref:** Notion `3562f2662cac8134b848d59ce9f08573` — sections 1.10 (Reactive Strategy), 3.2 (Placement Value Tier), 7.3 (Tier = Depth Not Breadth), 8.x (Behavioral Distinctness).
**Trigger:** May 6 bot architecture audit (`docs/bot-architecture-audit-2026-05-06.md`) — Rex 45/300 + Nina-placed-Ace compound failure traced to doctrine 3.2 violation in `scorePlacement` + RT gate using raw `captureDetails.totalPoints` instead of weighted `score.total`.
**Pre-track baseline:** 295 tests passing (post Q3 + Sibling 1/2/3 calibration track on May 6). `npm run build` clean.
**Status:** All four subsystems shipped. **321 of 321 tests passing** (+26 net). `tsc -b` clean. `npm run build` clean (408 KB / 126 KB gzip). Awaiting TC playtest sign-off + re-baseline measurement.

---

## Architectural commitment

> **No bot is a special case.**

Every bot is a configuration of skill values + weights running on the same canonical evaluator. Calvin, Nina, Rex, Jett — and future Mira, Talia, Master — are points on the same continuous curves. Differentiation lives in *where they sit on those curves*, not in special-case code paths.

This rebuild is the structural fix for the May 6 audit findings. The audit traced two compounding bugs: (a) `scorePlacement` did not enforce doctrine 3.2, so bots preferred placing 10/face cards because pair-danger for high-value cards was artificially low; (b) the RT gate compared raw `captureDetails.totalPoints` to its threshold, demoting captures the bot's own weighted evaluator would have promoted. The compound: RT gate demotes capture → bot is forced to place → doctrine 3.2 violation makes placement choose face/10 → Rex donates 10-15 points to opponents per occurrence. Nina-placed-Ace and Rex 45/300 were the visible symptoms.

Patching in place would have hidden the architectural debt. Spec authored May 14 in three-pass conversation with TC takes the harder path: retire binary feature flags (`allowMultiSlot`, `useChainEval`, `preferHighestNumberCardOnPlace`), wire Placement Intelligence (PI) as a first-class skill, split old SE into CC (Capture Complexity) + SE (Setup Engineering), and re-derive every bot's behavior from a unified 8-skill point system. The skill point system stops being a layer on top of the evaluator and *becomes* the evaluator.

The only surviving flag after the rebuild is `preferSumsOnTie` (Nina) — stylistic flavor, doctrine 7.3 sanctioned.

---

## Subsystem 1 — Schema migration + valueLossPenalty + PI sub-rules

**Status:** SHIPPED. 303 tests passing (+8 net new vs the 295 baseline). Build clean.

### Goals (per ticket)

1. Extend `PersonalityProfile` with `captureComplexity` and `placementIntelligence` (1-10).
2. Add `valueLossPenalty: number` dimension to `ActionScore`; subtract universally in `applyWeights`.
3. Wire PI sub-rules so PI ≤ 2 picks highest 2-9 (Calvin's tell, architectural not hardcoded); PI ≥ 3 keeps lowest-danger default; PI ≥ 6 / PI ≥ 9 reserved for later tiers.
4. Land doctrine 3.2 enforcement universally — fires for every bot, every placement.

### Schema changes (file-by-file)

| File | Change |
| --- | --- |
| `src/engine/ai/personalities/calvin.ts` | Added `captureComplexity` and `placementIntelligence` fields to the `PersonalityProfile` interface (with a comment block separating "legacy binary flags" from "canonical skill points"). Set Calvin `CC = 1`, `PI = 2`. |
| `src/engine/ai/personalities/nina.ts` | Set `CC = 5`, `PI = 4`. |
| `src/engine/ai/personalities/rex.ts` | Set `CC = 6`, `PI = 5`. |
| `src/engine/ai/personalities/jett.ts` | Set `CC = 8`, `PI = 9`. |
| `src/engine/ai/evaluator.ts` | Added `valueLossPenalty: number` field to `ActionScore`. Added module constant `VALUE_LOSS_FACTOR = 1.5`. Updated `applyWeights()` to subtract `valueLossPenalty` UNWEIGHTED (doctrine-locked floor). Updated `scoreCapture` to return `valueLossPenalty: 0`. Updated `scorePlacement` to compute `valueLossPenalty = isHighValue ? placedRawValue * VALUE_LOSS_FACTOR : 0`, where `isHighValue = placedIsFace \|\| handCard.rank === 'A' \|\| handCard.rank === '10'`. Added optional `_placementIntelligence` parameter to `scorePlacement` (threaded but unused in S1; reserved for PI ≥ 6 / ≥ 9). Added `placementIntelligence?: number` to `EvaluateOptions`. Threaded it through to the `scorePlacement` call inside `evaluateAllActions`. |
| `src/engine/ai/botDecision.ts` | Passed `profile.placementIntelligence` to `evaluateAllActions` options. Added a NEW PI ≤ 2 sub-rule block after the mistake roll, BEFORE the legacy `preferHighestNumberCardOnPlace` flag swap: when `chosen.action === 'place'` and `profile.placementIntelligence <= 2`, swap to highest-value 2-9 via `calvinNumberCardPick`. The legacy flag swap is RETAINED in S1 (S3 will remove it) — both blocks operate in parallel for Calvin and produce the same result. |
| `tests/engine/ai/evaluator.test.ts` | Updated `'zero-weight dimension contributes zero to total'` test (Ace placements now expect `-22.5` instead of `0` because of the unweighted doctrine 3.2 floor). Added 5 new tests covering valueLossPenalty math (see below). |
| `tests/engine/ai/botDecision.test.ts` | Added 3 new doctrine 3.2 behavioral tests (see below). |

`PersonalityProfile` is retained in its current home in `calvin.ts` rather than moved to `src/engine/types/index.ts`. Spec implies it could move; left as-is to avoid scope creep. Flagged in honest skips below.

### valueLossPenalty math

Universal rule. Fires for every bot, every placement, regardless of skill values. Subtracted UNWEIGHTED from `score.total` (doctrine 3.2 is non-negotiable; weighting it would let high-PH or high-OA bots overcome the floor in cases where they shouldn't).

```ts
// VALUE_LOSS_FACTOR = 1.5 (locked starting value; retune via playtest)
const placedRawValue = SCORE_VALUES[handCard.rank];
const isHighValue = placedIsFace || handCard.rank === 'A' || handCard.rank === '10';
const valueLossPenalty = isHighValue ? placedRawValue * VALUE_LOSS_FACTOR : 0;
```

| Placed card | Raw value | `valueLossPenalty` | Effective floor |
| --- | --- | --- | --- |
| Ace (A) | 15 | 22.5 | -22.5 |
| Face (J/Q/K) | 10 | 15 | -15 |
| 10 | 10 | 15 | -15 |
| 2-9 | 1 | 0 | 0 |

The unweighted subtraction acts as a hard floor. Most placements cannot overcome -22.5 / -15 from their other dimensions, so all bots architecturally defer face/Ace/10 in favor of 2-9 placements when both options exist.

### PI sub-rules — wiring status

| PI level | Sub-rule | Status in S1 | Owned by |
| --- | --- | --- | --- |
| PI ≤ 2 | Pick highest-value 2-9 after deferral | ACTIVE — wired in `botDecision.ts` via new pre-existing-flag block | Calvin's tell |
| PI ≥ 3 | Pick lowest-danger 2-9 (current default ranking) | ACTIVE — current default ranking is exactly this; no change needed | Nina, Rex, Jett |
| PI ≥ 6 | Add setup-value contribution to placement score | STUBBED — `_placementIntelligence` threaded into `scorePlacement` but unused; code comment notes "Reserved for future PI ≥ 6 / ≥ 9 sub-rules." | Rex (5, just under gate), Jett |
| PI ≥ 9 | Multi-turn placement strategy | STUBBED — same status | Jett (future tier) |

Honest-skip protocol (ticket section): PI ≥ 6 setup-value and PI ≥ 9 multi-turn are deferred per the spec's allowance ("if too complex for this track, stub it and flag in impact doc"). The threading is done so a future track can implement the sub-rules without touching `evaluateAllActions` again.

### Tests added (8 net new + 1 updated)

`tests/engine/ai/evaluator.test.ts`:

| # | Test | Asserts |
| --- | --- | --- |
| 1 (updated) | `zero-weight dimension contributes zero to total` (Ace case) | Ace placement total = `-22.5` (was `0` pre-fix — captures the doctrine 3.2 floor at the unit level). |
| 2 | Ace placement | `valueLossPenalty === 22.5` |
| 3 | Face cards (J / Q / K) | All three return `valueLossPenalty === 15` |
| 4 | 10 placement | `valueLossPenalty === 15` |
| 5 | 2-9 placements | All return `valueLossPenalty === 0` |
| 6 | Captures | `valueLossPenalty === 0` (captures never trigger the penalty) |

`tests/engine/ai/botDecision.test.ts`:

| # | Test | Asserts |
| --- | --- | --- |
| 7 | Nina with `[A, 5]` placement | Places the 5, not the Ace — confirms the original Nina-placed-Ace bug class is closed (mistake-roll-tolerant — re-rolled until the swept branch fires deterministically). |
| 8 | Rex placing from `[A, 5, K]` | Picks 5 over Ace and K — doctrine 3.2 lockout on both high-value options. |
| 9 | Jett placing from `[A, 4, 7, J]` with board `[5, 8]` | Picks a 2-9 (4 or 7). Board chosen specifically to avoid the place-chain × doctrine 3.2 conflict (see honest skips). |

### Honest skips called out

- **PI ≥ 6 setup-value contribution sub-rule:** STUBBED. The `_placementIntelligence` param to `scorePlacement` is threaded but unused. Code comment notes "Reserved for future PI ≥ 6 / ≥ 9 sub-rules." Implementation deferred per the spec's honest-skip protocol.
- **PI ≥ 9 multi-turn placement strategy:** STUBBED. Same status.
- **Place-To-Plant / Place-Chain × Doctrine 3.2 conflict:** discovered while writing the Jett test (#9 above). When SE ≥ 5, `evaluatePlaceChain` finds place-then-capture chains that can promote a face/Ace/10 placement above the doctrine 3.2 floor. The chain promotion logic bypasses `score.total` and forces an action to position 0 — sidestepping the `valueLossPenalty` floor. Test #9 was rewritten with a board that avoids triggering this interaction. Flagged for S3 resolution. Suggested resolution: gate `evaluatePlaceChain` consideration by checking if the planted card is doctrine-deferred, requiring `chainExpected > bestCaptureTotal * threshold + valueLossPenalty`.
- **`PersonalityProfile` type location:** stayed in `calvin.ts` (its current home) rather than moving to `src/engine/types/index.ts`. Spec implies it could move (ticket Subsystem 1 step 1 lists `src/engine/types/index.ts`); left as-is to avoid scope creep. Flag for follow-up if architectural cleanliness matters; functionally equivalent either way.

---

## Subsystem 2 — RT gate fix + `captureValueThreshold(rt)`

**Status:** Shipped.

### What landed

- `captureValueThreshold(rt)` added in `botDecision.ts` (co-located with `captureChainThreshold` and `setupChainThreshold` — the existing curve home). Exported for the test surface. Curve per spec section 5:

| RT band | Returns | Bot at this tier | Cutoff at target 300 |
| ------- | ------- | ---------------- | -------------------- |
| ≤ 1     | 0.02    | Calvin           | 6 pt                 |
| 2-3     | 0.05    | Nina             | 15 pt                |
| 4-5     | 0.08    | Rex              | 24 pt                |
| 6-7     | 0.10    | Jett             | 30 pt                |
| 8-9     | 0.12    | future tier      | 36 pt                |
| 10+     | 0.15    | future master    | 45 pt                |

- **`riskThreshold` field migrated from fractional → integer** on all four personality files alongside the function landing (Calvin 0.02 → 1, Nina 0.05 → 3, Rex 0.08 → 5, Jett 0.10 → 7). This was necessary in the same subsystem because `captureValueThreshold` expects integer 1-10 input; mismatched timing across S2/S4 would have broken the math. Other skill values (DA, OA, PA, PH, SE) waited for S4.
- **RT gate at `botDecision.ts` (formerly lines 372-393) rewired:**
  - Threshold: `targetScore * captureValueThreshold(profile.riskThreshold)` (was `targetScore * profile.riskThreshold` directly).
  - Demote check: `topAction.score.total < threshold` — the bot's own **weighted** score (was raw `topAction.captureDetails.totalPoints`, which ignored denial / jackpot / board-control bonuses).
  - Sibling check: `bestPlace.score.total > -threshold` (was `bestPlace.score.placementDanger > -threshold`). The S1 `valueLossPenalty` floor now makes this clause meaningful — a face/Ace/10 placement carries a fixed unweighted floor that pushes its `score.total` below `-threshold` for most RT levels.

### Tests added (8 in `tests/engine/ai/botDecision.test.ts`)

Added a `describe('captureValueThreshold')` block:
1. Returns 0.02 for RT 1 (Calvin tier).
2. Returns 0.05 for RT 2-3 (Nina tier).
3. Returns 0.08 for RT 4-5 (Rex tier).
4. Returns 0.10 for RT 6-7 (Jett tier).
5. Returns 0.12 for RT 8-9 (future tier).
6. Returns 0.15 for RT 10+ (future master).
7. Curve is monotonically non-decreasing across RT 0..10.
8. Roster RT values resolve to the percentages we shipped pre-rebuild — guard against future personality drift.

Test count after S2: 311 of 311 passing (was 303 after S1; +8 new). `tsc -b` clean.

### Doctrine 1.10 alignment

The pre-rebuild gate was doctrine-naive: it demoted a denial-mode capture even when the bot's weighted total said "take this." Doctrine 1.10 (Reactive Strategy) is the principle that the bot should react to game state through its own weighted preferences. The weighted-score gate finally honors that — captures with denial bonus / jackpot proximity bonus / board-control bonus that lift them above `targetScore * RT%` survive the gate and are taken. This is the structural half of the Rex 45/300 fix (the other half is doctrine 3.2 from S1).

---

## Subsystem 3 — Binary flag retirement (CC/SE consolidation)

**Status:** Shipped.

### What landed

**Gate functions** (`evaluator.ts`, both exported):
- `canEvaluateMultiSlot(cc: number): boolean { return cc >= 3; }`
- `canEvaluateChainCapture(cc: number): boolean { return cc >= 6; }`

**Binary flags retired from `PersonalityProfile`** (`calvin.ts`):
- ❌ `allowMultiSlot: boolean` — removed.
- ❌ `useChainEval: boolean` — removed.
- ❌ `preferHighestNumberCardOnPlace: boolean` — removed.
- ✅ `preferSumsOnTie: boolean` — kept (Nina's flavor, only surviving binary per spec 7.3).

**Consumer call-site changes** (`botDecision.ts`):
- `profile.allowMultiSlot` → `canEvaluateMultiSlot(profile.captureComplexity)` at `evaluateAllActions` call.
- `profile.useChainEval` → `canEvaluateChainCapture(profile.captureComplexity)` at chain-eval branch.
- Legacy `preferHighestNumberCardOnPlace` post-decision swap block (the parallel-run from S1) removed. The new PI ≤ 2 sub-rule is now the only path.
- `profile.preferHighestNumberCardOnPlace` check in the dump-active path replaced with `profile.placementIntelligence <= 2`.
- `calvinNumberCardPick` helper deleted from `evaluator.ts`; logic relocated as a private `highestNumberCard` helper inside `botDecision.ts` (canonical name; same logic).

**`captureChainThreshold` migrated SE-keyed → CC-keyed** (same curve from the Q3 fix, just keyed on the right skill):

| CC band | Returns | Bot at this tier |
| ------- | ------- | ---------------- |
| ≤ 5     | 1.40    | not reached — chain eval gate is CC ≥ 6 |
| 6-7     | 1.30    | Rex (CC 6)       |
| 8       | 1.20    | Jett (CC 8)      |
| ≥ 9     | 1.15    | future top       |

**`OpponentInfo` updated** (`evaluator.ts`):
- ❌ `preferHighestNumberCardOnPlace: boolean` — removed.
- ❌ `allowMultiSlot: boolean` — removed.
- ✅ `placementIntelligence: number | undefined` — added (`undefined` for human player; bots get their PI value).
- ✅ `captureComplexity: number` — added (replaces `allowMultiSlot` for opponent modeling).

**`scorePlacement` opponent-detection paths updated** at `evaluator.ts:~401` (face-plant survival bonus) and `~436` (pair-danger reduction): both now check `nextOpponent.placementIntelligence !== undefined && nextOpponent.placementIntelligence <= 2`. Same Calvin-tier-aware semantic, canonical-skill expression.

**Place-Chain × doctrine 3.2 conflict closed.** In S1 the Jett behavioral test had to dodge a board state that triggered `evaluatePlaceChain` promoting an Ace placement (chain logic bypassed the `valueLossPenalty` floor). S3 added a doctrine-3.2-aware gate in the place-chain promotion check:
```ts
const valueLossFloor =
  plantedRank === 'A' ? 22.5
  : (plantedRank === '10' || isFace) ? 15
  : 0;
const required = bestCaptureTotal * setupChainThreshold(profile.setupEngineering) + valueLossFloor;
if (chainExpected > required || (bestCaptureTotal === 0 && chainExpected > valueLossFloor)) { promote }
```
Now place-chains using face / Ace / 10 plants must clear the doctrine 3.2 floor on top of the existing setup-chain threshold. 2-9 plants are unaffected.

**SE gates for setup-side features UNCHANGED:** Place-To-Plant `SE ≥ 3`, Multi-Turn Engineering `SE ≥ 5`, Jackpot Trap `SE ≥ 7`. After S4's PASS 3A values: Rex SE 6 falls below the Jackpot Trap gate (was at SE 7 pre-rebuild) — Jackpot Trap becomes Jett-only. Intentional Expert-tier differentiator per spec.

### Tests added (4 in `tests/engine/ai/botDecision.test.ts`)

`describe('CC (Capture Complexity) gates')`:
1. `canEvaluateMultiSlot` true only at CC ≥ 3 — sweeps CC 1, 2, 3, 5, 8.
2. `canEvaluateChainCapture` true only at CC ≥ 6 — sweeps CC 1, 5, 6, 8.
3. Roster CC values produce the expected gate matrix (Calvin none, Nina multi-slot-only, Rex+Jett both).

`describe('Place-Chain respects doctrine 3.2 floor (S3 fix)')`:
4. Jett does NOT place the Ace from `[A, 4, 7, J]` on board `[5, 6]` — the exact regression scenario S1 had to dodge. Sweeps 10 seeds; placed-Ace count must be 0.

Plus updated the existing `'Rex and Jett receive distinct thresholds'` test to read CC (was reading SE) — captures the SE→CC migration in test surface too.

Test count after S3: 315 of 315 passing (was 311 after S2; +4 new + 1 updated). `tsc -b` clean.

---

## Subsystem 4 — Personality config migration to PASS 3A

**Status:** Shipped.

### What landed

All four personality files migrated to PASS 3A locked skill values per spec section 4. Weights and `mistakeRate` UNCHANGED across all four bots — only skill values shift (plus the `captureComplexity` / `placementIntelligence` fields added in S1, retired flags removed in S3).

| Bot    | RT | DA | OA | PA | PH | CC | SE | PI | Total | mistakeRate | Surviving flags |
| ------ | -- | -- | -- | -- | -- | -- | -- | -- | ----- | ----------- | --------------- |
| Calvin | 1  | 1  | 1  | 2  | 1  | 1  | 1  | 2  | 10    | 0.25        | none            |
| Nina   | 3  | 4  | 3  | 4  | 4  | 5  | 3  | 4  | 30    | 0.08        | `preferSumsOnTie: true` |
| Rex    | 5  | 6  | 6  | 7  | 7  | 6  | 6  | 5  | 48    | 0.02        | none            |
| Jett   | 7  | 8  | 8  | 8  | 6  | 8  | 8  | 9  | 61    | 0.005       | none            |

### Identity preservation per spec section 4

- **Calvin (10/80)** — PI 2 at floor is his identity. Everything else uniformly low. Recognizable tell, not strong at anything.
- **Nina (30/80)** — CC 5 > SE 3 asymmetry. She sees combos (multi-slot at CC ≥ 3) but doesn't engineer multi-turn plays (SE < 5, so no `evaluatePlaceChain`). Reactive intermediate.
- **Rex (48/80)** — PA 7 + PH 7 over PI 5. Reads the situation (position + pressure) better than he picks individual cards. Hunter, not craftsman.
- **Jett (61/80)** — DA 8 + OA 8 + PI 9 over PH 6. The "stalker" identity — doesn't need pressure-mode shifts because he's already optimal through observation. PH=6 below his other top-tier skills is intentional.

### Behavioral gates triggered by the new values

| Gate                          | Threshold | Calvin | Nina | Rex  | Jett |
| ----------------------------- | --------- | ------ | ---- | ---- | ---- |
| Multi-slot capture            | CC ≥ 3    | ❌     | ✅   | ✅   | ✅   |
| Chain capture eval            | CC ≥ 6    | ❌     | ❌   | ✅   | ✅   |
| Place-To-Plant face setup     | SE ≥ 3    | ❌     | ✅   | ✅   | ✅   |
| Multi-Turn Engineering (`evaluatePlaceChain`) | SE ≥ 5 | ❌ | ❌ | ✅ | ✅ |
| Jackpot Trap detection        | SE ≥ 7    | ❌     | ❌   | ❌   | ✅   |
| Position Awareness Layer 3    | PA ≥ 7    | ❌     | ❌   | ✅   | ✅   |
| Position Awareness Hand-3-Fork| PA ≥ 6    | ❌     | ❌   | ✅   | ✅   |
| Pressure handling (round arc) | PH ≥ 4    | ❌     | ✅   | ✅   | ✅   |
| Pressure handling (jackpot)   | PH ≥ 5    | ❌     | ❌   | ✅   | ✅   |
| Pressure handling (target)    | PH ≥ 6    | ❌     | ❌   | ✅   | ✅   |
| Opponent awareness (modeling) | OA ≥ 4    | ❌     | ❌   | ✅   | ✅   |

Notable losses vs pre-rebuild: Nina drops Hand-3-Fork (PA 6→4) + jackpot-proximity pressure (PH 6→4) + opponent modeling (OA 4→3). Rex loses Jackpot Trap (SE 7→6). Jett unchanged on every gate (no losses); gains Jackpot Trap uniqueness.

### Tests added (6 roster-lock tests in `tests/engine/ai/botDecision.test.ts`)

`describe('PASS 3A roster lock')`:
1. Calvin profile matches PASS 3A (asserts every skill value individually).
2. Nina profile matches PASS 3A + `preferSumsOnTie: true` survives.
3. Rex profile matches PASS 3A (notes SE < 7 means no Jackpot Trap).
4. Jett profile matches PASS 3A with PH < PI asymmetry preserved.
5. Only `preferSumsOnTie` survives as a binary flag (Nina only — all other bots false).
6. `mistakeRate` unchanged across migration (0.25 / 0.08 / 0.02 / 0.005).

Test count after S4: **321 of 321 passing** (was 315 after S3; +6 new). `tsc -b` clean. `npm run build` clean (408 KB / 126 KB gzip).

### RT field migration audit (resolved)

The agent-draft note flagged a concern that `riskThreshold` might still be treated as fractional outside `captureValueThreshold`. **Resolved**: S2 migrated `riskThreshold` on all four personality files to integer scale at the same time as the function landed (Calvin 0.02 → 1, Nina 0.05 → 3, Rex 0.08 → 5, Jett 0.10 → 7). Only consumer is the RT gate in `botDecision.ts`, which now routes through `captureValueThreshold(rt)`. No fractional-RT references remain in code.

---

## Behavior shift summary

Per spec section 6 "BEHAVIOR SHIFT NOTES". Listed honestly so playtest expectations are calibrated.

| Bot | Externally observable shift | Architectural shift |
| --- | --- | --- |
| Calvin | **Unchanged.** Same tell, same identity. External observers won't see a difference. | Tell now produced by `valueLossPenalty` + PI ≤ 2 sub-rule, not by the hardcoded `preferHighestNumberCardOnPlace` flag. |
| Nina | **Noticeably less sophisticated.** Stat-card scoring drops 42 → 30 / 80. Should feel like a "real intermediate," not an intermediate pushing advanced. **Stops placing Aces when she has a 5** — the original audit bug, closed at the architectural level in S1. | No chain evaluation (was already her config). CC over SE asymmetry preserved as identity. |
| Rex | **Doctrine 3.2 enforced — stops donating face cards and 10s.** This is the big fix; the expected resolution path for the 45/300 underperformance. **RT gate (S2) respects denial / jackpot / board-control bonuses** — captures with strategic value clear the gate even at low raw points. **Loses Jackpot Trap** — drops from old SE 7 → new SE 6, below the `SE ≥ 7` gate. Stat-card scoring 54 → 48 / 80, but actual gameplay should be MORE competitive because the doctrine 3.2 + RT gate fixes are huge. | Retains Place-To-Plant + Multi-Turn Engineering. Jackpot Trap becomes Jett-only with the current roster. |
| Jett | **Slight gain.** Stat card 60 → 61 / 80. **Now uniquely owns Jackpot Trap detection** — Expert-tier differentiator. **PI 9 unlocks multi-turn placement strategy** (stubbed in S1; future-tier gate Jett now reaches). | PH 6 < other top-tier skills is intentional; discipline replaces reactivity. |

---

## TC manual playtest checklist (post-merge)

Per spec section 8 acceptance criteria. Run `npm run dev` against `http://localhost:8090`; wipe `localStorage` first.

- [ ] **Calvin's tell preserved.** Calvin still places his highest 2-9 across multiple turns. External behavior identical to pre-rebuild despite architectural retiring of `preferHighestNumberCardOnPlace`.
- [ ] **Nina respects doctrine 3.2.** Construct a hand with `[A, 5, K]` (or similar) on Nina's turn — she places the 5, never the Ace or the K.
- [ ] **Rex stops donating faces and 10s.** Play 5-10 hands at target 300 with Rex + Nina + TC. Rex's per-hand donation rate (placements of 10/J/Q/K/A when 2-9 alternatives exist) should drop to near zero.
- [ ] **Rex RT gate respects weighted bonuses.** Watch the AI debug log for a Rex capture in late deck phase with denial-mode active — capture should clear the gate even if raw points alone wouldn't have.
- [ ] **Jett gets Jackpot Trap.** In late hands with jackpot proximity, watch for the Jackpot Trap reasoning string in Jett's debug log. Rex (SE 6) should NOT show it.
- [ ] **Calvin / Nina unchanged on chain eval.** No chain-eval branches fire for either (CC 1 and CC 5 respectively, both below the `CC ≥ 6` gate).
- [ ] **All 4 bots show distinct stat-card profiles.** Spread on 80 = Calvin 10, Nina 30, Rex 48, Jett 61.

---

## Re-baseline flag

**A full stat-card re-baseline is STRONGLY RECOMMENDED after the rebuild merges.**

Skill values shift, behavior shifts, observed scores will shift — most notably Rex's likely jump from 45/300 toward parity with TC/Nina once he stops bleeding face cards. The current baseline at `docs/stat-card-rebaseline-postfoundation-2026-05-06.md` becomes obsolete on merge.

Planned protocol: same audit-quality measurement as the May 6 re-baseline (bot-vs-bot sims at target 300, multiple seeds, per-bot averages locked in). Target doc: `docs/stat-card-rebaseline-canonical-2026-05-XX.md`.

Adventure mode revalidation also recommended — the 12 Adventure levels are tuned to current bot behaviors; Rex stopping the donation bleed likely makes some levels feel slightly easier for the player. Worth a full playthrough check post-merge.

---

## Honest skips and known limitations

Consolidated from across the track.

| Item | Origin | Status | Resolution path |
| --- | --- | --- | --- |
| PI ≥ 6 setup-value contribution to placement scoring | S1 — spec section 5 PI sub-rules | STUBBED. `_placementIntelligence` threaded into `scorePlacement` but unused; comment marks it reserved. | Future track. Adds a setup-value term to placement score for bots with PI ≥ 6 (Rex's PI 5 still misses the gate by 1 — intentional). |
| PI ≥ 9 multi-turn placement strategy | S1 — spec section 5 PI sub-rules | STUBBED. | Future track. Jett-only with current roster. |
| Place-Chain × Doctrine 3.2 conflict | S1 — surfaced during Jett `[A, 4, 7, J]` test construction | **CLOSED in S3.** `evaluatePlaceChain` promotion now requires `chainExpected > bestCaptureTotal * threshold + valueLossFloor` so doctrine-deferred plants can't bypass the floor. S3 added a regression test using the exact `[5, 6]` board that S1 had to dodge. | Resolved. |
| `PersonalityProfile` type location | S1 | Stayed in `calvin.ts` rather than moving to `src/engine/types/index.ts` per spec implication. | Follow-up if architectural cleanliness matters; functionally equivalent. |
| Stat-card re-baseline | Whole track | Pending post-merge TC task, not part of this track. | TC schedules; new baseline doc at `docs/stat-card-rebaseline-canonical-2026-05-XX.md`. |

---

## Files touched matrix

| File | S1 | S2 | S3 | S4 | Summary |
| --- | -- | -- | -- | -- | ------- |
| `src/engine/ai/personalities/calvin.ts` | ✅ | ✅ | ✅ | ✅ | S1: added CC+PI fields to `PersonalityProfile` (kept legacy flags). S2: RT 0.02 → 1. S3: removed `allowMultiSlot`/`useChainEval`/`preferHighestNumberCardOnPlace` from interface + Calvin's object. S4: DA 2 → 1 (PASS 3A). |
| `src/engine/ai/personalities/nina.ts` | ✅ | ✅ | ✅ | ✅ | S1: CC=5, PI=4. S2: RT 0.05 → 3. S3: dropped retired flags; kept `preferSumsOnTie: true`. S4: DA 5 → 4, OA 4 → 3, PA 6 → 4, PH 6 → 4, SE 4 → 3. |
| `src/engine/ai/personalities/rex.ts` | ✅ | ✅ | ✅ | ✅ | S1: CC=6, PI=5. S2: RT 0.08 → 5. S3: dropped retired flags. S4: DA 7 → 6, OA 7 → 6, PA 8 → 7, PH 9 → 7, SE 7 → 6 (loses Jackpot Trap). |
| `src/engine/ai/personalities/jett.ts` | ✅ | ✅ | ✅ | ✅ | S1: CC=8, PI=9. S2: RT 0.10 → 7. S3: dropped retired flags. S4: PA 9 → 8, PH 9 → 6 (stalker discipline). |
| `src/engine/ai/evaluator.ts` | ✅ |   | ✅ |   | S1: `valueLossPenalty` dimension on `ActionScore`; `VALUE_LOSS_FACTOR = 1.5` const; `applyWeights` subtracts unweighted; `scoreCapture` returns 0; `scorePlacement` computes penalty + accepts threaded `_placementIntelligence`; `EvaluateOptions` gains `placementIntelligence?`. S3: added `canEvaluateMultiSlot(cc)` + `canEvaluateChainCapture(cc)` exports; `OpponentInfo` migrated to `placementIntelligence` + `captureComplexity` (dropped `preferHighestNumberCardOnPlace` + `allowMultiSlot`); scorePlacement's two opponent-detection paths updated to check PI ≤ 2; deleted `calvinNumberCardPick` helper (moved to botDecision). |
| `src/engine/ai/botDecision.ts` | ✅ | ✅ | ✅ |   | S1: threaded `placementIntelligence` to `evaluateAllActions`; added PI ≤ 2 sub-rule block. S2: `captureValueThreshold(rt)` function added + exported; RT gate rewritten on weighted `score.total`. S3: imports `canEvaluateMultiSlot`/`canEvaluateChainCapture`; private `highestNumberCard` helper (replaces deleted `calvinNumberCardPick`); replaced `profile.allowMultiSlot` and `profile.useChainEval` checks with CC gate calls; replaced dump-path `preferHighestNumberCardOnPlace` check with `profile.placementIntelligence <= 2`; deleted legacy flag swap block; `captureChainThreshold` keyed on `profile.captureComplexity`; place-chain promotion gate now requires chainExpected to clear `valueLossFloor` for face/Ace/10 plants; `opponentInfoFor` builds new `OpponentInfo` shape. |
| `src/game/useGameController.ts` |   |   | ✅ |   | S3: replaced `profile.allowMultiSlot` debug-log call with `profile.captureComplexity >= 3` (only consumer outside the canonical pipeline). |
| `tests/engine/ai/evaluator.test.ts` | ✅ |   |   |   | S1: updated zero-weight test (Ace case `-22.5`); +5 valueLossPenalty math tests. |
| `tests/engine/ai/botDecision.test.ts` | ✅ | ✅ | ✅ | ✅ | S1: +3 doctrine 3.2 behavioral tests. S2: +8 `captureValueThreshold` tests. S3: +4 CC-gate + place-chain regression tests; updated `captureChainThreshold` roster test to read CC. S4: +6 PASS 3A roster-lock tests. |

---

*Authored against the canonical bot evaluator spec locked May 14, 2026 (Notion `3602f266-2cac-8112-ae14-efefcba79f86`) and the execution ticket (`3602f266-2cac-8129-91f4-d53530c05044`). Four subsystems shipped with TC checkpoint sign-off between each. After this lands: TC plays the post-merge checklist, schedules the re-baseline measurement, commits + pushes.*
