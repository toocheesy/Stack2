# Foundation Stage 1 — Impact Summary

**Date:** May 5-6, 2026
**Implementer:** Claude Code (Opus) on Hulk
**Test results:** 242/242 passing, coverage audit 100%

---

## Changes Implemented

### Subsystem 1: Risk Threshold Gate
- Added `riskThreshold` field to `PersonalityProfile`
- Calvin: 0.02 (2% of target), Nina: 0.05 (5%), Rex: 0.08 (8%)
- Gate in `decideBotAction()`: demotes sub-threshold captures below best
  placement when placement danger is manageable
- Preserves Guaranteed-Points Principle (keeps capture if no viable placement)

### Subsystem 2: Calvin Placement Fix
- Renamed `preferHighestValueOnPlace` to `preferHighestNumberCardOnPlace`
- Replaced `calvinPlacementPick()` with `calvinNumberCardPick()`:
  filters to number cards (2-9), picks highest, falls back to standard
  evaluation if no number cards in hand
- Aligns Calvin's tell with doctrine 3.2 Placement Value Tier List

### Subsystem 3: Selective Deck Awareness
- Added `deckAwareness` field to `PersonalityProfile`
- Calvin: 2 (30% attention), Nina: 5 (80% attention), Rex: 7 (95% attention)
- Added `SelectiveDeckInfo` type and `getSelectiveDeckAwareness()` helper
- Attention roll via PRNG simulates human inattention per doctrine 4.3
- Wired into placement scoring: Odd-One Trap penalty (1.5x card value)
  when placing a face card with 3 of 4 already captured
- Wired into capture scoring: Ace scarcity bonus (+10 per Ace) when
  2 or fewer Aces remain unseen

---

## Files Modified

| File | Changes |
|---|---|
| `src/engine/ai/personalities/calvin.ts` | +3 fields (riskThreshold, deckAwareness, renamed placement pref) |
| `src/engine/ai/personalities/nina.ts` | +2 fields (riskThreshold, deckAwareness) |
| `src/engine/ai/personalities/rex.ts` | +2 fields (riskThreshold, deckAwareness) |
| `src/engine/ai/evaluator.ts` | +SelectiveDeckInfo type, +getSelectiveDeckAwareness(), renamed calvinNumberCardPick(), scoreCapture/scorePlacement accept selectiveDeck |
| `src/engine/ai/botDecision.ts` | +risk threshold gate, +attention roll, +selectiveDeck passthrough |
| `tests/engine/ai/botDecision.test.ts` | Updated Calvin placement test |

---

## Estimated Stat Card Impact

| Attribute | Calvin Pre | Calvin Post | Nina Pre | Nina Post | Rex Pre | Rex Post |
|---|---|---|---|---|---|---|
| Capture Aggression | 3 | 3 | 7 | 7 | 9 | 9 |
| Risk Threshold | 1 | **2** | 1 | **3** | 1 | **4** |
| Placement Intelligence | 1 | **2** | 5 | 5 | 6 | 6 |
| Position Awareness | 1 | 1 | 1 | 1 | 1 | 1 |
| Setup Engineering | 1 | 1 | 1 | 1 | 1 | 1 |
| Pressure Handling | 1 | 1 | 4 | 4 | 7 | 7 |
| Opponent Awareness | 1 | 1 | 1 | 1 | 2 | 2 |
| Deck Awareness | 1 | **2** | 3 | **5** | 5 | **7** |
| **TOTAL** | **10** | **13** | **23** | **28** | **32** | **38** |

### Delta Summary

| Bot | Before Stage 1 | After Stage 1 | Delta | Target Range | Remaining Gap |
|---|---|---|---|---|---|
| Calvin | 10/80 | ~13/80 | +3 | 15-17 | 2-4 pts |
| Nina | 23/80 | ~28/80 | +5 | 35-40 | 7-12 pts |
| Rex | 32/80 | ~38/80 | +6 | 50-58 | 12-20 pts |

### What Moved
- **Risk Threshold**: all 3 bots gained from zero to functional threshold gates
- **Placement Intelligence**: Calvin gained from doctrine-wrong to doctrine-aligned
- **Deck Awareness**: all 3 bots gained from generic to selective tracking with
  attention simulation, Odd-One Trap detection, and Ace scarcity awareness

### What Still Needs Foundation Work (Stages 2-3)
- **Position Awareness** (1/10 all bots) — biggest remaining gap
- **Setup Engineering** (1/10 all bots) — needs place-and-recover logic
- **Opponent Awareness** (1-2/10) — needs personality data exposure
- **Pressure Handling** (1-7/10) — needs hand-of-round and jackpot proximity
