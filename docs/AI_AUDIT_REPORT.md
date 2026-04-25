# STACKED AI Bot Logic Audit Report

Generated: 2026-04-25
Author: Claude Code on behalf of TC

## Executive Summary

The STACKED v2 AI is architecturally sound but strategically shallow compared to the LIVE version. The rebuild (Phaser-era) created a clean dimension-weighted scoring system that replaced the LIVE version's hand-tuned procedural personality logic. V2 is a byte-for-byte copy of the rebuild's AI code. The system works correctly — bots evaluate, score, and pick actions. But the LIVE bots played *smarter* because their decision logic was context-sensitive in ways that static weights can't express.

The single biggest gap: **the LIVE Rex had three distinct operating modes** (normal, denial, conservative) that shifted based on the scoreboard — when an opponent approached 250, Rex switched to full denial mode, doubling the weight of opponent-blocking. When Rex had a 100+ point lead, he played conservatively. V2's Rex has fixed weights that never change regardless of game state. Similarly, LIVE Nina went aggressive when behind by 75+ points, lowering her capture threshold from 25 to 10 points. V2's Nina has no score-awareness at all.

The rebuild/v2 architecture is actually *better* as a foundation — the 6-dimension weighted scoring system is more maintainable and extensible than hand-coded if/else chains. The fix isn't to revert to LIVE code, it's to add **dynamic weight modifiers** that shift based on game state, restoring the tactical adaptiveness that made LIVE bots feel dangerous.

## Three-Version Side-by-Side

### Version 1: Live (Vanilla JS)
- **Path:** `G:\Other computers\My Laptop\STACKED\js\`
- **AI architecture:** Procedural personality objects, each with its own `decide()` method, separate `CardIntelligenceSystem` class
- **Key files:** `cardIntelligence.js` (260 lines), `personalities/calvin.js` (83), `personalities/nina.js` (200), `personalities/rex.js` (342), `personalities/jett.js` (306), `personalities/mira.js` (306), `personalities/talia.js` (178), `botModal.js` (329)
- **Total AI code:** ~2,004 lines across 8 files
- **Personalities:** 6 (Calvin, Nina, Rex, Jett, Mira, Talia)

### Version 2: Rebuild (Phaser, parked)
- **Path:** `H:\Projects\STACKED-rebuild\`
- **AI architecture:** Dimension-weighted scoring engine with personality weight profiles, CardTracker state machine
- **Key files:** `src/engine/ai/evaluator.ts` (424), `src/engine/ai/botDecision.ts` (209), `src/engine/ai/cardTracker.ts` (113), `personalities/calvin.ts` (31), `personalities/nina.ts` (22), `personalities/rex.ts` (22), `src/shared/personalities.ts` (97)
- **Total AI code:** ~926 lines across 9 files
- **Personalities:** 3 active (Calvin, Nina, Rex), 6 defined in shared profiles (Calvin, Talia, Nina, Rex, Jett, Mira)
- **Improvements from Live:** Clean TypeScript rewrite, immutable state, seeded PRNG, multi-dimensional scoring instead of procedural if/else
- **Lost from Live:** Dynamic mode-switching (Rex), score-deficit aggression (Nina), phase-aware risk multipliers (CardIntelligence)

### Version 3: STACKED v2 (current)
- **Path:** `H:\Projects\STACKED-v2\`
- **AI architecture:** Identical to rebuild — same evaluator, same profiles, same weights
- **Key files:** `src/engine/ai/evaluator.ts` (425), `src/engine/ai/botDecision.ts` (210), `src/engine/ai/cardTracker.ts` (114), `personalities/calvin.ts` (32), `personalities/nina.ts` (23), `personalities/rex.ts` (23)
- **Total AI code:** ~832 lines across 8 files
- **Carried over from Rebuild:** Everything — 1:1 port
- **Lost or simplified:** `shared/personalities.ts` display profiles (6 bots) not ported; only 3 bots in v2

## Analysis by Framework Category

### 1. Decision Routing

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| Entry point | `personality.decide(hand, board, gameState)` — each personality has its own method | `decideBotAction(state, playerIndex, difficulty, tracker, prng)` | Identical to rebuild |
| Capture vs place | Personality decides internally — Rex has phases, Nina has thresholds | Generic: `evaluateAllActions()` scores both, picks highest total | Identical to rebuild |
| Candidate generation | `canCapture(handCard, board)` per hand card, inline in personality | `findAllCaptures()` + `findBestMultiSlotCapture()` from captureValidator | Identical to rebuild |
| Multi-area combos | `findMultiAreaCombos()` called by Nina/Rex directly | `findBestMultiSlotCapture()` centralized, gated by `allowMultiSlot` flag | Identical to rebuild |

### 2. Personality Differentiation

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| Implementation | Separate objects with unique `decide()` logic (83-342 lines each) | Shared evaluator + weight vectors (22-32 lines each) | Identical to rebuild |
| Calvin | Simple greedy — highest capture, lowest placement | rawPoints=1.0 only, 25% mistake rate, `preferHighestValueOnPlace` | Identical to rebuild |
| Nina | Opponent-opportunity filtering, score-deficit aggression, risk-based placement via CardIntelligence | Balanced weights, `preferSumsOnTie`, 8% mistakes | Identical to rebuild |
| Rex | Three modes (normal/denial/conservative), denial-first strategy, board-clear detection, setup-value calculation | All weights high, `useChainEval`, 2% mistakes | Identical to rebuild |
| Unique behaviors | Rex has `_getMode()` that reads scoreboard; Nina has `_isAggressive()` that reads score deficit; Nina has `_leavesOpponentBigger()` | Nina prefers sums on tie; Calvin always places highest card; Rex evaluates 2-turn chains | Identical to rebuild |

### 3. Capture Evaluation

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| Scoring | Points + denial + chain + board-clear, weighted by mode | 6 dimensions: rawPoints, chainPotential, placementDanger, opponentDenial, jackpotValue, boardControl | Identical to rebuild |
| Denial calculation | Rex: simulates opponent captures on remaining board, calculates max opponent gain | `opponentDenial`: checks if unseen cards of captured rank exist, checks sum partners, multiplied by 15 | Identical to rebuild |
| Chain awareness | Rex: counts how many remaining hand cards can still capture | Binary: `canChain ? 20 : 0` — does NOT count how many chains, just yes/no | Identical to rebuild |
| Board-clear bonus | Rex: explicit `clearsBoard` flag, +20-25 based on mode | `jackpotValue += 30` if capture clears board | Identical to rebuild |
| Future hand state | Rex `_calculateChainPotential`: counts follow-up capture opportunities | `chainPotential`: only checks if ANY follow-up exists | Identical to rebuild |

### 4. Placement Logic

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| Calvin | Places lowest point card | `preferHighestValueOnPlace: true` — **places HIGHEST card** (intentional tell, but opposite of Live) | Identical to rebuild |
| Nina | Uses CardIntelligence `calculateCaptureRisk()` — pair risk, sum risk, phase multiplier. Separates safe (<40 risk) vs dangerous, picks lowest-value safe card | `placementDanger` weight 0.7 — penalizes based on rank availability + board sum potential | Identical to rebuild |
| Rex | Simulates opponent captures on board+placed-card, scores by max opponent opportunity. Calculates setup value (does placing this card set up OUR next capture?) | Same `placementDanger` as Nina but weight 1.0. No setup-value calculation | Identical to rebuild |
| Setup plays | Rex: `_calculateSetupValue()` — checks if placing a card creates a capture for us next turn | **Not implemented in rebuild or v2** | Missing |

### 5. Card Tracking / Memory

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| System | `CardIntelligenceSystem` class — global singleton via `window.cardIntelligence` | `CardTrackerState` — immutable state object, passed to evaluator | Identical to rebuild |
| What's tracked | Cards played per value (13 value buckets), total cards dealt | Seen cards by ID + location, value counts per rank, per-player captures, deck remaining | Identical to rebuild |
| Game phase | early/mid/late/endgame by percentage of 52 cards seen | Same thresholds: <25%/25-50%/50-75%/75%+ | Identical to rebuild |
| Risk multiplier | Phase-based: early=0.8, mid=1.0, late=1.3, endgame=1.6 | **Not implemented** — game phase only affects jackpotValue dimension | Missing |
| Seeding | Controller records placements + captures. Initial board cards recorded. Initial hands NOT recorded | Same pattern — board recorded, hands not | Same gap |

### 6. Jackpot Awareness

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| Late-game bonus | CardIntelligence has endgame adaptive bonus (+10) | `jackpotValue`: +25 if not lastCapturer in late/endgame, +30 for board clear | Identical to rebuild |
| End-game logic | Rex: opponent at 250+ → denial mode (blocks all). Rex leading by 100+ → conservative mode | No score-based mode switching. Static weights regardless of scoreboard | Missing |
| Jackpot targeting | No explicit "try to be lastCapturer" logic in Live | `jackpotValue` dimension exists but Nina weights it 0.4, Rex 1.0 | Identical to rebuild |
| Placement defense | Rex: -10 jackpot in endgame when placing and not lastCapturer | `scorePlacement` includes `-10` jackpotValue in endgame if not lastCapturer | Identical to rebuild |

### 7. Difficulty Scaling

| Aspect | Live | Rebuild | v2 |
|--------|------|---------|----|
| Mechanism | Entirely different code per personality — Calvin is 83 lines of simple logic, Rex is 342 lines of sophisticated strategy | Same evaluator code for all — personality weights scale each dimension's influence | Identical to rebuild |
| Mistake injection | None in Live — each bot plays deterministically per its logic | `mistakeRate`: Calvin 25%, Nina 8%, Rex 2%. On mistake, picks randomly from top 50% of actions | Identical to rebuild |
| Feature gating | Calvin: no multi-area combos (by omission). Nina: multi-area + opponent checks. Rex: everything | Calvin: `allowMultiSlot: false`, `useChainEval: false`. Nina: multi-slot yes, chain eval no. Rex: both yes | Identical to rebuild |

## Suspected Causes of "Playing Dumb"

### HIGH IMPACT, HIGH LIKELIHOOD

**1. No dynamic weight adjustment based on scoreboard**
- **LIVE Rex** (`rex.js:270-288`): `_getMode()` checks `overallScores` and returns `'denial'` (opponent >=250), `'conservative'` (leading by 100+), or `'normal'`. The mode multiplies denial weight by 0.5x to 2x.
- **V2 Rex** (`personalities/rex.ts:4-12`): Static weights. `opponentDenial: 0.9` always. No scoreboard awareness.
- **Impact:** Rex never shifts to "block everything" mode when opponent is about to win. He plays the same at score 0 as at score 290.

**2. No score-deficit aggression for Nina**
- **LIVE Nina** (`nina.js:165-173`): `_isAggressive()` returns true when behind by 75+ points. In aggressive mode, Nina lowers capture threshold from 25 to 10 points and takes 20+ multi-area combos she'd normally skip.
- **V2 Nina** (`personalities/nina.ts:4-12`): Fixed weights. No aggression shift when losing.
- **Impact:** Nina plays too passively when behind, refusing small captures that would keep her in the game.

**3. Chain potential is binary, not graduated**
- **LIVE Rex** (`rex.js:206-221`): `_calculateChainPotential()` counts HOW MANY follow-up captures exist. Chains of 2-3 are valued at 5-8 points each in the composite score.
- **V2 evaluator** (`evaluator.ts:124-131`): `chainPotential = canChain ? 20 : 0`. Any follow-up = 20, none = 0. A hand with 3 possible chains scores the same as one with 1.
- **Impact:** Bots don't prefer setups that enable longer capture streaks.

### MEDIUM IMPACT

**4. Rex's placement setup-value calculation is missing**
- **LIVE Rex** (`rex.js:246-268`): `_calculateSetupValue()` checks if placing a card creates a capture opportunity for the NEXT turn. This is proactive strategy — place a 3 knowing you hold a 7 and there's a 4 on the board.
- **V2:** No equivalent. Placement scoring only considers danger (what opponents could capture), not opportunity (what WE could capture next).
- **Impact:** V2 Rex never makes "setup plays" — placing cards strategically to capture them later.

**5. Nina's opponent-opportunity filtering is simplified**
- **LIVE Nina** (`nina.js:142-163`): `_leavesOpponentBigger()` simulates the board after a capture and checks if any remaining card could enable an opponent capture worth MORE points. If yes, she skips that capture.
- **V2 Nina:** `opponentDenial` weight is only 0.3 — opponent-blocking is a minor factor, not a filter/gate. Nina will take a 15-point capture even if it leaves an opponent a 25-point opportunity.
- **Impact:** Nina makes captures that benefit opponents more than herself.

**6. CardIntelligence phase-aware risk multiplier is missing**
- **LIVE** (`cardIntelligence.js:238-246`): Risk multipliers by phase — early=0.8x, mid=1.0x, late=1.3x, endgame=1.6x. Bots become 60% more cautious about placements in the endgame.
- **V2:** No phase-based risk scaling. `placementDanger` is calculated the same way regardless of game phase.
- **Impact:** Bots don't tighten up placement strategy in critical late-game moments.

### LOW IMPACT

**7. Calvin placement direction is inverted**
- **LIVE Calvin** (`calvin.js:62-70`): Places **lowest** value card (saves high cards for captures).
- **V2 Calvin** (`personalities/calvin.ts:29`): `preferHighestValueOnPlace: true` — places **highest** value card. This is documented as his "tell" and is intentional design, but it means Calvin gives away high-value cards.
- **Impact:** Intentional design choice, but makes Calvin weaker than LIVE Calvin at self-preservation.

**8. LIVE had 6 bots, v2 has 3**
- Jett, Mira, and Talia provided variety. Jett was a fast Rex clone, Mira a slow Rex clone, Talia a Nina clone. The rebuild defined display profiles for all 6 but only implemented 3 engine personalities.
- **Impact:** Less variety, but not a "playing dumb" issue.

## Recommended Fix Scope

### If only ONE thing should be fixed first:
**Add dynamic weight modifiers to Rex and Nina based on scoreboard state.** This is the highest-impact change — it restores the tactical adaptiveness that made LIVE bots feel dangerous. Specifically:

- Rex: When opponent score >= 250, multiply `opponentDenial` by 2.0 and `boardControl` by 1.5 (denial mode). When Rex leads by 100+, reduce `rawPoints` to 0.5 and increase `placementDanger` to 1.5 (conservative mode).
- Nina: When behind by 75+, multiply `rawPoints` by 1.3 and reduce capture threshold logic (lower the bar for what she'll take).

This can be implemented as a `modifyWeightsForGameState()` function in `evaluator.ts` — called before `applyWeights()`, reads `overallScores` to compute modifier multipliers. ~30-40 lines of code, zero architecture changes.

### Full restoration scope:
To match LIVE bot intelligence completely:
1. Dynamic weight modifiers (as above) — ~40 lines
2. Graduated chain potential (count chains, not just binary) — ~10 lines in `scoreCapture()`
3. Rex setup-value placement scoring — ~25 lines, new helper function
4. Phase-aware placement risk multiplier — ~10 lines in `scorePlacement()`
5. Nina opponent-opportunity gating (skip captures that leave opponent bigger) — ~30 lines, new check in `decideBotAction()`

**Total estimated scope: ~115 lines of new/modified code, all within `evaluator.ts` and `botDecision.ts`.** Zero new files, zero architecture changes, zero engine state changes.

## Code Snippets — Side by Side

### Rex: Score-Based Mode Switching

**Live (rex.js:270-288):**
```js
_getMode(gameState) {
    if (!gameState || !gameState.overallScores) return 'normal';
    const botKey = gameState.currentPlayer === 1 ? 'bot1' : 'bot2';
    const myScore = gameState.overallScores[botKey] || 0;
    const opponentScores = [
      gameState.overallScores.player || 0,
      gameState.overallScores[botKey === 'bot1' ? 'bot2' : 'bot1'] || 0
    ];
    const maxOpponent = Math.max(...opponentScores);
    // Opponent near 300: denial mode
    if (maxOpponent >= 250) return 'denial';
    // Rex leads by 100+: conservative
    if ((myScore - maxOpponent) >= 100) return 'conservative';
    return 'normal';
},
```

**Rebuild / v2 (personalities/rex.ts:4-12):**
```ts
export const REX_WEIGHTS: PersonalityWeights = {
  rawPoints: 0.8,
  chainPotential: 1.0,
  placementDanger: 1.0,
  opponentDenial: 0.9,
  jackpotValue: 1.0,
  boardControl: 0.8,
  mistakeRate: 0.02,
};
// NO mode switching. These weights are static for the entire game.
```

### Rex: Composite Scoring by Mode

**Live (rex.js:223-243):**
```js
_compositeScore(points, denial, chains, clearsBoard, mode) {
    let score = points;
    if (mode === 'denial') {
      score += denial * 2;      // denial doubled
      score += chains * 8;
      score += clearsBoard ? 25 : 0;
    } else if (mode === 'conservative') {
      score += denial * 0.5;    // denial halved
      score += chains * 3;
      score += clearsBoard ? 15 : 0;
    } else {
      score += denial * 1.2;    // normal
      score += chains * 5;
      score += clearsBoard ? 20 : 0;
    }
    return score;
},
```

**v2 (evaluator.ts:85-92) — fixed weights, no mode:**
```ts
return (
  score.rawPoints * w.rawPoints +           // 0.8 always
  score.chainPotential * w.chainPotential + // 1.0 always
  score.placementDanger * w.placementDanger +
  score.opponentDenial * w.opponentDenial + // 0.9 always
  score.jackpotValue * w.jackpotValue +
  score.boardControl * w.boardControl
);
```

### Nina: Score-Deficit Aggression

**Live (nina.js:165-173):**
```js
_isAggressive(gameState) {
    if (!gameState || !gameState.overallScores) return false;
    const botKey = gameState.currentPlayer === 1 ? 'bot1' : 'bot2';
    const myScore = gameState.overallScores[botKey] || 0;
    const maxOpponent = Math.max(
      gameState.overallScores.player || 0,
      gameState.overallScores[botKey === 'bot1' ? 'bot2' : 'bot1'] || 0
    );
    return (maxOpponent - myScore) >= 75;
},
```

**v2 (personalities/nina.ts) — no equivalent:**
```ts
// Nina has no score-awareness. Her weights are fixed:
export const NINA_WEIGHTS: PersonalityWeights = {
  rawPoints: 1.0,        // same when winning or losing
  opponentDenial: 0.3,   // same when winning or losing
  // ...
};
```

### Rex: Placement Setup Value

**Live (rex.js:246-268):**
```js
_calculateSetupValue(cardToPlace, hand, board) {
    const remainingHand = hand.filter(c => c.id !== cardToPlace.id);
    const simulatedBoard = [...board, cardToPlace];
    let setupValue = 0;
    for (const hc of remainingHand) {
      const captures = canCapture(hc, simulatedBoard);
      if (captures) {
        for (const cap of captures) {
          const placedIdx = simulatedBoard.length - 1;
          if (cap.cards.includes(placedIdx)) {
            const targets = cap.targets || cap.cards.map(idx => simulatedBoard[idx]);
            const pts = [hc, ...targets].reduce((sum, c) => sum + window.getPointValue(c), 0);
            setupValue = Math.max(setupValue, pts * 0.3);
          }
        }
      }
    }
    return setupValue;
},
```

**v2: Not implemented.** `scorePlacement()` only calculates danger, not opportunity.

### Chain Potential: Binary vs Graduated

**Live (rex.js:206-221):**
```js
_calculateChainPotential(usedHandCard, capture, hand, board) {
    const remainingHand = hand.filter(c => c.id !== usedHandCard.id);
    const capturedIndices = new Set(capture.cards);
    const remainingBoard = board.filter((_, idx) => !capturedIndices.has(idx));
    let chainCount = 0;
    for (const hc of remainingHand) {
      const moreCaptures = canCapture(hc, remainingBoard);
      if (moreCaptures && moreCaptures.length > 0) chainCount++;
    }
    return chainCount; // Returns 0, 1, 2, or 3
},
```

**v2 (evaluator.ts:124-131):**
```ts
let canChain = false;
for (const h of remainingHand) {
  if (findAllCaptures(h, remainingBoard).length > 0) {
    canChain = true;
    break;  // stops at first match — doesn't count
  }
}
const chainPotential = canChain ? 20 : 0;  // binary, not graduated
```

## Open Questions for TC

1. **Calvin's placement inversion** — LIVE Calvin places lowest card, v2 Calvin places highest card. The v2 code comments this as his "tell" (intentional). Was this an intentional design decision to make Calvin more exploitable, or did the direction get swapped accidentally during the rebuild?

2. **Jett, Mira, Talia** — The rebuild defined display profiles for all 6 bots in `shared/personalities.ts` but only implemented 3 engine personalities. Was the plan to add the other 3 later, or are they permanently deferred? V2 only has 3 in the setup screen.

3. **Rex chain evaluation threshold** — V2 Rex only uses a chain plan if it's 20% better than the best single capture (`plan.totalPoints > bestCaptureTotal * 1.2`). This conservative threshold might cause Rex to ignore chain plans that are only slightly better. Was 1.2x tested, or was it a guess during the rebuild?

4. **CardTracker initialization** — Neither the LIVE nor v2 version records initial hand cards in the tracker (only board cards). This means the tracker underestimates `totalSeen` by 12 cards (4 per player) at game start. The game phase calculation thinks the game is "early" when 28% of the deck has actually been dealt. Is this intentional (bot shouldn't "know" opponent hands) or a bug?
