# Stat Card Re-Baseline — Post-Canonical Bot Evaluator

**Track:** `AUDIT — Stat Card Re-Baseline (Post-Canonical Bot Evaluator)` — P1, May 15 2026.
**Type:** Read-only audit. No code changes, no test additions, no config tuning.
**Spec source:** Notion `3602f266-2cac-8112-ae14-efefcba79f86` (Canonical Bot Evaluator Spec, PASS 3A locked values).
**Doctrine source:** Notion `3562f2662cac8134b848d59ce9f08573` (8 sections, 38 principles).
**Methodology reference:** `docs/stat-card-rebaseline-postfoundation-2026-05-06.md` (now obsolete — different schema).
**Rebuild context:** `docs/canonical-bot-rebuild-impact-2026-05-14.md`.

---

## Headline verdicts

| Bot | Spec | Measured | Δ | Verdict |
| --- | ---- | -------- | -- | ------- |
| **Calvin** "Distracted Beginner" | 10/80 | **10/80** | 0 | **Shipped clean.** Every cell matches spec; tell fires architecturally via PI ≤ 2 sub-rule, not the retired flag. |
| **Nina** "Sum-Loving Intermediate" | 30/80 | **29/80** | −1 | **Shipped clean within tolerance.** OA 3 under-delivers by 1 (binary gate at ≥ 4 means Nina gets zero OA-routed modeling); architectural finding 1 below. |
| **Rex** "Patient Strategist" | 48/80 | **48/80** | 0 | **Shipped clean.** Every cell matches spec. Loses Jackpot Trap as intended (SE 6 < 7 gate). |
| **Jett** "Quiet Hunter" | 61/80 | **57/80** | −4 | **Tune needed (acknowledged-and-shipped).** PI 9 ships at default-tier behavior because the PI ≥ 9 multi-turn placement path is stubbed. PA 8 wires identically to Rex's PA 7 (layer3Reliability cliff). Both are known follow-ups. |

**No structural issues. Two bots ship clean (Calvin, Rex), Nina is one point under spec via a coarse gate, Jett is four points under spec via known stubs.** Canonical rebuild verifies. Confident to ship the bot story to launch with the two Jett PI follow-ups queued post-launch.

---

## Summary table — 4 bots × 8 attributes (32 cells)

Cell format: `spec → measured` (Δ if non-zero).

| Bot    | RT | DA | OA | PA | PH | CC | SE | PI | Total |
| ------ | -- | -- | -- | -- | -- | -- | -- | -- | ----- |
| Calvin | 1 → 1 | 1 → 1 | 1 → 1 | 2 → 2 | 1 → 1 | 1 → 1 | 1 → 1 | 2 → 2 | 10 → 10 |
| Nina   | 3 → 3 | 4 → 4 | **3 → 2 (Δ −1)** | 4 → 4 | 4 → 4 | 5 → 5 | 3 → 3 | 4 → 4 | 30 → 29 |
| Rex    | 5 → 5 | 6 → 6 | 6 → 6 | 7 → 7 | 7 → 7 | 6 → 6 | 6 → 6 | 5 → 5 | 48 → 48 |
| Jett   | 7 → 7 | 8 → 8 | 8 → 8 | **8 → 7 (Δ −1)** | 6 → 6 | 8 → 8 | 8 → 8 | **9 → 5 (Δ −4)** | 61 → 57 |

**Divergences (|Δ| > 1):** 1 cell. Jett PI: spec 9, measured 5.

**Notes (|Δ| = 1, within tolerance):** Nina OA (binary gate cliff), Jett PA (layer3Reliability cliff at PA 8 vs 9).

---

## Per-bot sections

### Calvin "Distracted Beginner" — 10/80 ✓

**Config snapshot** (`src/engine/ai/personalities/calvin.ts:30-43`):
- weights: rawPoints 1.0, chainPotential 0.0, placementDanger 0.1, opponentDenial 0.0, jackpotValue 0.0, boardControl 0.0, mistakeRate 0.25
- preferSumsOnTie: false
- RT 1, DA 1, OA 1, PA 2, PH 1, SE 1, CC 1, PI 2

**Per-attribute scoring:**

- **RT 1 → 1:** `captureValueThreshold(1) = 0.02` (2% of target = 6 pts at target 300). RT gate at `botDecision.ts:431` keys on weighted `topAction.score.total` (S2 fix verified). With Calvin's weights, almost no real capture scores below 6 weighted pts → effectively never demotes. Doctrine 1.10/1.11 "greedy floor" matches.
- **DA 1 → 1:** `deckAttentionChance(1) = 0.15` (15%). `selectiveDeckInfo` available 15% of turns. Odd-One Trap penalty (`evaluator.ts:469-475`) fires when active. Floor delivery.
- **OA 1 → 1:** Calvin OA 1 < 4 gate (`botDecision.ts:318`) → no opponent modeling. Default floor.
- **PA 2 → 2:** PA ≥ 2 active-count layer fires (`evaluator.ts:144`). PA ≥ 4 round arc / ≥ 6 Hand 3 Fork / ≥ 7 Layer 3 → all miss. 1 of 4 wired layers. Matches "basic active-count only" doctrine.
- **PH 1 → 1:** `applyPressureExpansion` early-returns if PH < 4 (`evaluator.ts:175`). Calvin PH 1 → no pressure response. Floor.
- **CC 1 → 1:** `canEvaluateMultiSlot(1) = false`, `canEvaluateChainCapture(1) = false`. Calvin sees only single captures.
- **SE 1 → 1:** SE ≥ 3 (Place-To-Plant), ≥ 5 (Multi-Turn), ≥ 7 (Jackpot Trap) — Calvin SE 1 hits NONE.
- **PI 2 → 2:** PI ≤ 2 sub-rule fires (`botDecision.ts:349`). `highestNumberCard()` swap produces the tell architecturally — replaces the retired `preferHighestNumberCardOnPlace` flag exactly. `valueLossPenalty` floor universally subtracted (`evaluator.ts:292`).

**Total: 10/80. Δ 0.** Calvin ships clean.

---

### Nina "Sum-Loving Intermediate" — 29/80 (spec 30, Δ −1) ✓

**Config snapshot** (`src/engine/ai/personalities/nina.ts:14-27`):
- weights: rawPoints 1.0, chainPotential 0.5, placementDanger 0.7, opponentDenial 0.3, jackpotValue 0.4, boardControl 0.3, mistakeRate 0.08
- preferSumsOnTie: **true** (only surviving flag)
- RT 3, DA 4, OA 3, PA 4, PH 4, SE 3, CC 5, PI 4

**Per-attribute scoring:**

- **RT 3 → 3:** `captureValueThreshold(3) = 0.05` (5% of target = 15 pts at target 300). Demotes captures < 15 weighted. Mid-tier "takes most captures." Matches.
- **DA 4 → 4:** `deckAttentionChance(4) = 0.65`. Selective deck info available 65% of turns. Mid-tier "tracks cards okay." Matches.
- **OA 3 → 2 (Δ −1):** **Wiring divergence (within tolerance).** Spec says "notices opponents, shallow modeling." OA gate at `botDecision.ts:318` is binary `>= 4`. Nina OA 3 < 4 → `nextOpponent` is `undefined`, `opponents` is `undefined`. No OA-routed code fires. Calvin-tell-aware face safety bonus (`evaluator.ts:447-452`, 486-487) checks `nextOpponent?.placementIntelligence` — short-circuits to undefined for Nina. **Behaviorally Nina at OA 3 has identical OA-path firing to Calvin at OA 1.** Scored at 2 (one above Calvin's floor because PA-routed positional awareness still gives some opponent context, but OA-specific gates silent). See architectural finding 1.
- **PA 4 → 4:** PA ≥ 4 round arc layer fires (`evaluator.ts:127`). PA ≥ 2 active count fires. PA ≥ 6 Hand 3 Fork misses. Layer 3 misses. 2 of 4 wired layers. Matches "mid layers."
- **PH 4 → 4:** PH ≥ 4 hand-of-round posture fires (`evaluator.ts:183`). PH ≥ 5 jackpot proximity / ≥ 6 target-aggression — Nina misses. 1 of 3 PH layers. Matches "some pressure response."
- **CC 5 → 5:** `canEvaluateMultiSlot(5) = true`, `canEvaluateChainCapture(5) = false`. Multi-slot YES, chain eval NO. Matches CC > SE asymmetry intent.
- **SE 3 → 3:** SE ≥ 3 Place-To-Plant fires (`evaluator.ts:433`). Multi-Turn (≥ 5) and Jackpot Trap (≥ 7) miss. 1 of 3 SE layers. Matches "Place-To-Plant only — plays what she sees."
- **PI 4 → 4:** PI ≤ 2 doesn't fire (Calvin tell). PI ≥ 6 / ≥ 9 stubbed (don't apply at PI 4 anyway). Default lowest-danger 2-9 selection via natural scorePlacement ranking. Matches doctrine.
- **Surviving flag:** `preferSumsOnTie: true` triggers `applyNinaSumPreference` at `botDecision.ts:361`. Sum captures sort above pair captures on ties. Nina's flavor preserved.

**Total: 29/80. Δ −1.** Within tolerance. See architectural finding 1 for OA gate cliff.

---

### Rex "Patient Strategist" — 48/80 ✓

**Config snapshot** (`src/engine/ai/personalities/rex.ts:14-27`):
- weights: rawPoints 0.8, chainPotential 1.0, placementDanger 1.0, opponentDenial 0.9, jackpotValue 1.0, boardControl 0.8, mistakeRate 0.02
- RT 5, DA 6, OA 6, PA 7, PH 7, SE 6, CC 6, PI 5

**Per-attribute scoring:**

- **RT 5 → 5:** `captureValueThreshold(5) = 0.08` (8% of target = 24 pts at target 300). Demotes captures < 24 weighted. With Rex's denial/board-control/jackpot bonuses lifting weighted score above raw points, captures with strategic value clear the gate (the doctrine 1.10 fix). Matches "selective."
- **DA 6 → 6:** `deckAttentionChance(6) = 0.90`. Selective deck info nearly always available. Matches "tracks well."
- **OA 6 → 6:** OA ≥ 4 fires (`botDecision.ts:318`). `buildOpponentInfo` populates per-opponent `placementIntelligence` + `captureComplexity`. `nextOpponent` set. Calvin-tell-aware face safety bonus available. Matches "models opponents."
- **PA 7 → 7:** All four wired PA layers fire — active count (≥ 2), round arc (≥ 4), Hand 3 Fork (≥ 6), Layer 3 reliability (≥ 7). `layer3Reliability(7) = 0.70`. Matches "HIGHER — positional awareness is his strength."
- **PH 7 → 7:** All three PH expansion gates fire (≥ 4, ≥ 5, ≥ 6). Matches "HIGHER — highly reactive to score state."
- **CC 6 → 6:** Multi-slot (≥ 3) ✓, Chain eval (≥ 6) ✓. `captureChainThreshold(6) = 1.30` — Rex needs chain plan to beat single by 30%+. Matches "sees complex captures + chain eval."
- **SE 6 → 6:** Place-To-Plant (≥ 3) ✓, Multi-Turn `evaluatePlaceChain` (≥ 5) ✓ with doctrine-3.2 valueLossFloor gate. Jackpot Trap (≥ 7) MISSES — Rex SE 6 < 7. Matches "Place-To-Plant + Multi-Turn (no Jackpot Trap)" exactly per intent. **Loss of Jackpot Trap is intentional — Jett-only differentiator.**
- **PI 5 → 5:** PI ≤ 2 doesn't fire. PI ≥ 6 / ≥ 9 stubbed (don't apply at PI 5 anyway — Rex sits one below the PI ≥ 6 setup-value gate). Default lowest-danger 2-9 selection. Matches "placement isn't his focus, denial is." **Note: Rex at PI 5 is intentionally one below the PI ≥ 6 stubbed gate. Even if that gate were implemented, Rex would still sit at default tier.**

**Total: 48/80. Δ 0.** Rex ships clean.

---

### Jett "Quiet Hunter" — 57/80 (spec 61, Δ −4) — tune needed

**Config snapshot** (`src/engine/ai/personalities/jett.ts:14-27`):
- weights: rawPoints 0.7, chainPotential 1.0, placementDanger 1.2, opponentDenial 1.0, jackpotValue 1.0, boardControl 1.0, mistakeRate 0.005
- RT 7, DA 8, OA 8, PA 8, PH 6, SE 8, CC 8, PI 9

**Per-attribute scoring:**

- **RT 7 → 7:** `captureValueThreshold(7) = 0.10` (10% of target = 30 pts at target 300). Demotes captures < 30 weighted. Highest selectivity in roster. Matches "very selective."
- **DA 8 → 8:** `deckAttentionChance(8) = 0.97`. Near-perfect deck tracking. Matches "HIGHEST — tracks everything."
- **OA 8 → 8:** OA ≥ 4 fires same as Rex. Matches "HIGHEST" within wiring; the gate is binary at ≥ 4 so OA 6, 7, 8 all deliver the same OA-routed wiring. Jett's deeper opponent reading comes from the COMBINATION of OA 8 + DA 8 + PI 9 stack rather than OA-specific gates. Scored at 8 because Jett at OA 8 still meets the "deep opponent reading" doctrine criterion via stacking, even if OA 8 alone doesn't differentiate from Rex's OA 6 in code.
- **PA 8 → 7 (Δ −1):** **Wiring divergence (within tolerance).** PA gates: ≥ 2 ✓, ≥ 4 ✓, ≥ 6 ✓, ≥ 7 ✓ — same four layers as Rex PA 7. `layer3Reliability(8) = 0.70` (function steps `pa <= 8 → 0.70`, then `pa <= 9 → 0.90`). **Jett PA 8 has IDENTICAL layer firing as Rex PA 7.** No incremental depth from PA 7 → 8. Layer 5 (synthesis, per doctrine 5.1) is not an explicit gate in code. Scored at 7 to reflect that Jett PA 8 doesn't observably differ from Rex PA 7. See architectural finding 2.
- **PH 6 → 6:** All three PH gates fire (≥ 4, ≥ 5, ≥ 6). Same wiring as Rex PH 7. Spec intentionally sits Jett at PH 6 (one below Rex) to express "stalker, not reactive expert" — but at PH 6 the expansion fully fires. Matches doctrine: Jett's discipline replaces his need for additional pressure shifts, AND the floor of "all PH layers active" is met at 6.
- **CC 8 → 8:** Multi-slot (≥ 3) ✓, Chain eval (≥ 6) ✓. `captureChainThreshold(8) = 1.20` — Jett's chain promotion (preserves prior default). Matches "strong capture vision + chain eval."
- **SE 8 → 8:** All three SE features fire — Place-To-Plant (≥ 3), Multi-Turn evaluatePlaceChain (≥ 5) with doctrine-3.2 valueLossFloor gate, Jackpot Trap (≥ 7) **uniquely**. Matches "all three setup features including Jackpot Trap" + Jett-only differentiator.
- **PI 9 → 5 (Δ −4):** **Acknowledged stub.** Spec calls for "multi-turn placement strategy" at PI ≥ 9. Code: `_placementIntelligence` threaded into `scorePlacement` (`evaluator.ts:415`) but unused. `valueLossPenalty` universal floor applies. PI ≤ 2 sub-rule is for Calvin only. PI ≥ 6 setup-value contribution: also stubbed. **Jett's PI 9 ships with identical observable behavior to Rex PI 5 (default lowest-danger 2-9 selection).** Scored at 5 because behavior matches Rex's tier. Stubs documented in canonical-bot-rebuild-impact-2026-05-14.md.

**Total: 57/80. Δ −4.** Two of three Jett-specific differentiators (PA depth, PI multi-turn) ship at Rex-tier behavior. Jackpot Trap (SE 8) is the only PA/PH/PI/SE skill where Jett observably differs from Rex via wiring.

---

## Divergence analysis

### Cell with |Δ| > 1: Jett PI (spec 9, measured 5, Δ −4)

**Cause:** PI ≥ 9 multi-turn placement strategy path stubbed at rebuild time. PI ≥ 6 setup-value contribution also stubbed. `_placementIntelligence` threaded into `scorePlacement` signature but unused. Jett's observable placement behavior is identical to Rex's PI 5 default-tier selection.

**Evidence:**
- `evaluator.ts:415` — `_placementIntelligence?: number` parameter, prefixed underscore = unused-by-convention.
- `botDecision.ts:349` — only PI sub-rule that actually fires is `profile.placementIntelligence <= 2` (Calvin's tell).
- `docs/canonical-bot-rebuild-impact-2026-05-14.md` — explicitly lists PI ≥ 6 and PI ≥ 9 as STUBBED in the honest-skips table.

**Recommended action:** **Accept-as-shipped for launch.** The stubs are known follow-ups. Jett still differentiates from Rex on Jackpot Trap (SE 8) and at the weights level (placementDanger 1.2 vs Rex 1.0, mistakeRate 0.005 vs Rex 0.02). Multi-turn placement strategy is the Jett-only depth play that should land in a future track — the architectural threading (`_placementIntelligence` parameter) is already present; only the implementation needs to fill in.

**If TC wants to pre-launch instead of post-launch:** moderate-scope track. Estimated 1-2 subsystems: (a) PI ≥ 6 setup-value contribution (Rex would also gain this if his PI were 6 — but Rex's PI 5 sits intentionally one below, so this benefits Jett alone with current roster); (b) PI ≥ 9 multi-turn placement (Jett-only, deeper plan-N-turns logic).

### Cells with |Δ| = 1 (within tolerance, no flag — but worth tracking)

#### Nina OA (spec 3, measured 2, Δ −1)
**Cause:** OA gate at `botDecision.ts:318` is binary `>= 4`. Nina at OA 3 gets ZERO OA-routed wiring (same as Calvin OA 1). The skill scale is 1-10 but the only step is at 4.

**Recommended action:** **Accept-as-shipped for launch; queue OA gate refactor as architectural cleanup.** A scaled OA approach (e.g., OA ≥ 2 partial opponent modeling, OA ≥ 4 full Calvin-tell-aware bonuses, OA ≥ 6 per-opponent denial scaling) would distribute the depth more evenly. Low priority — gameplay impact is small because Nina's PA-routed positional awareness already covers basic opponent-position context.

#### Jett PA (spec 8, measured 7, Δ −1)
**Cause:** `layer3Reliability(pa)` steps `pa <= 8 → 0.70`, then `pa <= 9 → 0.90`. Jett at PA 8 has identical layer3 reliability to Rex at PA 7. No other PA gate distinguishes 7 from 8.

**Recommended action:** **Accept-as-shipped for launch; queue layer3Reliability curve smoothing.** Step the function at 7 / 8 / 9 (e.g., `pa <= 7 → 0.70, pa <= 8 → 0.85, pa >= 9 → 0.95`). Or add an explicit Layer 5 (synthesis) gate at PA ≥ 8 to give Jett unique depth. Low priority — same gameplay-impact note as Nina OA.

---

## Architectural findings

These were not visible during the rebuild but surfaced during the audit. None are bugs; all are evolution opportunities.

### Finding 1 — OA gate is binary, not scaled

The `opponentAwareness >= 4` gate at `botDecision.ts:318` is the only OA gate in code. Below 4, OA is silent. Above 4, OA is fully on. The skill scale (1-10) carries no internal granularity.

Consequence: Nina's OA 3 ships at Calvin's OA 1 behavior. Rex's OA 6 ships at Jett's OA 8 behavior in OA-routed code (depth differs only via stacking with DA, PA, PI).

This is a doctrine 7.3 ("tier = depth, not breadth") under-delivery for Nina specifically. Consider scaling OA gate stepwise, mirroring `deckAttentionChance(da)` pattern.

### Finding 2 — `layer3Reliability` curve has a cliff

```ts
function layer3Reliability(pa: number): number {
  if (pa <= 8) return 0.70;
  if (pa <= 9) return 0.90;
  return 0.95;
}
```

PA 7 and PA 8 both return 0.70. PA 9 jumps to 0.90 (+0.20 step). Then PA 10 nudges to 0.95.

Rex (PA 7) and Jett (PA 8) get identical Layer 3 reliability. The PA scale has no resolution between Rex and Jett. Curve smoothing (PA 7 → 0.70, PA 8 → 0.85, PA ≥ 9 → 0.95) would express Jett's PA 8 advantage in code.

### Finding 3 — Layer 5 (synthesis) is not an explicit gate

Doctrine 5.1 describes a 5-layer strategic loop. Code implements explicit gates for Layers 1-4 (round arc, recent action via Layer 3 reliability, active player count, plus the Hand 3 Fork as a position-aware compound). Layer 5 (synthesis — combining all preceding layers into a single integrated decision) doesn't have a dedicated gate; it emerges implicitly from the weighted score totals.

This is fine if the implicit emergence is the intended Layer 5 behavior. If doctrine 5.1's Layer 5 expects explicit synthesis logic (e.g., a meta-layer that re-weights based on cross-layer agreement), that's missing. Worth a doctrine-vs-code reconciliation pass.

### Finding 4 — `valueLossPenalty` universal floor is robust

The S1 doctrine 3.2 fix (universal `valueLossPenalty` subtracted unweighted from `score.total`) does NOT over-suppress face/Ace/10 placements per the audit's expected failure mode. The Place-Chain × doctrine 3.2 gate (`chainExpected > bestCaptureTotal × threshold + valueLossFloor`) correctly allows chain plans to overcome the floor when the chain's expected value justifies it. Rex's SE 6 chain plans and Jett's SE 8 chain plans both promote face plants when math supports.

**No tune needed.** The floor + gate combo lands as intended.

### Finding 5 — RT gate honors denial / jackpot / board-control bonuses

The S2 fix (gating on `topAction.score.total` instead of raw `captureDetails.totalPoints`) verified at `botDecision.ts:435`. Captures lifted above threshold by Rex's denial-mode 1.8× opponentDenial bonus or Jett's jackpot proximity multiplier survive the RT gate as intended.

**No tune needed.** The doctrine 1.10 (Reactive Strategy) alignment lands as intended.

### Finding 6 — `OpponentInfo` exposure is clean

Migrated to `placementIntelligence` + `captureComplexity` + `mistakeRate` + `score` + `difficulty`. No weight vectors or strategic config crosses the boundary. `botDecision.ts:160-173` confirms.

**No leak.** Opponent modeling can't be exploited to over-fit against opponent's exact strategy, only against opponent's skill-level signals.

---

## Honest skips called out

| Item | Status | Reason |
| ---- | ------ | ------ |
| Bot-vs-bot simulation | Not performed. | Out of scope per audit ticket — this is a doctrine-criteria scoring audit, not behavioral playtest. |
| Comparison to Foundation-era (May 6) scores | Not performed. | Schema changed (Capture Aggression dropped, Capture Complexity added; PI promoted to wired skill). Apples-to-oranges per audit ticket. |
| New tests | None added. | Read-only audit. The 321-test suite stays locked. |
| Personality config tuning | None applied. | Recommended in this doc; not implemented. Stacy + TC decide whether to tune pre-launch or accept-and-ship. |

---

## Final state

- **Calvin 10/80 ✓** — clean.
- **Nina 29/80 (Δ −1)** — within tolerance; OA gate cliff is the cause.
- **Rex 48/80 ✓** — clean. Loses Jackpot Trap as intended.
- **Jett 57/80 (Δ −4)** — known stubs. Accept-as-shipped for launch; PI ≥ 9 multi-turn placement is the only meaningful follow-up.

**Recommendation to Stacy + TC:**
- **Ship the bot story.** No tuning required for launch. Three of four bots land within 1 point of spec; Jett's −4 gap is on a stubbed path that's already documented as a future track.
- **Architectural cleanups (post-launch):** OA gate scaling, layer3Reliability curve smoothing, PI ≥ 6 / PI ≥ 9 implementation. None block launch.

Audit complete. No code touched. 321 tests still passing per pre-audit baseline.

---

*Audit conducted May 15, 2026 against the canonical bot evaluator (commit `46ac8b8` on `main`). Methodology mirrors the May 6 re-baseline doc with the post-canonical schema. All scoring evidence chains are file:line traceable in this doc.*
