# Jett Bot Build — Impact Summary

**Date:** May 6, 2026
**Implementer:** Claude Code (Opus) on Hulk
**Test results:** 246/246 passing (242 existing + 4 new Jett tests), coverage audit 100%

---

## Jett "The Stalker" — Stat Card

| Attribute | Value | vs Rex | Doctrine Gate |
|---|---|---|---|
| Capture Aggression | 9 | =9 | allowMultiSlot + useChainEval + 0.5% mistakes |
| Risk Threshold | 5 | >4 | riskThreshold 0.10 (10% of target) |
| Placement Intelligence | 8 | >7 | placementDanger 1.2, SE 8 setup value, DA 8 |
| Position Awareness | 8 | >7 | PA 9 → Layer 3 at 90% (Rex: 70%) |
| Setup Engineering | 7 | >6 | SE 8 → chain threshold 25% (Rex: 30%) |
| Pressure Handling | 9 | =9 | PH 9, tighter denial (45%) + conservative (15%) triggers |
| Opponent Awareness | 6 | >5 | OA 8, denial 2.0 (Rex: 1.8) |
| Deck Awareness | 8 | >7 | DA 8 → 97% attention (Rex: 95%) |
| **TOTAL** | **60/80** | | Target: 58-62 |

---

## Jett Weight Vector

```
rawPoints:       0.7  (Rex 0.8 — more patient, defers more)
chainPotential:  1.0  (Rex 1.0 — same)
placementDanger: 1.2  (Rex 1.0 — more careful placements)
opponentDenial:  1.0  (Rex 0.9 — stronger denial)
jackpotValue:    1.0  (Rex 1.0 — same)
boardControl:    1.0  (Rex 0.8 — values position over raw points)
mistakeRate:     0.005 (Rex 0.02 — Expert discipline, 4x fewer mistakes)
```

## Jett Dynamic Weight Modifiers

| Mode | Trigger | Effect |
|---|---|---|
| Denial | Opponent >= 45% of target (Rex: 50%) | opponentDenial: 2.0, boardControl: 1.3 |
| Conservative | Leading >= 15% of target (Rex: 20%) | rawPoints: 0.4, placementDanger: 1.8, opponentDenial: 0.3 |

Jett triggers EARLIER and HARDER than Rex — the patient hunter locks down leads faster and denies threats sooner.

---

## Awareness-Level Scaling (Subsystem 1)

Three hardcoded parameters generalized to scale with awareness levels:

| Parameter | Function | Rex Value | Jett Value |
|---|---|---|---|
| Layer 3 reliability | `layer3Reliability(pa)` | PA 8 → 70% | PA 9 → 90% |
| Deck attention | `deckAttentionChance(da)` | DA 7 → 95% | DA 8 → 97% |
| Chain threshold | `setupChainThreshold(se)` | SE 7 → 1.30 | SE 8 → 1.25 |

Calvin/Nina/Rex values preserved exactly. Rex's Layer 3 stays at 70% per TC's revision.

---

## Integration Points

| File | Change |
|---|---|
| `src/engine/types/index.ts` | Added `'expert'` to Difficulty union |
| `src/engine/ai/personalities/jett.ts` | New file — Jett personality |
| `src/engine/ai/personalities/index.ts` | Exports JETT, JETT_WEIGHTS |
| `src/engine/ai/botDecision.ts` | Jett in getPersonalityWeights/Profile switches, awareness scaling functions |
| `src/engine/ai/evaluator.ts` | Expert case in modifyWeightsForGameState |
| `src/components/ClassicSetup.tsx` | Jett in bot selection UI |
| `src/components/GameView.tsx` | Jett in PLAYER_COLORS (teal #0D9488) |
| `src/App.tsx` | Jett in BOT_NAMES |
| `src/shared/personalities.ts` | Jett difficulty updated to 'expert' |
| `tests/engine/ai/botDecision.test.ts` | 4 new Jett integration tests |

---

## Calvin/Nina/Rex Verification

| Bot | Pre-Jett | Post-Jett | Status |
|---|---|---|---|
| Calvin | 14/80 | 14/80 | Preserved |
| Nina | 42/80 | 42/80 | Preserved |
| Rex | 54/80 | 54/80 | Preserved |

No existing bot behavior changed. Rex's Layer 3 stays at 70% per TC revision.

---

## What's Next

1. TC reviews, runs tests, commits, pushes
2. Stacy drafts re-baseline measurement for Jett (target 58-62)
3. Adventure 12-level restructure (add Jett to progression)
4. Marcus visual paint brief (when UI integration needs it)
