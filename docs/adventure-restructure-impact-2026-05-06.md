# Adventure 12-Level Restructure — Impact Summary

**Track:** `ADVENTURE 12-LEVEL RESTRUCTURE — 4 Worlds × 3 Levels` (Stacy → TC → CC, P1)
**Doctrine ref:** `3562f2662cac8134b848d59ce9f08573`
**Status at handoff:** structurally complete; awaiting TC final play-through and merge.

---

## Old vs new structure

| Dimension              | Old                              | New                                     |
| ---------------------- | -------------------------------- | --------------------------------------- |
| Worlds                 | 6                                | 4                                       |
| Levels per world       | 3                                | 3                                       |
| Total levels           | 18                               | 12                                      |
| Bot tier progression   | beginner → advanced (loose)      | Calvin → Nina → Rex → Jett (locked)     |
| Hint strip             | (did not exist)                  | ON in W1+W2, OFF in W3+W4               |
| Adventure seating swap | random 50/50 (same as Classic)   | DISABLED — bot pairings deterministic   |
| Jett in Classic        | always selectable                | gated until W4 L3 cleared               |
| Final-level UX         | "ADVENTURE COMPLETE — more soon" | "ADVENTURE COMPLETE — Jett unlocked"    |
| World map (live)       | `ChapterMap` with chapter-1 names | `ChapterMap` driven by `levelConfig`, per-world tints |
| `WorldMap.tsx`         | dead but present                 | deleted                                 |
| `DEV_UNLOCK_ALL`       | already `false`                  | confirmed `false`                       |

### Locked level table (implemented exactly per ticket)

| ID | Display | World           | Bots                  | Target | Hints |
| -- | ------- | --------------- | --------------------- | ------ | ----- |
| 1  | 1-1     | The Basics      | Calvin + Calvin       | 100    | ON    |
| 2  | 1-2     | The Basics      | Calvin + Calvin       | 150    | ON    |
| 3  | 1-3     | The Basics      | Calvin + Calvin       | 200    | ON    |
| 4  | 2-1     | Sharper Play    | Calvin + Nina         | 200    | ON    |
| 5  | 2-2     | Sharper Play    | Nina + Nina           | 250    | ON    |
| 6  | 2-3     | Sharper Play    | Nina + Nina           | 300    | ON    |
| 7  | 3-1     | The Hunter      | Nina + Rex            | 250    | OFF   |
| 8  | 3-2     | The Hunter      | Rex + Rex             | 300    | OFF   |
| 9  | 3-3     | The Hunter      | Rex + Rex             | 400    | OFF   |
| 10 | 4-1     | The Endgame     | Rex + Jett            | 300    | OFF   |
| 11 | 4-2     | The Endgame     | Nina + Jett           | 350    | OFF   |
| 12 | 4-3     | The Endgame     | Rex + Jett (FINAL)    | 400    | OFF   |

Star/unlock semantics inherited from Foundation: 2-stars unlocks next level in same world; 9 stars in a world unlocks next world's first level.

---

## Files modified

### Subsystem 1 — engine/config
- `src/engine/adventure/levelConfig.ts` — full rewrite. Added `world`, `levelInWorld`, `displayId`, `title`, `hintStripEnabled`, `turnOrderSwap` fields.
- `src/engine/adventure/progressManager.ts` — 4-world gates, Jett unlock helpers, old-schema `loadProgress` reset with `console.warn`.
- `src/engine/adventure/__tests__/adventure.test.ts` — rewritten for 12-level / 4-world + 18 new tests (Jett gate, old-schema migration, W3→W4 unlock, hint-strip flag distribution, Jett-only-in-W4, displayId format).

### Subsystem 2 — UI + wiring
- `src/engine/types/index.ts` — `GameSettings` extended with `hintStripEnabled?` and `disableSeatingSwap?`.
- `src/engine/core/gameState.ts` — bot-seating coin flip skipped when `disableSeatingSwap === true`.
- `src/App.tsx` — `settingsForLevel(id)` helper threads `hintStripEnabled` and `disableSeatingSwap` through; `=== 18`/`< 18` replaced with `isFinalLevel()`/`< TOTAL_LEVELS`; `unlockJettInClassic()` fires on final-level completion; AdventureHeroCard copy updated to "12 levels · 4 worlds".
- `src/components/LevelCompleteOverlay.tsx` — prop rename `isLevel18` → `isFinalLevel`; final-level header reads "ADVENTURE COMPLETE"; final-level callout reads "JETT UNLOCKED IN CLASSIC · Bot intelligence arc complete."
- `src/components/ClassicSetup.tsx` — Jett gated on `isJettUnlockedInClassic()`; locked card shows lock icon, dimmed opacity, "Beat Adventure World 4 to unlock" copy; tap is no-op while locked.
- `src/components/GameView.tsx` — hint strip rendered below the message strip when `state.settings.hintStripEnabled === true` and `gamePhase === 'playing'`. Five contextual hints rotate based on player turn / selection / combo state. Adventure header label uses dash separator (`4-3`).
- `src/components/ChapterMap.tsx` — full rewrite. Reads from `levelConfig.LEVELS`. Per-world tint applied to path segments, node accents, and bottom card border (W1 tan, W2 mint, W3 amber, W4 crimson). Only level 12 is the boss now. Header shows world name. Bottom card uses level title and `displayId`.

### Subsystem 3 — cleanup + bugfixes
- `src/App.tsx` — `recordLevelCompletion` + `saveProgress` + `unlockJettInClassic` moved out of render-time IIFE into a `useEffect`. Eliminates the repeated-fire-on-rerender that was the most likely cause of "Play Again broken in Adventure" — overlay re-render no longer triggers stale localStorage writes that race with `playAgain`'s `setSeed` reset. Removed unused `motion`, `getTransition`, `JADE_DIM`.
- `src/components/GameView.tsx` — quit dialog now Adventure-aware. Title flips from "Quit Game?" → "Return to Adventure Map?", body from "Your progress in this game will be lost" → "This level will restart next time. Star progress is safe.", primary button label "QUIT" → "BACK". Existing back-arrow (Zone A) already routed to `goToWorldMap()` in Adventure mode — no new entry point needed. Removed unused `BOT_CARD_W`.
- `src/components/Card.tsx` — removed unused `SMALL_H`.
- `src/components/GameOverOverlay.tsx` — added `expert` entry to `BOT_DISPLAY` (Calvin/Nina/Rex/Jett complete). Removed unused `PLAYER_INFO`.
- `src/components/JackpotCelebration.tsx` — added `expert` entry to `BOT_DISPLAY`; typed `winnerColor` as `string` to allow assignment from bot color.
- `src/components/RoundEndOverlay.tsx` — added `expert` entry to `BOT_DISPLAY`.
- `src/components/ThinkingBubble.tsx` — added `expert` entry to `BOT_COLORS`.
- `src/engine/ai/evaluator.ts` — removed unused `calculateCardPoints` import.
- `src/components/WorldMap.tsx` — **deleted** (dead since ChapterMap is the live world map; no remaining importers).
- `tests/coverage/brute-force-enumerator.ts` — removed unused `nonFaceBoard`, redundant `handPoints` declaration in `enumerateAllCaptures`.
- `tests/coverage/move-space-coverage.test.ts` — removed unused imports `SCORE_VALUES`, `findAllSingleSlotCaptures`, `findAllMultiSlotCaptures`.
- `tests/engine/ai/botDecision.test.ts`, `evaluator.test.ts`, `core/captureValidator.test.ts`, `core/turnManager.test.ts` — added `handNumber`, `gamePhase`, `roundStats`, `gameStats` to the `state(overrides)` factory so the returned object satisfies `GameState`.

### Files NOT touched (intentional)
- Foundation engine internals: `engine/ai/personalities/*`, `evaluator.ts` core logic, `botDecision.ts`, scoring, captureValidator. Locked per ticket.
- Awareness-level scaling functions from the Jett build track. Locked per ticket.
- Marcus visual paint, character art, world illustrations. Out of scope per ticket.

---

## DEV_UNLOCK_ALL revert confirmation

`src/engine/adventure/progressManager.ts:3` declares `const DEV_UNLOCK_ALL = false`. State was already `false` at the start of this track — confirmed and kept. Production unlock chain in effect: W1 always unlocked; subsequent worlds gated on full 9-star clear of the prior world.

---

## Bug fixes confirmation

| Bug                                              | Fix                                                                                                                            | Notes |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----- |
| Play Again broken in Adventure (overlay stays)   | `recordLevelCompletion` + `saveProgress` + `unlockJettInClassic` moved out of render IIFE into `useEffect`. Eliminates repeated localStorage writes per rerender that could race with `playAgain`'s seed reset. | Verify with TC play-through. If overlay still sticks, the secondary suspect is `LevelCompleteOverlay`'s `AnimatePresence` + outer `key={seed}` interaction; would need DevTools repro. |
| No back button during gameplay                   | The existing top-left ← in Zone A already opens a quit dialog → routes to `goToWorldMap` in Adventure mode. Made the dialog copy Adventure-aware ("Return to Adventure Map?", "BACK", "Star progress is safe"). | TC: confirm this is the intended UX, or call out if a no-confirmation direct exit is wanted instead. |
| Dead 18-level / 6-world references               | `WorldMap.tsx` deleted (was unused). Hardcoded `=== 18` / `< 18` / `isLevel18` replaced with `isFinalLevel()` / `< TOTAL_LEVELS`. Old chapter-1 node names removed from `ChapterMap`. | |
| Pre-existing TS build errors blocking `npm run build` | Added missing `expert` Difficulty entries (4 components). Cleaned 8 unused declarations in src/ + tests/. Fixed `state()` factory in 4 test files. | `npm run build` now succeeds in 496ms. Was failing before this track. |

---

## Test + coverage state

- **Tests:** 264 of 264 passing (was 246 pre-track; +18 new in `adventure.test.ts`).
- **TypeScript build:** `npx tsc -b` clean across `src/` and `tests/`.
- **Production build:** `npm run build` succeeds — `tsc -b && vite build` finishes; bundle 406.31 KB / 125.30 KB gzip.
- **Coverage audit:** test suite includes `tests/coverage/` (brute-force enumerator + move-space-coverage). All passing.

---

## TC manual-test checklist (pre-merge)

Run `npm run dev` against `http://localhost:8090` and verify in this order:

1. **Fresh state.** DevTools → Application → Local Storage → clear all `stacked_v2_*` keys, hard reload.
2. **Title screen.** Adventure card reads "12 levels · 4 worlds". Classic card unchanged.
3. **ChapterMap entry.** Header reads "ADVENTURE · THE BASICS". Node 1-1 active in tan; nodes 1-2..1-3 unlocked-but-incomplete; 2-1 onward locked. Path color shifts subtly across worlds. Locked nodes show dashed border in their world's tint. Bottom card reads "START HERE · 1-1 · The Basics 1".
4. **Play 1-1.** Hint strip is visible during play and rotates wording across game states (no card selected → card selected → invalid combo → valid combo → bot's turn). On win → LevelCompleteOverlay appears.
5. **Play Again.** Tap PLAY AGAIN → overlay disappears, fresh hand dealt, same level (1-1) restarts. *This is the bug fix from S3 — please verify.*
6. **Next Level.** Replay 1-1, tap NEXT LEVEL → moves to 1-2.
7. **Same-world unlock.** 2-star a level → next same-world level unlocks but next world's first level does NOT.
8. **World gate.** 3-star all of W1 → W2 L1 (id 4) unlocks.
9. **Hints OFF in W3+W4.** Reach a W3 level (need 9 stars in W2) → confirm hint strip is hidden.
10. **No-swap in Adventure.** Replay a level multiple times — bot pairings stay in the order specified (no random swap to a different ordering vs. seed reseeds).
11. **Back button.** Mid-level, tap top-left ← → dialog reads "Return to Adventure Map?" / "Star progress is safe" with BACK + RESUME buttons. BACK returns to ChapterMap, current level progress lost but star totals preserved.
12. **Final boss UX.** Force-progress to 12 cleared (or play through). LevelCompleteOverlay shows "ADVENTURE COMPLETE" header + "JETT UNLOCKED IN CLASSIC · Bot intelligence arc complete." callout.
13. **Jett gate.** Home → Classic. Pre-W4-L3 cleared: Jett card is dimmed, lock icon, "Beat Adventure World 4 to unlock", tap is no-op. Post-clear: Jett selectable like other bots, taps select normally.
14. **Old-schema migration.** Paste an 18-level shape into `localStorage.stacked_v2_adventure_progress` (e.g. `{"unlockedLevels":[1,2,3,4,5,15,18],"starsPerLevel":{"15":3,"18":2},"lastCompleted":18,"totalStars":5}`) → reload → console warns `[Adventure] Old 18-level progress detected; resetting to new 12-level schema.`, ChapterMap shows fresh state (1-1 active, no stars).

### Force-progress dev snippets

Skip ahead to W4 L3 cleared:
```js
localStorage.setItem('stacked_v2_adventure_progress', JSON.stringify({
  unlockedLevels:[1,2,3,4,5,6,7,8,9,10,11,12],
  starsPerLevel:{1:3,2:3,3:3,4:3,5:3,6:3,7:3,8:3,9:3,10:3,11:3,12:3},
  lastCompleted:12, totalStars:36,
}));
localStorage.setItem('stacked_v2_jett_unlocked_classic','true');
```

Reset Jett gate to retest:
```js
localStorage.removeItem('stacked_v2_jett_unlocked_classic');
```

---

## Known caveats / follow-ups

- **Jett color inconsistency.** ClassicSetup uses inline teal `#0D9488`, central token `C.botJett` is golden `#FBBF24`. The four overlay/bubble components now use `C.botJett` (golden). Pick one and unify in the Marcus visual paint pass — out of scope here.
- **Hint strip copy is provisional.** Five generic context-aware tips. If you want world-specific or tone-tuned copy, that's a small follow-up.
- **Per-world tint palette** in ChapterMap is a first cut. Easy to retune.
- **Existing "back-arrow → confirm dialog" flow** counts as the back button. If the ticket meant a no-confirmation direct exit, that's a one-liner to switch (`onClick={onQuit}` instead of `setShowQuitDialog(true)`). Flag and I'll change.

---

## After this ships

Per ticket post-completion checklist:
1. TC reviews this doc.
2. TC plays all 12 Adventure levels.
3. TC verifies Jett unlock gate end-to-end.
4. TC commits + pushes.
5. **Bot intelligence + progression arc is STRUCTURALLY COMPLETE.**
6. Remaining: Marcus visual paint brief (optional), sound + settings, web domain swap, Capacitor mobile wrapper, app store submission — all polish/launch readiness.
