# Stat Card Re-Baseline — May 5, 2026

**Auditor:** Claude Code (Opus) on Hulk
**Codebase:** H:\Projects\STACKED-v2 (post-enumeration fix, 242 tests passing)
**Framework:** 8 attributes, /80 total (updated from May 3's 7-attribute /70 framework)
**Doctrine reference:** Notion page 3562f2662cac8134b848d59ce9f08573

---

## CALVIN — POST-FIX BASELINE

1. **Capture Aggression: 3/10** — Scans pairs (now including multi-card pair subsets) and sums (now including 4+ card subsets) via shared `findAllCaptures()`. Single-slot scanning is now exhaustive. But `allowMultiSlot: false` blocks all multi-slot captures, `useChainEval: false` blocks lookahead, and `mistakeRate: 0.25` randomly downgrades 25% of picks. File: `personalities/calvin.ts:23-31`, `evaluator.ts:328-403`

2. **Risk Threshold: 1/10** — No minimum capture value threshold exists anywhere in the code. Calvin takes any capture that outscores the best placement, even a 5-point pair. No percentage-based gate. File: `evaluator.ts:328-403` (no threshold logic)

3. **Placement Intelligence: 1/10** — `placementDanger: 0.1` means danger is weighted at 10% — near-ignored. Plus `preferHighestValueOnPlace: true` overrides danger scoring entirely, forcing Calvin to place his highest-value card. This is explicitly the wrong behavior per doctrine 3.2 (Placement Value Tier List). File: `botDecision.ts:197-208`, `evaluator.ts:451-463`

4. **Position Awareness: 1/10** — Zero position-aware code exists in the decision pipeline. `evaluateAllActions()` never references `playerIndex` relative to other players. No turn-order awareness, no dealer/first-player distinction, no active-count tracking. File: `evaluator.ts` (no position-relative logic)

5. **Setup Engineering: 1/10** — No setup-value calculation exists. Calvin does not consider whether placing a card creates a capture opportunity for himself on a future turn. Placement scoring measures only danger (what opponents could capture), never opportunity (what Calvin could recover). File: `evaluator.ts:182-231`

6. **Pressure Handling: 1/10** — `modifyWeightsForGameState()` returns base weights unchanged for `'beginner'` difficulty. Calvin plays identically whether winning by 200 or losing by 200. No score-state reactivity whatsoever. File: `evaluator.ts:419`

7. **Opponent Awareness: 1/10** — `opponentDenial` weight is 0.0, so denial scoring is completely ignored. Calvin does not differentiate between opponents, track who is closest to target, or leverage personality data of bots at the table. File: `personalities/calvin.ts:5` (`opponentDenial: 0.0`)

8. **Deck Awareness: 1/10** — CardTracker IS passed to the evaluator, but Calvin's weights nullify all tracker-dependent dimensions: `opponentDenial: 0.0`, `jackpotValue: 0.0`, `boardControl: 0.0`, `chainPotential: 0.0`. Only `placementDanger: 0.1` uses `getRemainingOfRank()`, and it's weighted at 10% AND overridden by `preferHighestValueOnPlace`. Effectively zero deck awareness. File: `personalities/calvin.ts:3-11`

**TOTAL: 10/80**

---

## NINA — POST-FIX BASELINE

1. **Capture Aggression: 7/10** — `allowMultiSlot: true` enables multi-slot captures. Post-fix, `findAllCaptures()` now returns the complete set of legal single-slot options (all pair subsets, all sum sizes), which feeds exhaustive input to `findBestMultiSlotCapture()`. Nina now finds every legal capture including 4+ card Ace-stacking sums in multi-slot combinations. `preferSumsOnTie: true` breaks ties toward sums. Still no chain eval (`useChainEval: false`), 8% mistake rate. File: `personalities/nina.ts:14-22`, `evaluator.ts:360-389`, `botDecision.ts:78-88`

2. **Risk Threshold: 1/10** — Same as Calvin — no minimum capture value threshold exists in the code. Nina takes any capture that outscores placement. File: `evaluator.ts:328-403`

3. **Placement Intelligence: 5/10** — `placementDanger: 0.7` moderately weighs danger. `scorePlacement()` checks pair risk and sum risk via `getRemainingOfRank()` from CardTracker. Does NOT check what the specific next player would do — danger is statistical ("any opponent could capture this"), not identity-aware. No `preferHighestValueOnPlace`. File: `evaluator.ts:182-231`, `personalities/nina.ts:8`

4. **Position Awareness: 1/10** — Zero position-aware code. Same architectural gap as Calvin — no turn-order context, no dealer awareness, no active-count tracking. File: `evaluator.ts` (no position-relative logic)

5. **Setup Engineering: 1/10** — No setup-value calculation. Same gap as Calvin — placement scoring measures danger only, never opportunity. Cannot "plant a face card hoping to pair it next turn" per doctrine 3.3. File: `evaluator.ts:182-231`

6. **Pressure Handling: 4/10** — One dynamic modifier: aggressive mode triggers when trailing by >= 15% of target score. Boosts `rawPoints: 1.3`, reduces `opponentDenial: 0.5` and `placementDanger: 0.5`. This makes Nina take more risks when behind. But no conservative mode when leading, no hand-of-round awareness, no jackpot-proximity posture shift. File: `evaluator.ts:440-443`

7. **Opponent Awareness: 1/10** — `opponentDenial` weight is 0.3, but the denial calculation in `scoreCapture()` treats all opponents identically via `estimateDeckComposition()` — no distinction between "deny the leader" vs "deny Calvin." Nina's aggressive mode reacts to the score GAP (Pressure Handling), not to WHO the leading opponent is. No personality-data exposure. File: `evaluator.ts:133-147`, `personalities/nina.ts:8`

8. **Deck Awareness: 3/10** — Nina uses CardTracker through multiple weighted dimensions: `opponentDenial: 0.3` (uses `estimateDeckComposition`), `placementDanger: 0.7` (uses `getRemainingOfRank`), `jackpotValue: 0.4` (uses `gamePhase`). This provides moderate generic deck awareness. However, no selective tracking per doctrine 4.3 — Nina doesn't prioritize Aces or face cards, doesn't detect the Odd-One Trap (3 of a rank captured), doesn't adjust face card handling based on scarcity. File: `evaluator.ts:109-180`, `cardTracker.ts:109-124`

**TOTAL: 23/80**

---

## REX — POST-FIX BASELINE

1. **Capture Aggression: 9/10** — `allowMultiSlot: true` + `useChainEval: true` gives Rex the deepest scanning of any bot. Post-fix, exhaustive `findAllCaptures()` feeds complete options to both `findBestMultiSlotCapture()` and `evaluateChainCapture()`. Rex now finds every legal single-slot capture, every legal multi-slot combination, and evaluates all 2-turn chain sequences against correct inputs. Chain plays when 2-turn total exceeds best single by 20%. `mistakeRate: 0.02`. Missing only: 3+ turn chains, strategic capture skipping (doctrine 3.5 jackpot gatekeeping). File: `personalities/rex.ts:14-22`, `evaluator.ts:261-304`, `botDecision.ts:163-184`

2. **Risk Threshold: 1/10** — Same as all bots — no minimum capture value threshold. Rex takes any net-positive capture. The 20% chain threshold (`plan.totalPoints > bestCaptureTotal * 1.2`) gates CHAIN promotion, not capture minimum. File: `botDecision.ts:174`

3. **Placement Intelligence: 6/10** — `placementDanger: 1.0` fully weighs danger. Checks pair risk and sum risk via deck composition. In endgame when not lastCapturer, adds -10 jackpot penalty to placements. Still does NOT check next-player identity — danger is statistical, not opponent-specific. No setup-value (opportunity) calculation. File: `evaluator.ts:182-231`, `personalities/rex.ts:8`

4. **Position Awareness: 1/10** — Zero position-aware code. Same universal gap. Rex plays identically in seat 1 vs seat 3, as dealer vs first-player. No position-relative evaluation despite doctrine 5.1 calling for a 5-layer strategic loop. File: `evaluator.ts` (no position logic)

5. **Setup Engineering: 1/10** — Rex's `evaluateChainCapture()` plans 2-turn CAPTURE sequences but does NOT engineer PLACEMENTS. He cannot "plant a card to capture it next turn." The chain evaluator only considers capture-then-capture, never place-then-capture. No `_calculateSetupValue()` exists (noted as gap in `docs/AI_AUDIT_REPORT.md`). File: `evaluator.ts:261-304` (captures only), `evaluator.ts:182-231` (no setup logic)

6. **Pressure Handling: 7/10** — Two dynamic modifiers: (1) Denial mode when any opponent >= 50% of target — `opponentDenial: 1.8`, `boardControl: 1.2`. (2) Conservative mode when leading by >= 20% of target — `rawPoints: 0.5`, `placementDanger: 1.5`, `opponentDenial: 0.45`. Both use percentage-based thresholds that scale with target score. Missing: hand-of-round posture shifts, jackpot-proximity awareness, target-score-driven aggression scaling (doctrine 5.3). File: `evaluator.ts:428-437`

7. **Opponent Awareness: 2/10** — Rex's denial mode (`maxOpponent >= target * 0.50`) IS score-state-primary targeting per doctrine 1.11 — it reacts to whoever is closest to winning. `opponentDenial: 0.9` base weight means denial scoring is meaningful. However: (a) denial targets "maxOpponent" as an aggregate, not specific players; (b) no personality-data exposure — Rex doesn't know if he's facing Calvin or Nina; (c) no observed-pattern dimension. One functional dimension of two. File: `evaluator.ts:428-431`, `evaluator.ts:133-147`

8. **Deck Awareness: 5/10** — Rex uses CardTracker most heavily of any bot: `opponentDenial: 0.9` (uses `estimateDeckComposition`), `placementDanger: 1.0` (uses `getRemainingOfRank`), `jackpotValue: 1.0` (uses `gamePhase`), `boardControl: 0.8` (uses board-state partner counts), `chainPotential: 1.0` (uses remaining hand/board). This provides strong generic deck awareness. Still missing per doctrine 4.3: selective Ace/face-card tracking, Odd-One Trap detection, scarcity-aware face card deferral. The infrastructure is there; the selectivity is not. File: `evaluator.ts:109-180`, `cardTracker.ts:109-124`

**TOTAL: 32/80**

---

## PRE-FIX vs POST-FIX COMPARISON TABLE

| Attribute | Calvin Pre | Calvin Post | Nina Pre | Nina Post | Rex Pre | Rex Post |
|---|---|---|---|---|---|---|
| Capture Aggression | 3 | **3** | 6 | **7** | 8 | **9** |
| Risk Threshold | 1 | 1 | 1 | 1 | 1 | 1 |
| Placement Intelligence | 1 | 1 | 5 | 5 | 6 | 6 |
| Position Awareness | 1 | 1 | 1 | 1 | 1 | 1 |
| Setup Engineering | 1 | 1 | 1 | 1 | 1 | 1 |
| Pressure Handling | 1 | 1 | 4 | 4 | 7 | 7 |
| Opponent Awareness | N/A | **1** | N/A | **1** | N/A | **2** |
| Deck Awareness | N/A | **1** | N/A | **3** | N/A | **5** |
| **TOTAL** | 8/60 | **10/80** | 18/60 | **23/80** | 24/60 | **32/80** |

*Pre-fix totals are /60 (6 comparable attributes after dropping Adaptability). Post-fix totals are /80 (8 attributes).*

---

## ANALYSIS

### 1. What shifted AUTOMATICALLY from the enumeration fixes?

**Capture Aggression — Nina (+1) and Rex (+1).**

Both bots gained complete single-slot enumeration feeding into their
multi-slot pipeline. Nina now finds every legal multi-slot capture
including those using 4+ card sums and multi-card pair slots. Rex's
chain evaluator now operates on complete inputs, finding better 2-turn
sequences.

Calvin's Capture Aggression did NOT shift (stayed 3/10). While he
technically benefits from exhaustive single-slot scanning (sees 4+ card
sums and multi-card pairs), his structural limitations (`allowMultiSlot:
false`, `useChainEval: false`, `mistakeRate: 0.25`) dominate the score.

**No other attributes shifted.** The enumeration fix only affects what
captures are FOUND, not how they are evaluated, ranked, or contextualized.

### 2. What did NOT shift (requires Foundation engine work)?

| Attribute | All Bots | Why |
|---|---|---|
| Risk Threshold | 1/10 | No minimum-capture-value code exists. Needs new threshold logic. |
| Position Awareness | 1/10 | Zero position-relative code in the evaluation pipeline. Needs new code paths referencing turn order, dealer status, active player count. |
| Setup Engineering | 1/10 | No place-and-recover logic. Placement scoring measures danger only, never opportunity. Needs setup-value calculation. |
| Opponent Awareness | 1-2/10 | No personality-data exposure to the evaluator. Rex has crude score-state targeting but no opponent differentiation. Needs opponent identity plumbing. |
| Placement Intelligence | 1-6/10 | Partially implemented (danger scoring exists) but not opponent-specific. Calvin's `preferHighestValueOnPlace` is actively wrong. Needs next-player identity awareness. |
| Pressure Handling | 1-7/10 | Partially implemented (Rex has 2 modifiers, Nina has 1, Calvin has 0). Missing: hand-of-round posture shifts, jackpot-proximity awareness, target-score aggression scaling. |
| Deck Awareness | 1-5/10 | CardTracker infrastructure exists and is used. Missing: selective Ace/face-card tracking per doctrine 4.3, Odd-One Trap detection, scarcity-aware deferral. |

### 3. Gap to target stat card scores

| Bot | Current | Target Range | Gap | Biggest Gaps |
|---|---|---|---|---|
| **Calvin** | 10/80 | 15-17/80 | 5-7 pts | Position Awareness (1→2), Deck Awareness (1→2), Placement Intelligence (1→2-3) |
| **Nina** | 23/80 | 35-40/80 | 12-17 pts | Position Awareness (1→6), Setup Engineering (1→3), Opponent Awareness (1→4), Risk Threshold (1→3) |
| **Rex** | 32/80 | 50-58/80 | 18-26 pts | Position Awareness (1→8), Setup Engineering (1→5), Opponent Awareness (2→7), Risk Threshold (1→4) |

**The three universal 1/10 scores — Position Awareness, Setup Engineering,
and Risk Threshold — account for the largest share of the gap for all
bots.** These require new code paths in the evaluation pipeline, not
weight tuning.

**For Rex specifically,** Position Awareness and Setup Engineering are the
two biggest gaps to close (1→8 and 1→5). These are the doctrine's
5-layer strategic loop (5.1) and place-and-recover engineering (2.2,
3.3, 6.4). Together they represent ~11 points of Rex's 18-26 point
gap — roughly half of the Foundation engine work.

**For Nina,** Position Awareness (1→6) and Opponent Awareness (1→4) are
the biggest gaps. Nina needs to run layers 1, 4, 5 of the strategic
loop (5.1) and use personality data of opponents she's seated with.

**For Calvin,** the gap is small (5-7 points) and mostly achievable
through minor improvements to Placement Intelligence (stop placing
highest card) and basic Deck Awareness (use the tracker data his weights
currently ignore). Calvin should remain strategically weak — his
identity IS being bad — but his placement tell and zero deck awareness
are below even beginner-level play.

---

## DELIVERABLE

| File | Status |
|---|---|
| `docs/stat-card-rebaseline-2026-05-05.md` | This document |
| Doctrine reference | Notion page 3562f2662cac8134b848d59ce9f08573 |
| May 3 baseline | `docs/bot-audit-2026-05-03.md` + `docs/position-audit-2026-05-03.md` |
| Post-fix audit | `docs/coverage-audit-2026-05-04-postfix.md` (100% pass) |
