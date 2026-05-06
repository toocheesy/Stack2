# Foundation Stage 3 — Impact Summary (FINAL)

**Date:** May 5-6, 2026
**Implementer:** Claude Code (Opus) on Hulk
**Test results:** 242/242 passing, coverage audit 100%

---

## Changes Implemented

### Subsystem 1: Pressure Handling Expansion
- Added `pressureHandling` field: Calvin 1, Nina 6, Rex 9
- Three new modifiers stacking on existing score-state + position modes:

| Modifier | PH Gate | Implementation |
|---|---|---|
| Hand-of-round posture | >= 4 | Hand 2 with deficit > 10% of target → rawPoints x1.2 |
| Jackpot proximity | >= 5 | Hand 3 + deck < 12: last capturer → protect (jackpot x1.8, danger x0.5); not last → press (rawPoints x1.3) |
| Target-score aggression | >= 6 | Target <= 200 → rawPoints x1.3; target >= 400 → rawPoints x0.85 (doctrine 5.3) |

### Subsystem 2: Setup Engineering
- Added `setupEngineering` field: Calvin 1, Nina 4, Rex 7
- Three concrete setup patterns:

| Pattern | SE Gate | Implementation |
|---|---|---|
| Place-To-Plant | >= 3 | Face card from hand-vs-hand pair: survival probability × pair capture value added as positive rawPoints to placement score. Survival adjusts for deck composition and next opponent personality. |
| Multi-Turn Engineering | >= 5 | `evaluatePlaceChain()` finds place-then-capture chains that recapture the planted card. Promotes placement when chain expected value (with 0.6 survival discount) exceeds best direct capture by 30%. |
| Jackpot Trap | >= 7 | Special case of Place-To-Plant: dead face card (Odd-One) in Hand 3 gets +20 bonus. Near-certain survival (opponents can't pair dead card) + jackpot fattening from forced opponent placements. |

---

## Files Modified

| File | Changes |
|---|---|
| `src/engine/ai/personalities/calvin.ts` | +2 fields (pressureHandling: 1, setupEngineering: 1) |
| `src/engine/ai/personalities/nina.ts` | +2 fields (pressureHandling: 6, setupEngineering: 4) |
| `src/engine/ai/personalities/rex.ts` | +2 fields (pressureHandling: 9, setupEngineering: 7) |
| `src/engine/ai/evaluator.ts` | +applyPressureExpansion(), +PlaceChainPlan type, +evaluatePlaceChain(), Place-To-Plant + Jackpot Trap in scorePlacement() |
| `src/engine/ai/botDecision.ts` | +applyPressureExpansion call, +evaluatePlaceChain import + place chain evaluation block |

---

## Estimated Stat Card Impact (Stage 3 only)

| Attribute | Calvin Pre | Calvin Post | Nina Pre | Nina Post | Rex Pre | Rex Post |
|---|---|---|---|---|---|---|
| Capture Aggression | 3 | 3 | 7 | 7 | 9 | 9 |
| Risk Threshold | 2 | 2 | 3 | 3 | 4 | 4 |
| Placement Intelligence | 2 | 2 | 6 | 6 | 7 | 7 |
| Position Awareness | 2 | 2 | 6 | 6 | 7 | 7 |
| Setup Engineering | 1 | 1 | 1 | **4** | 1 | **7** |
| Pressure Handling | 1 | 1 | 7 | **8** | 9 | **9** |
| Opponent Awareness | 1 | 1 | 4 | 4 | 5 | 5 |
| Deck Awareness | 2 | 2 | 5 | 5 | 7 | 7 |
| **TOTAL** | **14** | **14** | **39** | **43** | **49** | **55** |

---

## CUMULATIVE IMPACT — ALL THREE FOUNDATION STAGES

| Bot | Pre-Foundation | After Stage 1 | After Stage 2 | After Stage 3 | Target | Status |
|---|---|---|---|---|---|---|
| Calvin | 10/80 | 13 | 14 | **14** | 15-17 | 1 below min |
| Nina | 23/80 | 28 | 37 | **43** | 35-40 | **EXCEEDS** |
| Rex | 32/80 | 38 | 48 | **55** | 50-58 | **IN RANGE** |

### Per-Attribute Final Scores (estimated)

| Attribute | Calvin | Nina | Rex | Notes |
|---|---|---|---|---|
| Capture Aggression | 3 | 7 | 9 | Exhaustive enumeration + chain eval |
| Risk Threshold | 2 | 3 | 4 | Percentage-based gates |
| Placement Intelligence | 2 | 6 | 7 | Danger scoring + personality-aware + setup value |
| Position Awareness | 2 | 6 | 7 | 5-layer loop gated by PA level |
| Setup Engineering | 1 | 4 | 7 | Place-To-Plant + chains + Jackpot Trap |
| Pressure Handling | 1 | 8 | 9 | Score-state + position + hand-of-round + jackpot + target scaling |
| Opponent Awareness | 1 | 4 | 5 | Per-opponent denial + personality-aware placement |
| Deck Awareness | 2 | 5 | 7 | Selective tracking + Odd-One Trap + Ace scarcity |
| **TOTAL** | **14** | **43** | **55** | |

### What the Foundation Built
- **Calvin** stays intentionally weak (14/80, 1 below target min). His identity IS being bad. The 4-point lift came from basic improvements (exhaustive scanning, doctrine-aligned placement, minimal deck awareness).
- **Nina** exceeded her target (43 vs 35-40 range). She's a solid intermediate player with complete capture scanning, setup plays, strong pressure handling, and opponent awareness.
- **Rex** hit his target range (55 vs 50-58). He runs all 5 strategic loop layers, plans multi-turn setups, detects Jackpot Traps, and adapts aggressively to score state and target score.

### What's Next
1. Re-baseline measurement track (actual stat card scoring, not estimates)
2. Marcus brief for Jett identity
3. Jett bot build (Expert tier — PA 10, SE 10, everything maxed)
4. Adventure 12-level restructure
