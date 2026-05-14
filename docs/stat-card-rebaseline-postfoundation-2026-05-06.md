# Stat Card Re-Baseline — Post-Foundation Measurement

**Date:** May 6, 2026
**Auditor:** Claude Code (Opus) on Hulk
**Codebase:** H:\Projects\STACKED-v2 (commits d695533 → 7922941 → 1027456)
**Framework:** 8 attributes, /80 total
**Doctrine reference:** Notion page 3562f2662cac8134b848d59ce9f08573

---

## CALVIN — POST-FOUNDATION BASELINE

1. **Capture Aggression: 3/10** — `allowMultiSlot: false` blocks all multi-slot captures. `useChainEval: false` blocks lookahead. `mistakeRate: 0.25` randomly downgrades 25% of picks. Single-slot scanning IS exhaustive (4+ card sums, multi-card pairs from enumeration fix), but structural limitations dominate. File: `personalities/calvin.ts:32-36`, `evaluator.ts:633-651`

2. **Risk Threshold: 2/10** — `riskThreshold: 0.02` (2% of target). At target 300, threshold = 6 pts — only defers 5-pt number card pairs. Functional but minimal. File: `botDecision.ts:304-319`, `personalities/calvin.ts:36`

3. **Placement Intelligence: 2/10** — `preferHighestNumberCardOnPlace: true` aligns with doctrine 3.2 tier list (spends high number cards first, defers face cards/Aces). But `placementDanger: 0.1` means danger scoring is near-ignored (10% weight). No setup value (SE 1). File: `botDecision.ts:332-343`, `evaluator.ts:372-442`, `personalities/calvin.ts:10`

4. **Position Awareness: 2/10** — `positionAwareness: 2` runs only Layer 4 (active player count). Solo state: opponentDenial ×0.1, placementDanger ×0.3. Two-player: opponentDenial ×0.7. Does not run Layers 1, 2, 3, or 5. File: `evaluator.ts:136-143`, `botDecision.ts:207-217`

5. **Setup Engineering: 1/10** — `setupEngineering: 1` is below all gates (SE >= 3 for Place-To-Plant, >= 5 for chains, >= 7 for Jackpot Trap). Zero setup logic active. Intentional — Calvin's identity is being bad. File: `personalities/calvin.ts:41`

6. **Pressure Handling: 1/10** — `pressureHandling: 1` is below PH >= 4 gate for all expansion modifiers. `modifyWeightsForGameState()` skips beginner difficulty entirely. No score-state reactivity. Calvin plays identically whether winning by 200 or losing by 200. File: `evaluator.ts:502`, `personalities/calvin.ts:40`

7. **Opponent Awareness: 1/10** — `opponentAwareness: 1` is below OA >= 4 gate. No opponent profiles exposed. `opponentDenial: 0.0` weight means denial scoring is completely ignored even if data were present. File: `personalities/calvin.ts:7,38`

8. **Deck Awareness: 2/10** — `deckAwareness: 2` gives 30% attention chance. When attentive, Odd-One Trap penalty applies to placement and Ace scarcity bonus applies to captures. But `placementDanger: 0.1` minimizes the Odd-One penalty, and `rawPoints: 1.0` does carry the Ace scarcity bonus at 30% frequency. Minimal effective benefit. File: `botDecision.ts:222-230`, `evaluator.ts:296-300,386-392`

**TOTAL: 14/80**

---

## NINA — POST-FOUNDATION BASELINE

1. **Capture Aggression: 7/10** — `allowMultiSlot: true` enables complete multi-slot captures. Post-fix exhaustive `findAllCaptures()` feeds complete options to `findBestMultiSlotCapture()`. `preferSumsOnTie: true` breaks ties toward sums. `mistakeRate: 0.08`. Still no chain eval (`useChainEval: false`). File: `personalities/nina.ts:17-19`, `botDecision.ts:257-259`

2. **Risk Threshold: 3/10** — `riskThreshold: 0.05` (5% of target). At target 300, threshold = 15 pts. Meaningfully defers small pairs and weak sums when safer placements exist. Fires more often than Calvin's but still a simple binary gate. File: `personalities/nina.ts:21`, `botDecision.ts:304-319`

3. **Placement Intelligence: 6/10** — `placementDanger: 0.7` moderately weighs danger. Personality-aware (OA 4 >= 4): face card pair danger reduced 70% before Calvin. Place-To-Plant setup value (SE 4 >= 3): positive rawPoints for face card pair planting with survival probability. Odd-One Trap penalty at 80% attention (DA 5). File: `evaluator.ts:372-442`, `evaluator.ts:398-407`

4. **Position Awareness: 6/10** — `positionAwareness: 6` runs 4 of 5 layers. Layer 1 (PA >= 4): Dealer Hand 2 press (rawPoints ×1.3, danger ×0.7), First Player advantage (rawPoints ×1.15), Dealer caution (danger ×1.2). Layer 2 via OA: opponent personality data exposed for placement decisions. Layer 4 (PA >= 2): active player count awareness. Layer 5 (PA >= 6): Hand 3 Fork (PRESS at score >= 70% target, PIVOT to jackpot otherwise). Missing Layer 3 (recent action, requires PA >= 7). File: `evaluator.ts:118-155`, `botDecision.ts:207-217`

5. **Setup Engineering: 4/10** — `setupEngineering: 4` activates Place-To-Plant (SE >= 3). When placing a face card while holding a matching face card, computes survival probability based on deck composition and next opponent personality. Adds expected pair-capture value as positive rawPoints. Multi-turn engineering NOT active (SE < 5). Jackpot Trap NOT active (SE < 7). File: `evaluator.ts:385-410`

6. **Pressure Handling: 7/10** — `pressureHandling: 6` activates all three expansion modifiers: hand-of-round posture (Hand 2 deficit press rawPoints ×1.2), jackpot proximity (last-capturer protection jackpotValue ×1.8 or aggressive rawPoints ×1.3), target-score aggression (short games ×1.3, long games ×0.85). Plus existing aggressive mode (behind 15% → rawPoints 1.3). Plus position-driven: Dealer Hand 2 press, Hand 3 Fork. Seven distinct pressure mechanisms total. Missing Rex's denial mode and conservative mode. File: `evaluator.ts:159-209`, `evaluator.ts:500-519`, `botDecision.ts:219-220`

7. **Opponent Awareness: 4/10** — `opponentAwareness: 4` exposes opponent profiles. Per-opponent denial: threat-weighted multiplier (1.0x–2.0x) based on closest opponent's progress toward target. Personality-aware placement: face card danger reduced 70% before Calvin. Does not differentiate between specific opponents beyond maxThreat aggregate. No behavioral adaptation. File: `evaluator.ts:325-334`, `evaluator.ts:398-407`, `botDecision.ts:232-241`

8. **Deck Awareness: 5/10** — `deckAwareness: 5` gives 80% attention. Odd-One Trap penalty (1.5× card value) in placement scoring. Ace scarcity bonus (+10 per Ace) when ≤2 remaining. Feeds Selective Deck info to Setup Engineering (oddOnes list used by Place-To-Plant). Tracker used through multiple weighted dimensions: opponentDenial (0.3), placementDanger (0.7), jackpotValue (0.4), boardControl (0.3). File: `botDecision.ts:222-230`, `evaluator.ts:280-300,386-392`

**TOTAL: 42/80**

---

## REX — POST-FOUNDATION BASELINE

1. **Capture Aggression: 9/10** — `allowMultiSlot: true` + `useChainEval: true` gives deepest scanning. Exhaustive enumeration + complete multi-slot + 2-turn chain eval. Chain plays when 2-turn total exceeds best single by 20% (`plan.totalPoints > bestCaptureTotal * 1.2`). `mistakeRate: 0.02`. Missing only 3+ turn chains and strategic capture skipping (doctrine 3.5). File: `personalities/rex.ts:18-19`, `botDecision.ts:261-282`, `evaluator.ts:506-548`

2. **Risk Threshold: 4/10** — `riskThreshold: 0.08` (8% of target). At target 300, threshold = 24 pts. Strategic gate that defers 10-20 pt captures for bigger plays when placement danger is manageable. Combined with Rex's high danger awareness (weight 1.0), the threshold produces meaningful play. Still a binary gate without multi-factor assessment. File: `personalities/rex.ts:21`, `botDecision.ts:304-319`

3. **Placement Intelligence: 7/10** — `placementDanger: 1.0` fully weighs danger. Personality-aware (OA 7): face cards safer before Calvin. Place-To-Plant setup value (SE 7): positive rawPoints for face card pair planting + Jackpot Trap +20 bonus for dead face cards in Hand 3. Odd-One Trap penalty at 95% attention (DA 7). Endgame jackpot penalty (-10 when not lastCapturer). Multi-turn engineering: `evaluatePlaceChain()` promotes setup placements. File: `evaluator.ts:372-442`, `botDecision.ts:284-302`

4. **Position Awareness: 7/10** — `positionAwareness: 8` runs all 5 layers. Layer 1 (PA >= 4): dealer/first-player/second-player posture modifiers. Layer 2 (PA >= 4 + OA 7): opponent personality data for decisions. Layer 3 (PA >= 7): recent action context — defense boost after opponent captures, 70% reliable (Rex's documented weak layer). Layer 4 (PA >= 2): active player count. Layer 5 (PA >= 6): Hand 3 Fork. All layers active but Layer 3 at 70% reliability. File: `evaluator.ts:118-155`, `botDecision.ts:207-217`

5. **Setup Engineering: 6/10** — `setupEngineering: 7` activates all three patterns. Place-To-Plant (SE >= 3): face card pair planting with survival probability. Multi-Turn Engineering (SE >= 5): `evaluatePlaceChain()` finds place-then-capture chains recapturing the planted card; promotes when expected value (× 0.6 survival discount) exceeds direct capture by 30%. Jackpot Trap (SE >= 7): +20 bonus for dead face card placement in Hand 3. All three fire in real games but survival modeling is crude (hardcoded 0.6 discount, no per-opponent assessment) and Jackpot Trap doesn't verify last-capturer positioning. File: `evaluator.ts:385-416`, `evaluator.ts:550-590`, `botDecision.ts:284-302`

6. **Pressure Handling: 9/10** — `pressureHandling: 9` activates all three expansion modifiers at highest tier. Plus existing: denial mode (opponent ≥ 50% target → opponentDenial 1.8, boardControl 1.2) AND conservative mode (leading ≥ 20% → rawPoints 0.5, placementDanger 1.5). Plus position-driven: Dealer Hand 2 press, First Player advantage, Dealer caution. Plus Hand 3 Fork. Plus Layer 3 defense boost (70%). Nine distinct pressure mechanisms. Missing only within-hand real-time posture adaptation. File: `evaluator.ts:159-209,496-519`, `botDecision.ts:207-217,219-220`

7. **Opponent Awareness: 5/10** — `opponentAwareness: 7` provides full profiles + per-opponent denial + personality-aware placement. Denial mode targets maxOpponent at 50% of target with enhanced threat-weighted multiplier. Conservative mode triggered by score lead. Face cards safer before Calvin. Does not differentiate between two specific opponents beyond aggregate maxThreat. No behavioral adaptation to observed in-game patterns. File: `evaluator.ts:325-334,498-512`, `botDecision.ts:232-241`

8. **Deck Awareness: 7/10** — `deckAwareness: 7` gives 95% attention. Near-always active Odd-One Trap penalty and Ace scarcity bonus. Feeds oddOnes list to Jackpot Trap detection in Setup Engineering. Heavily uses CardTracker through all weighted dimensions: opponentDenial (0.9), placementDanger (1.0), jackpotValue (1.0), boardControl (0.8), chainPotential (1.0). File: `botDecision.ts:222-230`, `evaluator.ts:280-300,386-416`

**TOTAL: 54/80**

---

## TABLE 1: PRE-FOUNDATION vs POST-FOUNDATION

| Attribute | Calvin Pre | Calvin Post | Nina Pre | Nina Post | Rex Pre | Rex Post |
|---|---|---|---|---|---|---|
| Capture Aggression | 3 | 3 | 7 | 7 | 9 | 9 |
| Risk Threshold | 1 | **2** | 1 | **3** | 1 | **4** |
| Placement Intelligence | 1 | **2** | 5 | **6** | 6 | **7** |
| Position Awareness | 1 | **2** | 1 | **6** | 1 | **7** |
| Setup Engineering | 1 | 1 | 1 | **4** | 1 | **6** |
| Pressure Handling | 1 | 1 | 4 | **7** | 7 | **9** |
| Opponent Awareness | 1 | 1 | 1 | **4** | 2 | **5** |
| Deck Awareness | 1 | **2** | 3 | **5** | 5 | **7** |
| **TOTAL** | **10** | **14** | **23** | **42** | **32** | **54** |

---

## TABLE 2: CC ESTIMATES vs RE-BASELINE ACTUALS

| Bot | CC Estimate | Re-Baseline Actual | Variance |
|---|---|---|---|
| Calvin | 14/80 | **14/80** | 0 |
| Nina | ~43/80 | **42/80** | -1 |
| Rex | ~55/80 | **54/80** | -1 |

### Per-Attribute Variance (estimate → actual)

| Attribute | Nina Est | Nina Act | Rex Est | Rex Act |
|---|---|---|---|---|
| Capture Aggression | 7 | 7 | 9 | 9 |
| Risk Threshold | 3 | 3 | 4 | 4 |
| Placement Intelligence | 6 | 6 | 7 | 7 |
| Position Awareness | 6 | 6 | 7 | 7 |
| Setup Engineering | 4 | 4 | 7 | **6** (-1) |
| Pressure Handling | 8 | **7** (-1) | 9 | 9 |
| Opponent Awareness | 4 | 4 | 5 | 5 |
| Deck Awareness | 5 | 5 | 7 | 7 |

**Nina variance (-1):** Pressure Handling scored 7 instead of estimated 8. Nina lacks Rex's denial and conservative modes, limiting her pressure repertoire below the 8/10 threshold.

**Rex variance (-1):** Setup Engineering scored 6 instead of estimated 7. The survival modeling in `evaluatePlaceChain()` uses a hardcoded 0.6 discount without context-awareness, and the Jackpot Trap detection doesn't verify last-capturer positioning. Functional but crude compared to 7/10 expectations.

---

## ANALYSIS

### 1. Which attributes hit their stage target gains?

All attributes gained as expected. The Foundation work delivered across all 8 dimensions for Nina and Rex. Calvin's gains were intentionally limited (he stays weak).

### 2. Which attributes underperformed CC's estimates?

**Nina Pressure Handling** (-1): 7 actual vs 8 estimated. Seven pressure mechanisms is strong but lacks Rex-level dual-mode switching (denial + conservative). 8/10 would require near-comprehensive coverage.

**Rex Setup Engineering** (-1): 6 actual vs 7 estimated. Three patterns are implemented but execution sophistication is below 7/10. Crude survival model and condition-only Jackpot Trap detection limit real-world effectiveness.

### 3. Which attributes overperformed?

None overperformed. Estimates were close across the board. The tight variance (0 to -1 per attribute) reflects accurate self-assessment during implementation.

### 4. Calvin calibration: is he at 13, 14, or 15?

**Calvin is at 14/80.** One point below the minimum target of 15.

The gap is spread thin — no single attribute can easily close it. The most natural +1 candidates:
- **Capture Aggression 3→4**: Would require multi-slot or reduced mistake rate, both of which would change Calvin's identity
- **Placement Intelligence 2→3**: Would require lowering `placementDanger` weight below 0.1, counterproductive
- **Deck Awareness 2→3**: Would require raising attention from 30% to ~50%, most identity-safe option

**Recommendation:** Accept Calvin at 14. He's 1 point below the floor of a target RANGE (15-17). The range was a design hypothesis. A beginner bot at 14/80 is coherent with his identity — intentionally weak, predictable, exploitable. Pushing to 15 would require raising deckAwareness to 3 (50% attention), which is a minor dial turn if TC decides it's needed.

### 5. Gap to target

| Bot | Actual | Target | Status |
|---|---|---|---|
| Calvin | 14/80 | 15-17 | 1 below min (accept or minor DA bump) |
| Nina | 42/80 | 35-40 | **Exceeds by 2** |
| Rex | 54/80 | 50-58 | **In range** |

### 6. Recommendation: ready for Jett build?

**Yes.** Nina and Rex are within or above their target ranges. Calvin is 1 point below the floor, which is acceptable for a beginner bot whose identity is being weak.

The Foundation engine is architecturally complete. The bot evaluation pipeline now has:
- Exhaustive capture enumeration (enumeration fix)
- Risk threshold gating (Stage 1)
- Selective deck awareness with attention simulation (Stage 1)
- Opponent personality exposure with per-opponent denial (Stage 2)
- 5-layer position-aware strategic loop (Stage 2)
- Pressure handling with 9 distinct mechanisms (Stage 3)
- Setup Engineering with 3 multi-turn patterns (Stage 3)

Jett build can proceed. The PersonalityProfile interface already has all fields Jett needs — just set his values to 9-10 across the board.

---

## DELIVERABLE

| File | Status |
|---|---|
| `docs/stat-card-rebaseline-postfoundation-2026-05-06.md` | This document |
| Pre-Foundation baseline | `docs/stat-card-rebaseline-2026-05-05.md` |
| Stage 1 impact | `docs/foundation-stage-1-impact-2026-05-05.md` |
| Stage 2 impact | `docs/foundation-stage-2-impact-2026-05-05.md` |
| Stage 3 impact | `docs/foundation-stage-3-impact-2026-05-05.md` |
