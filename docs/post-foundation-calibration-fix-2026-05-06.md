# Post-Foundation Calibration — Fix Impact (Q3 + Sibling 1 + Sibling 2 + Sibling 3)

**Track:** `FIX TRACK — Post-Foundation Calibration (Q3 + Sibling 1 + Sibling 2)` — P2, May 6 2026.
**Diagnosis ref:** `docs/post-foundation-calibration-diagnosis-2026-05-06.md`.
**Doctrine ref:** Notion `3562f2662cac8134b848d59ce9f08573` (skill point system; 7.3 tier = depth).
**Status:** All three subsystems landed. 295 of 295 tests pass. `npm run build` clean. Awaiting TC merge.

---

## Subsystem 1 — Q3: Capture Chain Threshold Generalization

### Before
`src/engine/ai/botDecision.ts:323` (pre-fix) had:
```ts
if (plan.totalPoints > bestCaptureTotal * 1.2) {
```
Hardcoded `1.2x` — same value for Rex (SE 7) and Jett (SE 8), the only two bots with `useChainEval: true`. Identical to the pre-Foundation behavior, untouched by the Jett build's awareness-scaling generalizations.

### After
New private-export helper next to `setupChainThreshold`:
```ts
// Capture-chain promotion threshold — gates whether a 2-turn capture plan
// (capture A now → capture B next turn) overrides the best single-turn
// capture. Sibling to setupChainThreshold(se) which gates place-chains;
// both derive from the same SE curve so each bot's two chain types
// behave consistently. Generalized from a hardcoded 1.2x per
// docs/post-foundation-calibration-diagnosis-2026-05-06.md.
// Exported for test surface; sibling private functions are exercised
// indirectly via decideBotAction.
export function captureChainThreshold(se: number): number {
  if (se <= 5) return 1.40;
  if (se <= 7) return 1.30;
  if (se <= 8) return 1.20;
  return 1.15;
}
```

Call site (same line area):
```ts
if (plan.totalPoints > bestCaptureTotal * captureChainThreshold(profile.setupEngineering)) {
```

### Curve, mapped to the live roster
| SE  | Threshold | Bot at this tier                                  | vs prior 1.20x         |
| --- | --------- | ------------------------------------------------- | ---------------------- |
| ≤ 5 | 1.40      | future Mira/Talia tier (placeholders)             | n/a — chain eval off   |
| 6-7 | 1.30      | **Rex (SE=7)**                                    | **+0.10 — more conservative** |
| 8   | 1.20      | **Jett (SE=8)**                                   | **unchanged — preserves prior default** |
| ≥ 9 | 1.15      | future top tiers                                  | -0.05 — more aggressive |

### Files modified
- `src/engine/ai/botDecision.ts` — added `captureChainThreshold(se)` (12 lines including doc comment); changed one call site from `* 1.2` to `* captureChainThreshold(profile.setupEngineering)`.

### Tests added (6 in `tests/engine/ai/botDecision.test.ts`)
Added a `describe('captureChainThreshold')` block after the existing decide-bot suite:
1. `returns 1.40 for SE 5 (and below)`.
2. `returns 1.30 for SE 6-7 (Rex tier)`.
3. `returns 1.20 for SE 8 (Jett tier — preserves prior default)`.
4. `returns 1.15 for SE 9 and above`.
5. `curve is monotonically non-increasing` — sweeps SE 0..10.
6. `Rex and Jett receive distinct thresholds (Rex more conservative)` — reads the live profile SE values rather than hardcoding, so it guards against future drift on either side.

### Behavioral tests (called out as skipped, not silently)
The ticket suggested two scenario tests ("Rex doesn't promote 25% chain", "Jett does promote 22% chain"). Constructing chain plans with precise ±1% margins requires hand-crafting card arrays with full knowledge of `bestSingleCapture` scoring internals — fragile, likely to break on incidental scoring changes. The curve unit tests + the existing `evaluateChainCapture` integration coverage in `tests/engine/ai/evaluator.test.ts:210-236` give the same correctness signal without the fragility.

---

## Subsystem 2 — `createGameTracker` factory + Sibling 3 doc comment

### Before
The 3-step pattern was caller-owned. Anyone setting up a tracker had to remember to do all three steps in the right order:
```ts
trackerRef.current = createCardTracker();              // step 1
for (const card of initial.board) {                    // step 2: identity for board
  trackerRef.current = recordPlacement(trackerRef.current, card);
}
trackerRef.current = seedInitialDeal(                  // step 3: counter-only for hands
  trackerRef.current,
  initial.hands.length * 4,
);
```
A future caller forgetting step 3 would silently desync the gamePhase/totalSeen counters by 12 cards — exactly the bug the audit reported (and that Foundation closed at the controller layer but not at the API layer).

### After
One factory call:
```ts
trackerRef.current = createGameTracker(initial.board);
```

The factory in `src/engine/ai/cardTracker.ts`:
```ts
const INITIAL_HAND_CARDS = 12; // 4 cards × 3 players, dealt at game start

/**
 * Convenience factory for game start. Produces a tracker that correctly
 * accounts for: initial board cards (full identity tracking) + 12 cards
 * dealt to player + 2 bot hands (counter-only, no identity tracking).
 *
 * The 12-card counter-only treatment is deliberate (doctrine Option 1):
 * the bot knows 12 cards have left the deck but NOT which cards went to
 * which opponent's hand. This prevents opponent hand info leakage while
 * keeping totalSeen / gamePhase / cardsRemaining counters accurate.
 *
 * Replaces the prior fragile caller pattern (manual createCardTracker
 * → recordPlacement loop → seedInitialDeal(12)) per
 * docs/post-foundation-calibration-diagnosis-2026-05-06.md Sibling 2.
 */
export function createGameTracker(boardCards: readonly Card[]): CardTrackerState {
  let tracker = createCardTracker();
  for (const card of boardCards) {
    tracker = recordPlacement(tracker, card);
  }
  tracker = seedInitialDeal(tracker, INITIAL_HAND_CARDS);
  return tracker;
}
```

The JSDoc above the function satisfies **Sibling 3** — Option 1 tradeoff (counter-only, no identity) is documented at the source-of-truth so a future "fix" can't silently start leaking opponent hand info.

### Files modified
- `src/engine/ai/cardTracker.ts` — added `createGameTracker` factory (~22 lines with JSDoc); named constant `INITIAL_HAND_CARDS = 12` instead of an inline literal.
- `src/game/useGameController.ts` — imported `createGameTracker`; replaced the 4-line manual sequence in the `useState` initializer with one factory call.

### Test fixture migration decision (called out)
The existing `describe('CardTracker seedInitialDeal')` tests in `src/engine/ai/__tests__/dynamicWeights.test.ts:129-171` were NOT migrated to the factory. Reason: those tests specifically exercise the **lower-level `seedInitialDeal` primitive** in isolation. Migrating them to `createGameTracker` would erase direct coverage of the underlying function. Different test scope. The factory has its own coverage block in the same file (5 new tests).

### Tests added (5 in `src/engine/ai/__tests__/dynamicWeights.test.ts`)
Added a `describe('createGameTracker')` block:
1. `with 4 board cards produces totalSeen=16, gamePhase='mid'` — happy path matching real game start.
2. `with 0 board cards still seeds the 12 dealt-hand cards` — edge case for any hypothetical no-initial-board flow.
3. `preserves identity tracking for board cards` — verifies `seenCards.has(boardCard.id)` and location `'board'`.
4. `does NOT track identity of the 12 dealt-hand cards (Option 1)` — asserts `seenCards.size === boardCards.length`. **This is the doctrine guard** — any future change that leaks opponent hand info will fail here.
5. `produces the same tracker shape as the manual 3-step pattern` — invariant ensuring the refactor was a no-op against the prior controller logic.

### Behavioral change
**None.** Pure refactor. Test #5 enforces this.

---

## Subsystem 3 — Sibling 1: Saved-game tracker persistence

### The bug
`loadGame()` returned saved game state → `useState` initializer hit `if (saved) return saved;` → both the `recordPlacement` loop and the `seedInitialDeal(12)` were skipped → tracker stayed at the bare `createCardTracker()` defaults (`totalSeen=0`, `gamePhase='early'`) regardless of how far the saved game had progressed. The tracker silently desynced from game state on every reload.

Two downstream effects (mostly latent in current code, but real):
- `seenCards` lacked history of pre-save cards → `valueCounts` undercounted → `getRemainingOfRank` overestimated remaining cards per rank, possibly biasing `selectiveDeck` info for high-DA bots after resume.
- `gamePhase` reset to `'early'` after resume → would have suppressed the `+25 jackpotValue` bonus in `scoreCapture` if a resumed game was already past 50% deck depletion. Lateness-aware decisions degraded silently.

### The fix — Option A from the diagnosis menu

**Serialize the tracker alongside the game state.** Restore on load. Backward-compat path for legacy saves rebuilds the tracker from current state with a `console.warn`.

#### New wire format (schema v2)
```ts
interface PersistedSnapshot {
  version: number;       // = 2
  game: GameState;
  tracker: PersistedTracker;
}

interface PersistedTracker {
  seenCardsEntries: Array<[string, CardLocation]>;
  valueCounts: Record<Rank, number>;
  playerCaptures: [Card[], Card[], Card[]];
  deckRemaining: number;
  totalSeen: number;
  gamePhase: GamePhase;
}
```

The internal `CardTrackerState` still uses `seenCards: Map<string, CardLocation>` — Maps don't round-trip `JSON.stringify` natively, so we convert at the persistence boundary via `toWire` / `fromWire`. **Internal tracker API unchanged.** Zero ripple beyond `persistence.ts`.

#### Public API changes
- `saveGame(state, tracker)` — second arg added.
- `loadGame()` — now returns `LoadedSave | null` where `LoadedSave = { game: GameState; tracker: CardTrackerState }`.
- `clearSavedGame()` — unchanged.

#### Backward compatibility (real, tested)
Legacy saves from pre-Sibling-1 builds are bare GameState JSON at the root (no `version` / `game` / `tracker` keys). The loader detects this shape by absence of the `game` key:
- Rebuilds a fresh tracker via `createGameTracker(state.board)` — preserves the same Foundation init pattern.
- Emits `console.warn('[persistence] Legacy save detected (no tracker field). Rebuilding tracker from board; pre-save card history is lost.')` so it's visible during playtest.
- Pre-save card capture history is lost (we can't reconstruct it from GameState alone), but the resumed game plays correctly with all counters accurate going forward.
- Existing `dumpActive` default behavior preserved on both code paths (legacy and v2).

#### Files modified
- `src/game/persistence.ts` — full rewrite. Wire format, `toWire`/`fromWire` helpers, two-arg `saveGame`, new `LoadedSave` return shape, `isValidGameShape` guard, legacy-save fallback.
- `src/game/useGameController.ts` — `useState` initializer's `if (saved)` branch now does `trackerRef.current = saved.tracker; return saved.game;`. `setAndPersist` passes `trackerRef.current` to `saveGame`.

`App.tsx` untouched. The `const hasSave = !!loadGame();` truthy check still works against the new return shape.

### Tests added/updated (8 total in `tests/game/persistence.test.ts`)
*(rewrote the file; existing 4 tests migrated to new signature + 6 net new for tracker / backward compat)*

1. *(updated)* `returns null when nothing saved`.
2. *(updated)* `saveGame + loadGame round-trip preserves game state including dumpActive` — now uses two-arg `saveGame`, asserts via `loaded.game.dumpActive`.
3. *(updated)* `clearSavedGame wipes the slot`.
4. *(new)* `round-trips tracker counters (totalSeen, deckRemaining, gamePhase)`.
5. *(new)* `round-trips seenCards entries (Map survives JSON boundary)` — explicit guard against the Map serialization gotcha.
6. *(new)* `round-trips valueCounts and playerCaptures after a recordCapture`.
7. *(new)* `legacy save (bare GameState, no version/tracker) is loadable with a fresh rebuilt tracker` — verifies the backward-compat path including the `console.warn`.
8. *(new)* `legacy save defaults dumpActive to false on the game side` — confirms backward compat doesn't break the prior B1 fix's default behavior.
9. *(new)* `rejects malformed legacy save shape` — `isValidGameShape` guard.
10. *(new)* `rejects corrupt JSON` — try/catch path.

---

## Aggregate state

| Metric                  | Before track | After track | Delta            |
| ----------------------- | ------------ | ----------- | ---------------- |
| Tests passing           | 278          | **295**     | +6 Q3, +5 S2, +6 S3 (S3 also migrated 4 existing) |
| `tsc -b`                | clean        | clean       | —                |
| `npm run build`         | clean (~425ms) | clean (~430ms) | —              |
| `botDecision.ts` hardcoded chain threshold | 1.2x literal | `captureChainThreshold(se)` | generalized |
| Caller pattern for game-start tracker | 3 manual steps | 1 factory call | hardened |
| Saved-game tracker on reload | reset to defaults (desync bug) | restored from save (Option A) | bug fixed |
| Option 1 (no opponent hand identity) | undocumented convention | doc-commented at source | guard-railed |

---

## Doctrine confirmations

- **7.3 (Tier = depth, not breadth):** Q3 capture-chain threshold now scales with `setupEngineering` per the same curve shape as `setupChainThreshold(se)`. Rex and Jett's chain calibration is now skill-derived rather than literal.
- **Skill point system (architectural rule, percentage-based thresholds):** `captureChainThreshold(se)` accepts SE values 0-10 and returns a multiplier. No hardcoded bot identities in the curve.
- **Option 1 tradeoff (no opponent hand info leakage):** documented inline on `createGameTracker` in `cardTracker.ts`. Test #4 in the factory suite asserts `seenCards.size === boardCards.length` as a runtime guard.

---

## Re-baseline assessment (Rex 1.20 → 1.30)

Rex's capture-chain threshold moved from 1.20x to 1.30x — a real conservatism bump. For chain plans whose total falls in the (1.20x, 1.30x] window above the best single capture, Rex will now choose the single. Pre-fix he would have taken the chain.

**Impact magnitude (unmeasured, estimated):**
- Chain plans in that exact 8% margin band are uncommon — most "obvious" chains land well above 1.30x, most "marginal" chains land below 1.20x. The band that flips is narrow.
- Even where it flips, Rex's overall scoring should shift only marginally. Single captures aren't bad; they're just less ambitious.

**Could narrow the Rex-vs-Nina gap:** Rex's primary differentiator vs Nina is chain commitment. Slight conservatism here could marginally reduce his observed scoring lead. Probably under 5% in head-to-head, plausibly noise-floor.

**Recommendation:** **Do not auto-trigger** a stat-card re-baseline. Two paths:
1. **Wait and watch.** Play through 5-10 games at the 300 target. If Rex feels noticeably softer or his win rate vs Nina visibly tightens, then re-baseline.
2. **Re-baseline now.** ~30 min of bot-vs-bot sims at the current measurement protocol. Lower-friction option if TC wants the numbers locked in for the launch checklist.

`docs/stat-card-rebaseline-postfoundation-2026-05-06.md` is the live baseline. The Jett build's calibration confidence was high enough that small Rex shifts shouldn't invalidate it, but explicit re-measurement is the conservative call. Flag for TC's decision, not for me.

---

## TC manual playtest checklist (pre-merge)

Run `npm run dev` → `http://localhost:8090`. Wipe localStorage first.

### Q3 (chain threshold)
1. Start a Classic game with Rex + Nina at target 300. Play 5-10 hands.
2. Look for situations where Rex has a chain plan available (you can see this in DevTools console — the AI debug log emits chain-eval evidence: "→ CHOSEN: capture <card> ... | <reasoning>").
3. Confirm Rex behaves reasonably — not visibly broken, just slightly more conservative on the marginal calls. Calvin / Nina unchanged (`useChainEval: false`). Jett unchanged (curve preserves SE=8 at 1.20x).

### Sibling 2 (factory)
4. Pure refactor, no playtest indicator beyond "game still starts and plays normally." Test #5 in `dynamicWeights.test.ts` already enforces the shape invariant.

### Sibling 1 (persistence)
5. Start a Classic game. Play 1-2 full rounds.
6. Open DevTools → Console → `JSON.parse(localStorage.getItem('stacked-v2-game'))` → should now show:
   ```json
   {
     "version": 2,
     "game": {"hands": [...], "board": [...], ...},
     "tracker": {
       "seenCardsEntries": [["id1", "board"], ...],
       "totalSeen": 16+,
       "gamePhase": "mid|late|...",
       ...
     }
   }
   ```
7. Force-reload (F5). Game resumes. Bot behavior should feel identical pre-/post-reload. **Failure mode to watch for:** a sudden lurch toward greedy raw-points play after reload would indicate the tracker is desynced to `'early'` phase — that would mean Subsystem 3 didn't take.
8. To test the legacy-save path: while game is active, run in DevTools:
   ```js
   const s = JSON.parse(localStorage.getItem('stacked-v2-game'));
   localStorage.setItem('stacked-v2-game', JSON.stringify(s.game));
   location.reload();
   ```
   You should see the warning `[persistence] Legacy save detected (no tracker field). Rebuilding tracker from board; pre-save card history is lost.` in console. Game resumes; tracker is rebuilt fresh from the board.

### Cross-fix interactions
9. Save mid-dump (force `localStorage` to a state with `dumpActive=true`) → reload → SUBMIT still disabled. (B1 fix + Sibling 1 work together — `dumpActive` survives the persistence round-trip alongside the tracker.)
10. Open `/hooks` once if mid-session settings.json edits don't appear to take. (Unrelated to this track; just a reminder from the persistence hook setup.)

---

## What this closes

- **Audit Q3** — chain threshold hardcoded. **Closed.** Skill-driven via `captureChainThreshold(se)`.
- **Audit Q4** — CardTracker initial hands. **Closed by inspection** during diagnosis (was already addressed in Foundation via `seedInitialDeal(12)`); the factory in this track hardens the pattern so it can't accidentally regress.
- **Sibling 1** — saved-game tracker desync. **Closed.** Tracker round-trips faithfully via schema v2; legacy saves degrade gracefully.
- **Sibling 2** — fragile factory pattern. **Closed.** `createGameTracker(boardCards)` is the canonical entry; manual 3-step pattern is now optional for tests that specifically exercise primitives.
- **Sibling 3** — Option 1 tradeoff doc. **Closed.** JSDoc + test #4 in the factory suite as guard-rail.

**All four `AI_AUDIT_REPORT.md` open questions resolved.**

---

## Optional follow-up (NOT in this track)

Diagnosis flagged bare multipliers at `botDecision.ts:248` (Layer 3 weight bumps inside the `layer3Reliability`-gated branch — `placementDanger * 1.3`, `boardControl * 1.2`). These are inside an already-skill-gated branch but the multipliers themselves are still bare. Lower priority; separate ticket if pursued.

---

## After this ships

1. TC reviews this doc.
2. TC runs `npm test` locally — all 295 pass.
3. TC plays through a fresh Classic game (Q3 indicator: Rex slightly more conservative on marginal chains) plus a save/reload (Sibling 1 indicator: bot behavior stable across reload).
4. TC decides on re-baseline (flag above).
5. TC commits + pushes.
6. Q3 + Q4 + Sibling 1 + Sibling 2 + Sibling 3 closed. Calibration audit fully resolved.
