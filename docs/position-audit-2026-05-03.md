# Bot Position & Stat Card Audit — May 3, 2026

Auditor: Claude Code on behalf of TC  
Codebase: H:\Projects\STACKED-v2 (commit b85a627)

---

## PART A — TURN ORDER & POSITION MECHANICS

### 1. TURN ORDER MECHANICS

**Turn sequence:** Player (index 0) → Bot1 (index 1) → Bot2 (index 2) → Player → Bot1 → Bot2 → ... Rotation is `(currentPlayer + 1) % 3`.

**Exception — capture continues:** If a player captures, their turn continues (they go again). If they place, the turn passes to the next player in rotation. This is determined in `determineTurnResult()` at `turnManager.ts:52-60`:
```typescript
const skipCurrent = state.lastAction === 'place';
const next = findNextPlayerWithCards(state, skipCurrent);
```

**Round start:** Turn order is NOT locked to player-first. The starting player is `(currentDealer + 1) % 3`. The dealer is randomized at game start (`prng.nextInt(0, 2)` at `gameState.ts:86`) and rotates each round (`(currentDealer + 1) % 3` at `gameState.ts:262`). So a bot CAN start the game or a round.

**New hand deal (mid-round):** When all hands are empty and deck has >= 12 cards, a new hand is dealt. The starting player depends on the last action:
- If last action was 'place': starting player = `(currentPlayer + 1) % 3` (skip the placer)
- If last action was 'capture': starting player = `currentPlayer` (capturer continues)

Code: `turnManager.ts:63-68`

**File:** `src/engine/core/turnManager.ts` (findNextPlayerWithCards, determineTurnResult)  
**File:** `src/engine/core/gameState.ts` (createInitialState, startNewRound, dealNewHand)

### 2. POSITION SLOT DEFINITIONS

**Level config uses an array:** `bots: [Difficulty, Difficulty]` at `levelConfig.ts`. `bots[0]` maps to `bot1Personality` in GameSettings, `bots[1]` maps to `bot2Personality`. Bot1 is always player index 1, Bot2 is always player index 2.

**However:** At game start, `createInitialState()` at `gameState.ts:69-72` does a seeded 50/50 coin flip:
```typescript
const swapBots = prng.next() < 0.5;
const finalSettings = swapBots
  ? { ...settings, bot1Personality: settings.bot2Personality, bot2Personality: settings.bot1Personality }
  : settings;
```
So config `bots[0]` does NOT always end up in position 1. The swap randomizes which bot plays in which seat each game.

**Config array order → turn order:** Yes, after the potential swap, `bot1Personality` (index 1) always plays before `bot2Personality` (index 2) in the rotation. But WHICH personality ends up in which index is randomized.

### 3. WHO PLAYS FIRST IN THE GAME

**The player does NOT always play first.** The starting player is determined by:
```typescript
const currentDealer = prng.nextInt(0, 2) as PlayerIndex; // random 0, 1, or 2
const currentPlayer = ((currentDealer + 1) % 3) as PlayerIndex;
```
At `gameState.ts:86-87`.

If `currentDealer = 2`, then `currentPlayer = 0` (player starts).  
If `currentDealer = 0`, then `currentPlayer = 1` (bot1 starts).  
If `currentDealer = 1`, then `currentPlayer = 2` (bot2 starts).

In the controller (`useGameController.ts:294-297`), if a bot starts:
```typescript
if (state.currentPlayer !== 0 && !botBusyRef.current && !gameOver) {
  void runBotTurn(state);
}
```
The bot runs its turn immediately on mount.

### 4. JACKPOT / LAST COMBO TAKES ALL

**Recipient:** The last player to make ANY capture in the round. Stored as `state.lastCapturer: PlayerIndex | null`.

**Set on every capture:** `gameState.ts:196`:
```typescript
lastCapturer: state.currentPlayer,
```

**Used at round end:** `applyJackpot()` at `gameState.ts:223-244`:
```typescript
if (state.lastCapturer === null || state.board.length === 0) {
  return { state, jackpotResult: null };
}
const player = state.lastCapturer;
const points = calculateCardsPoints(state.board);
```
All remaining board cards are scored and awarded to `lastCapturer`.

**Does turn position affect jackpot likelihood?** Yes, structurally:
- The player who acts LAST before the round ends has more opportunities to be the lastCapturer
- If Bot2 (index 2) captures on the final turn before all hands empty, Bot2 gets the jackpot
- There is no "jackpot targeting" logic that specifically tries to be the last capturer... EXCEPT:
  - Rex's `jackpotValue` weight is 1.0 — in late/endgame, captures that make Rex the lastCapturer get +25 bonus (`evaluator.ts:148-156`)
  - Nina's `jackpotValue` weight is 0.4 (weaker incentive)
  - Calvin's `jackpotValue` weight is 0.0 (ignores jackpot entirely)

### 5. UI POSITION VS LOGICAL POSITION

**Current layout:** The gameplay screen (GameView.tsx) renders Bot1 and Bot2 as side-by-side zones (Zones C and D). Bot1 is on the LEFT, Bot2 is on the RIGHT.

**Logical position:** Bot1 (index 1) always plays before Bot2 (index 2) in the rotation. So the LEFT bot always plays before the RIGHT bot. There is no divergence between visual order and turn order.

**Player position:** The player (index 0) plays BEFORE both bots in the rotation (0 → 1 → 2 → 0). The player's zone is at the BOTTOM of the screen (Zone G+H). So visual top-to-bottom roughly mirrors the turn order: player (bottom) → left bot → right bot.

---

## PART B — INFORMATION FLOW & BOT POSITION-AWARENESS

### 6. INFORMATION ASYMMETRY

**When a bot captures, do other bots see it?**
Yes. The capture modifies `state.board` (removes captured cards) and `state.hands` (removes hand card). The next bot receives the UPDATED state via `advanceRef.current(next)` → `runBotTurn(next)` at `useGameController.ts:277-289`. The `next` state includes the modified board.

The CardTracker (`trackerRef.current`) is also updated on each capture:
```typescript
trackerRef.current = recordCapture(trackerRef.current, player, decision.captureDetails.capturedCards);
```
At `useGameController.ts:260-263`. ALL subsequent bot turns read from the same shared trackerRef.

**When the player places a card, does the bot see it?**
Yes. `placeCard()` adds the card to `state.board`. The bot's turn receives this updated state. The card is visible on the board when the bot evaluates its options.

**Does Calvin's "highest card tell" leak information?**
**No systemic effect.** Calvin's placement preference (`preferHighestValueOnPlace: true`) causes him to place his highest-value card. This card appears on the board. The next bot sees it and can capture it if possible. But there is no code in any bot's decision logic that says "Calvin just placed, so this card is probably high value" or "the player before me tends to place X." The bots evaluate the board state purely — they don't model opponent tendencies.

### 7. POSITION-AWARE DECISION LOGIC

**Does any bot factor in WHERE they sit in the turn order?**
No. The `evaluateAllActions()` function at `evaluator.ts:327-403` receives `state` and `playerIndex` but never checks what `playerIndex` is relative to other players. It does not know or care whether it plays 1st, 2nd, or 3rd.

**Does any bot factor in WHO played immediately before them?**
No. There is no reference to `(playerIndex - 1) % 3` or any "previous player" concept in the evaluator or botDecision code.

**Does any bot factor in WHO will play after them?**
No. There is no reference to `(playerIndex + 1) % 3` or any "next player" concept. The `opponentDenial` dimension (evaluator.ts:133-146) estimates what "opponents" could do with remaining deck composition, but treats all opponents identically — it does not distinguish between the player and the other bot, or between "plays next" and "plays two turns from now."

**Does any bot evaluate captures differently based on who enabled them?**
No. The evaluator sees the current board. It does not know whether a card was placed by the player, by the other bot, or was part of the initial deal.

**Does any bot evaluate placements differently based on the next player?**
No. The `scorePlacement()` function (evaluator.ts:181-231) estimates danger by checking what ranks remain in the deck. It does NOT check who plays next or weight differently based on whether the next player is human or bot, aggressive or passive.

**Confirming:** All three bots are completely position-blind. There is zero code in the decision pipeline that considers turn-order context.

### 8. INFORMATION CARRIED BETWEEN TURNS

**Does the engine track what each player placed on each turn?**
No per-turn history. `state.lastAction` records only the most recent action type ('capture' | 'place' | null) — not WHICH card was placed or by whom. It's overwritten each action.

**Does the engine track what each player captured on each turn?**
No per-turn history. `state.lastCapturer` records only WHO captured most recently — not what they captured. The `lastCapture` info (LastCaptureInfo) is stored in React state in the controller (`useGameController.ts:104`), not in the engine GameState. It's used for UI display only and is not passed to bot decision logic.

**Is any history accessible to bot decision logic?**
The CardTracker (`cardTracker.ts`) accumulates:
- `seenCards: Map<string, CardLocation>` — every card ID and where it was last seen
- `valueCounts: Record<Rank, number>` — how many of each rank have been observed
- `playerCaptures: [Card[], Card[], Card[]]` — all captured cards per player

This IS passed to `evaluateAllActions()` as the `tracker` parameter. So bots DO have aggregate history — they know what ranks have been played and roughly what's left in the deck. But they do NOT have per-turn move history ("on turn 3, the player placed a 7").

**Each bot turn evaluated from scratch?**
Mostly yes. The evaluator scores all legal moves from the CURRENT board + hand state. It uses the CardTracker for deck composition estimates but has no memory of the sequence of recent moves.

### 9. COMBO BLOCKING / STRATEGIC PLACEMENT

**Does placement evaluation consider what the next player can do?**
Partially, but NOT next-player-specific. The `scorePlacement()` function (evaluator.ts:181-231) calculates danger by:

1. Checking if any unseen cards of the same rank exist (opponent could pair it)
2. Checking if any unseen higher-value card + existing board cards could sum to capture the placed card

```typescript
for (const rank of RANKS) {
    const remaining = getRemainingOfRank(tracker, rank);
    if (remaining === 0) continue;
    if (rank === handCard.rank) { danger += SCORE_VALUES[rank]; continue; }
    // ... sum checks ...
}
```

This estimates danger from ANY opponent, not specifically the NEXT player. It does not check whether the next player is Calvin (who won't see the danger) or Rex (who will exploit it).

**Does any bot avoid placements that enable combos?**
Yes, via the danger score above. Higher danger = lower placement score = less likely to be chosen. But the avoidance is statistical (how many unseen cards could capture this?) not strategic (who specifically benefits?).

**Does any bot block the player's capture options?**
Not intentionally. The `opponentDenial` dimension in `scoreCapture()` (evaluator.ts:133-146) rewards capturing cards that opponents COULD have used. But this is about taking cards OFF the board that opponents might want — not about placing cards that block future captures.

### 10. CAPTURE OPPORTUNITY EROSION

**Can bots dramatically reshape the board between player turns?**
Yes. In a 1v2 game, two bot turns happen between player turns. Each bot can:
- Capture cards (removing them from the board)
- Place cards (adding them to the board)
- Chain multiple captures if they keep capturing

A bot that captures 3 cards and places 1 removes a net 2 cards from the board. Two bots in sequence can remove 4+ cards. The board the player sees on their next turn can be substantially different from what they saw at the end of their previous turn.

**Code walkthrough:** After the player acts, `advanceRef.current(next)` calls `determineTurnResult()`. If CONTINUE_TURN, the controller calls `runBotTurn(next)` at `useGameController.ts:123`. The bot modifies state (capture or place), persists it, then calls `advanceRef.current(next)` again — which may trigger the NEXT bot's turn. Both bots run sequentially before the player's next turn comes up.

### 11. POSITIONAL EFFECTS IN BOT DECISION LOGIC

**Do bots evaluate differently based on position?**
No. The evaluator receives `(state, playerIndex, tracker, weights)` and never references playerIndex relative to other players. A bot at index 1 and a bot at index 2 with the same personality weights would make identical decisions given the same board state.

**Does "last to act" play differently?**
No position-based aggression/defense adjustment exists. The only game-phase-based adjustment is `modifyWeightsForGameState()` which reads SCORES (how far ahead/behind), not POSITION (who acts when).

### 12. MULTIPLE-BOT INTERACTIONS

**Do bots see each other as opponents?**
Yes — identically to how they see the player. The `opponentDenial` calculation at evaluator.ts:133-146 uses `estimateDeckComposition(tracker)` to check what ANY opponent could do. It does not distinguish between "the human player" and "the other bot." The `opponentIndices` in `modifyWeightsForGameState()` (evaluator.ts:422) filters out the current bot but treats both remaining players equally:
```typescript
const opponentIndices = ([0, 1, 2] as PlayerIndex[]).filter((i) => i !== playerIndex);
const maxOpponent = Math.max(...opponentIndices.map((i) => state.overallScores[SCORE_KEYS[i]]));
```

**Does Bot1 avoid setting up Bot2?**
Not specifically. Bot1's placement danger score considers what ANY opponent could do with the placed card, which includes Bot2. But it doesn't specifically model "Bot2 is Rex and will definitely exploit this" vs "Bot2 is Calvin and probably won't notice."

**Does Bot1 steal Bot2's setups?**
Not intentionally. If Bot2 placed a card hoping to capture it later, Bot1 might capture it first — but only because Bot1's evaluation found a high-scoring capture, not because it identified Bot2's intent.

**Bots are opponent-aware only of aggregate "all opponents," not position-aware of specific opponents.**

---

## PART C — CURRENT STAT CARDS

### CALVIN

| Attribute | Score | Justification |
|-----------|-------|--------------|
| **Capture Aggression** | 3/10 | Scans for pairs and single sums via shared `findAllCaptures()`. No multi-slot (`allowMultiSlot: false`). No chain eval. `rawPoints: 1.0` means he takes whatever scores highest. 25% mistake rate randomly downgrades picks. File: `personalities/calvin.ts`, `evaluator.ts:327-403` |
| **Risk Threshold** | 1/10 | No minimum capture threshold exists. Calvin takes any capture that scores higher than placing, even a 5-point pair. No percentage-based gate. File: `evaluator.ts:327-403` (no threshold code) |
| **Placement Intelligence** | 1/10 | `placementDanger: 0.1` means danger is weighted at 10% — nearly ignored. Plus `preferHighestValueOnPlace: true` OVERRIDES danger scoring entirely, forcing Calvin to place his highest-value card. File: `botDecision.ts:195-206`, `evaluator.ts:451-463` |
| **Position Awareness** | 1/10 | Zero position-aware code exists anywhere in the decision pipeline. Calvin does not know or care who plays before or after him. File: `evaluator.ts` (no playerIndex-relative logic) |
| **Setup & Bait** | 1/10 | No setup-value calculation exists. Calvin does not consider whether placing a card creates a capture opportunity for himself on a future turn. File: `evaluator.ts:181-231` (placement only measures danger, not opportunity) |
| **Pressure Handling** | 1/10 | Calvin has no dynamic weight modifier. `modifyWeightsForGameState()` returns base weights unchanged for `'beginner'`. Calvin plays identically whether winning by 200 or losing by 200. File: `evaluator.ts:419` |
| **Adaptability** | 1/10 | Zero opponent modeling. Calvin does not track opponent tendencies, adjust to observed patterns, or change strategy based on who he's facing. Each turn is evaluated from scratch against current board state. File: all evaluator code — no opponent-behavioral tracking |

### NINA

| Attribute | Score | Justification |
|-----------|-------|--------------|
| **Capture Aggression** | 6/10 | Scans pairs, sums, AND multi-slot captures (`allowMultiSlot: true`). No chain eval (`useChainEval: false`). `preferSumsOnTie: true` breaks ties toward sums (botDecision.ts:77-87). 8% mistake rate. File: `personalities/nina.ts`, `evaluator.ts:360-389` |
| **Risk Threshold** | 1/10 | Same as Calvin — no minimum capture value threshold exists in the code. Nina takes any capture that outscores placement. File: `evaluator.ts:327-403` |
| **Placement Intelligence** | 5/10 | `placementDanger: 0.7` — moderately weighs danger. Checks pair risk and sum risk via deck composition estimates. Does NOT check what the specific next player would do, just statistical danger from "any opponent." No `preferHighestValueOnPlace`. File: `evaluator.ts:181-231` |
| **Position Awareness** | 1/10 | Zero position-aware code. Same finding as Calvin. File: `evaluator.ts` |
| **Setup & Bait** | 1/10 | No setup-value calculation. Same gap as Calvin. File: `evaluator.ts:181-231` |
| **Pressure Handling** | 4/10 | Nina has ONE dynamic modifier: aggressive mode triggers when behind by >= 15% of targetScore. Boosts `rawPoints: 1.3`, `opponentDenial: 0.5`, `placementDanger: 0.5`. This makes her take more risks when trailing. But she has NO conservative mode when leading. File: `evaluator.ts:437-442` |
| **Adaptability** | 1/10 | Zero opponent modeling. Same as Calvin — no tracking of opponent behavior patterns. File: all evaluator code |

### REX

| Attribute | Score | Justification |
|-----------|-------|--------------|
| **Capture Aggression** | 8/10 | Scans pairs, sums, multi-slot captures, AND 2-turn chain captures (`useChainEval: true`). Chain eval tries all hand cards as first capture, simulates resulting board, tries remaining hand for second capture. Only plays chain if 20% better than best single (`plan.totalPoints > bestCaptureTotal * 1.2`). 2% mistake rate. File: `personalities/rex.ts`, `evaluator.ts:260-304`, `botDecision.ts:161-182` |
| **Risk Threshold** | 1/10 | Same as others — no minimum capture value threshold. Rex takes any net-positive capture. File: `evaluator.ts:327-403` |
| **Placement Intelligence** | 6/10 | `placementDanger: 1.0` — fully weighs danger. Considers pair risk, sum risk via deck composition. Additionally, in endgame when not lastCapturer, adds `-10` jackpot penalty to placements (evaluator.ts:218-221). Still does NOT check next-player identity. File: `evaluator.ts:181-231` |
| **Position Awareness** | 1/10 | Zero position-aware code. Same finding as all bots. File: `evaluator.ts` |
| **Setup & Bait** | 1/10 | Rex's chain eval (evaluator.ts:260-304) plans 2-turn CAPTURE sequences but does NOT engineer placements. He cannot "plant a card to capture it next turn." Setup-value was identified as a gap in docs/AI_AUDIT_REPORT.md. File: `evaluator.ts:181-231` (no setup logic) |
| **Pressure Handling** | 7/10 | Rex has TWO dynamic modifiers: (1) Denial mode when any opponent >= 50% of target — doubles `opponentDenial` to 1.8, boosts `boardControl` to 1.2. (2) Conservative mode when leading by >= 20% of target — halves `rawPoints` to 0.5, boosts `placementDanger` to 1.5, halves `opponentDenial` to 0.45. File: `evaluator.ts:425-435` |
| **Adaptability** | 2/10 | Rex's dynamic weight modifiers respond to the SCOREBOARD (who's winning) but not to opponent BEHAVIOR. He does not track whether an opponent tends to place low cards, chase pairs, or hold face cards. The scoreboard response is the only adaptation. File: `evaluator.ts:413-449` |

---

## STAT CARD SUMMARY

| Attribute | Calvin | Nina | Rex |
|-----------|--------|------|-----|
| Capture Aggression | 3 | 6 | 8 |
| Risk Threshold | 1 | 1 | 1 |
| Placement Intelligence | 1 | 5 | 6 |
| Position Awareness | 1 | 1 | 1 |
| Setup & Bait | 1 | 1 | 1 |
| Pressure Handling | 1 | 4 | 7 |
| Adaptability | 1 | 1 | 2 |
| **TOTAL** | **9/70** | **19/70** | **26/70** |

Key observation: Position Awareness (1/10 for all), Setup & Bait (1/10 for all), and Risk Threshold (1/10 for all) are universal gaps — not personality differentiation issues but architectural gaps in the evaluation pipeline. These would need new code paths, not weight tuning, to improve.
