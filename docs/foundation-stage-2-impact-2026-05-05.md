# Foundation Stage 2 — Impact Summary

**Date:** May 5-6, 2026
**Implementer:** Claude Code (Opus) on Hulk
**Test results:** 242/242 passing, coverage audit 100%

---

## Changes Implemented

### Subsystem 1: Opponent Awareness Plumbing
- Added `OpponentInfo` type: exposes difficulty, feature flags, mistake
  rate, score — not raw weight vectors (doctrine 5.6)
- Added `opponentAwareness` field: Calvin 1, Nina 4, Rex 7
- Per-opponent denial targeting (OA >= 4): threat-weighted multiplier
  scales denial 1.0x–2.0x proportional to closest opponent's progress
  toward target score
- Personality-aware placement (OA >= 4): face card pair danger reduced
  70% when next active player has `preferHighestNumberCardOnPlace`
  (Calvin won't capture face pairs — he places number cards)
- Helper functions: `buildOpponentInfo()`, `findNextActiveOpponent()`,
  `opponentInfoFor()`

### Subsystem 2: Position Awareness Layer
- Added `PositionContext` type: seat position (dealer/first/second),
  hand-of-round, active player count, previous action
- Added `positionAwareness` field: Calvin 2, Nina 6, Rex 8
- Added `getPositionContext()` pure helper
- Added `applyPositionModifiers()` — 5-layer strategic loop:

| Layer | Doctrine | PA Gate | Implementation |
|---|---|---|---|
| 1 — Round arc | 5.8, 2.9, 2.10 | PA >= 4 | Dealer Hand 2 press (rawPoints ×1.3, danger ×0.7). First Player press (rawPoints ×1.15). Dealer caution (danger ×1.2). |
| 2 — Player identity | 5.6 | PA >= 4 | Uses Subsystem 1's opponent profiles (already wired) |
| 3 — Recent action | — | PA >= 7 | Previous player captured → defense up (danger ×1.3, boardControl ×1.2). 70% reliable (Rex's weak layer). |
| 4 — Active count | 2.5 | PA >= 2 | Solo (1 active): deny/danger near-zero. Two-player: deny ×0.7. |
| 5 — Synthesis: Hand 3 Fork | 6.6 | PA >= 6 | Score >= 70% target → PRESS (rawPoints ×1.4). Below → PIVOT (jackpot ×1.5, boardControl ×1.3). |

---

## Files Modified

| File | Changes |
|---|---|
| `src/engine/ai/personalities/calvin.ts` | +2 fields (opponentAwareness: 1, positionAwareness: 2) |
| `src/engine/ai/personalities/nina.ts` | +2 fields (opponentAwareness: 4, positionAwareness: 6) |
| `src/engine/ai/personalities/rex.ts` | +2 fields (opponentAwareness: 7, positionAwareness: 8) |
| `src/engine/ai/evaluator.ts` | +OpponentInfo, +PositionContext, +SeatPosition types. +getPositionContext(), +applyPositionModifiers(), +getSelectiveDeckAwareness(). Per-opponent denial multiplier in scoreCapture(). Personality-aware face card safety in scorePlacement(). |
| `src/engine/ai/botDecision.ts` | +SCORE_KEYS import. +opponentInfoFor/buildOpponentInfo/findNextActiveOpponent helpers. Opponent plumbing + position context computation + Layer 3 attention roll in decideBotAction(). |

---

## Estimated Stat Card Impact

| Attribute | Calvin Pre | Calvin Post | Nina Pre | Nina Post | Rex Pre | Rex Post |
|---|---|---|---|---|---|---|
| Capture Aggression | 3 | 3 | 7 | 7 | 9 | 9 |
| Risk Threshold | 2 | 2 | 3 | 3 | 4 | 4 |
| Placement Intelligence | 2 | 2 | 5 | **6** | 6 | **7** |
| Position Awareness | 1 | **2** | 1 | **6** | 1 | **7** |
| Setup Engineering | 1 | 1 | 1 | 1 | 1 | 1 |
| Pressure Handling | 1 | 1 | 4 | **5** | 7 | **8** |
| Opponent Awareness | 1 | 1 | 1 | **4** | 2 | **5** |
| Deck Awareness | 2 | 2 | 5 | 5 | 7 | 7 |
| **TOTAL** | **13** | **14** | **27** | **37** | **37** | **48** |

### Delta Summary (Stage 2 only)

| Bot | Before Stage 2 | After Stage 2 | Delta | Target Range | Remaining Gap |
|---|---|---|---|---|---|
| Calvin | ~13/80 | ~14/80 | +1 | 15-17 | 1-3 pts |
| Nina | ~28/80 | ~37/80 | +9 | 35-40 | 0-3 pts (in range!) |
| Rex | ~38/80 | ~48/80 | +10 | 50-58 | 2-10 pts |

### Cumulative Impact (Stages 1+2)

| Bot | Pre-Foundation | After Stage 2 | Total Delta |
|---|---|---|---|
| Calvin | 10/80 | ~14/80 | +4 |
| Nina | 23/80 | ~37/80 | +14 |
| Rex | 32/80 | ~48/80 | +16 |

**Nina is now within her target range (35-40).** Calvin is 1 point below minimum. Rex needs Setup Engineering and Pressure Handling expansion from Stage 3 to close the remaining gap.

### What Still Needs Foundation Work (Stage 3)
- **Setup Engineering** (1/10 all bots) — place-to-plant, Jackpot Trap, multi-turn capture engineering
- **Pressure Handling expansion** — hand-of-round posture shifts, jackpot proximity, target aggression scaling
