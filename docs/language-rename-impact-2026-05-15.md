# Language Rename Pass — Impact

**Track:** `BUILD — Language Rename Pass (Adventure → The Run, Jackpot → Take the Table)` — P2, May 15 2026.
**Source of truth (spec):** Notion `3612f2662cac81449bf2ee56ea5c2074` (Marcus Language Rename Spec).
**Ticket:** Notion `3612f266-2cac-8194-87ae-e96b660e38b0`.
**Pre-track baseline:** 321 tests passing, `npm run build` clean (post Build 2 revisions + Classic card alignment).
**Status:** All three subsystems shipped. **321 of 321 tests still passing.** `tsc -b` clean. `npm run build` clean (413.97 KB / 127.64 KB gzip).

---

## Scope reminder

**Player-facing strings + small entry-verb logic only.** Internal code references untouched:
- Variable names (`currentLevelId`, `adventureMode`, `jackpotInfo`, etc.) — UNCHANGED
- File names + folder paths (`src/engine/adventure/`, `JackpotCelebration.tsx`, `AdventureHeroCard`) — UNCHANGED
- Type field names (`ActionScore.jackpotValue`, etc.) — UNCHANGED
- Test fixtures, engine state field names — UNCHANGED
- World name strings (`The Basics` / `Sharper Play` / `The Hunter` / `The Endgame`) — UNCHANGED (deferred per spec)

---

## Subsystem 1 — Adventure → The Run + entry verb hierarchy

### Player-facing string renames

| Surface                                                   | Before                              | After                                |
| --------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| Home-screen Run card title (`AdventureHeroCard`)          | `Adventure`                         | `The Run`                            |
| Home-screen Run card hint pill (first-time)               | `New here? Adventure starts with a tutorial.` | `New here? The Run starts with a tutorial.` |
| ChapterMap header                                         | `ADVENTURE · {WORLD}`               | `THE RUN · {WORLD}`                  |
| ClassicSetup Jett-locked flavor                           | `Beat Adventure World 4 to unlock`  | `Beat The Run World 4 to unlock`     |
| GameView header mode label (Zone A segment)               | `ADVENTURE`                         | `THE RUN`                            |
| GameView quit dialog title (in-Run)                       | `Return to Adventure Map?`          | `Return to The Run Map?`             |
| LevelCompleteOverlay final-level header                   | `ADVENTURE COMPLETE`                | `THE RUN COMPLETE`                   |

### Entry verb hierarchy

New helper in `src/engine/adventure/progressManager.ts`:
```ts
export type RunStatus = 'fresh' | 'in-progress' | 'complete';
export function getRunStatus(): RunStatus { /* reads localStorage, counts levels with stars >= 1 */ }
```

`TitleScreen` in `App.tsx` derives `runStatus` once on mount; passes to `AdventureHeroCard` as a new prop (replaces the old `returning: boolean`). CTA label:

| `RunStatus`     | CTA label  | Behavior on tap                                                |
| --------------- | ---------- | -------------------------------------------------------------- |
| `'fresh'`       | `BEGIN`    | Routes to ChapterMap (start fresh)                             |
| `'in-progress'` | `RESUME`   | Routes to ChapterMap (existing save honored)                   |
| `'complete'`    | `NEW RUN`  | Opens confirm dialog → on confirm: `clearProgress()` + ChapterMap |

`START GAME` verb on Classic Setup is UNCHANGED (separate destination, no conflict).

### NEW RUN confirm dialog

Modal rendered inside `TitleScreen`. Backdrop tap or `CANCEL` button dismisses without wiping. `START NEW RUN` button calls `clearProgress()` then navigates. Copy:

> **Start a new Run?**
> Your existing Run is complete. Starting a new Run wipes progress and stars. Jett stays unlocked in Classic.

The Jett-unlock-stays note is honest disclosure — `clearProgress()` only wipes `stacked_v2_adventure_progress`, not `stacked_v2_jett_unlocked_classic`. That's correct behavior (once earned, stays earned), but worth telling the player.

Buttons follow Bundle A's secondary-outlined / primary-solid spec: CANCEL outlined, START NEW RUN solid tan (matching Run card's brand).

### Decisions called out

- **Kicker copy:** Spec said CC's call on `CAMPAIGN · NEW` / `CAMPAIGN · CH. 1`. **Kept as-is.** No Run-native rewrite that lands cleanly without redundancy with "The Run" title. CAMPAIGN reads as a category label (vs Classic's `QUICK MATCH`), which still works.
- **Card stats line:** Kept `{12 levels} 4 worlds to conquer` and `{12 levels} · 4 worlds` (resume state) — spec default.
- **Entry-verb state source:** Reads `stacked_v2_adventure_progress` from localStorage directly inside `getRunStatus()` rather than threading the `AdventureProgress` object. Slightly different from `loadProgress()` (which validates + restores defaults); `getRunStatus()` does its own light validation. Keeps the title-screen render synchronous + cheap.

### Files modified
- `src/engine/adventure/progressManager.ts` — added `RunStatus` type + `getRunStatus()` helper at the bottom.
- `src/App.tsx` — `TitleScreen` derives `runStatus`, wires NEW RUN confirm dialog; `AdventureHeroCard` accepts `runStatus` prop (replaces `returning`), renders new CTA label + new title + new hint copy.
- `src/components/ChapterMap.tsx` — header label.
- `src/components/ClassicSetup.tsx` — Jett-locked flavor.
- `src/components/GameView.tsx` — header mode label + type + quit dialog title.
- `src/components/LevelCompleteOverlay.tsx` — final-level header.

---

## Subsystem 2 — Jackpot mechanic name → Taking the Table

### Findings

Grep across `src/` (case-insensitive) for `jackpot` outside `JackpotCelebration.tsx`:

| Surface                                  | Type                     | Decision                |
| ---------------------------------------- | ------------------------ | ----------------------- |
| `engine/ai/evaluator.ts` `jackpotValue`  | **Internal field name** (scoring dimension on `ActionScore`) | UNCHANGED — internal |
| `engine/ai/evaluator.ts` doctrine refs in comments | **Code comments** | UNCHANGED — internal |
| `config/motion.ts` "Jackpot celebration pulses" | **Code comment** | UNCHANGED — internal |
| `GameView.tsx` `jackpotInfo` prop / variable names | **Internal** | UNCHANGED — internal |
| `GameView.tsx` Bundle A S5 "jackpot board tint" code comment | **Internal** | UNCHANGED — internal |

**Zero player-facing copy references to the mechanic name "Jackpot" exist outside `JackpotCelebration.tsx`.** The Session 7 rules-modal removal mentioned in the ticket appears to have cleaned everything earlier. S2 is effectively a **no-op** as the spec predicted. Honest skip flagged below.

### Honest skip
- No mechanic-name renames shipped in S2. All `Jackpot`/`jackpot`/`JACKPOT` references in code are internal (variable names, field names, comments). The single player-facing string (`JACKPOT!` headline) lives in `JackpotCelebration.tsx` and is handled by S3.

### Files modified
- None.

---

## Subsystem 3 — JackpotCelebration headline asymmetric rewrite

### What landed

Headline text in `src/components/JackpotCelebration.tsx` rewritten with the asymmetric formula per Marcus spec:

```ts
const isPlayer = !info || info.winner === 0;
const headline = isPlayer ? 'TABLE TAKEN!' : `${botName.toUpperCase()} TOOK THE TABLE!`;
```

| Winner                              | Headline                                |
| ----------------------------------- | --------------------------------------- |
| Player (`info.winner === 0`)        | `TABLE TAKEN!`                          |
| Bot Calvin                          | `CALVIN TOOK THE TABLE!`                |
| Bot Nina                            | `NINA TOOK THE TABLE!`                  |
| Bot Rex                             | `REX TOOK THE TABLE!`                   |
| Bot Jett                            | `JETT TOOK THE TABLE!`                  |

Bot variant uses the bot's player color (Calvin blue, Nina pale-ice, Rex red, Jett purple) per Bundle A's locked palette. Player variant stays amber (matches YOU's existing accent).

Headline font sizes:
- Player: 32px (preserved from `JACKPOT!`)
- Bot: 26px — slightly smaller to give the longer string room without crowding the +N / cardCount lines. Both still bold (weight 800) Inter Sans, all-caps via `textTransform: 'uppercase'`, slight letter-spacing.

Container gains `padding: '0 24px'` and `textAlign: 'center'` so the longer bot variant can wrap cleanly on narrow viewports without touching the edges.

### Subtitle fate — DROPPED

`{winnerName} sweep/sweeps the board` subtitle removed. Reason: the new headline (`CALVIN TOOK THE TABLE!`) already communicates the sweep verb — the subtitle would be redundant restatement.

The Bundle A grammar ternary (`winnerName === 'You' ? 'sweep' : 'sweeps'`) is preserved in a comment in `JackpotCelebration.tsx` as documentation if the subtitle ever returns. No dead code in the component body.

### UNCHANGED (per spec)
- All celebration animations (spring scale-in on the headline, fade-in/out on the backdrop, exit transition).
- Sound triggers (no audio system shipped yet; no-op).
- Particle effects (no particle system shipped yet; no-op).
- Overlay timing / duration (controlled upstream in `useGameController` — 2500ms hold).
- Winner color highlighting (Calvin/Nina/Rex/Jett palette from Bundle A; YOU = amber).
- Bundle A's jackpot board tint (deck-empty derivation in GameView — separate code path).
- Bundle C's overlay suppression for the toast layer during the celebration (`!!jackpotInfo` check in GameView's `isOverlaySuppressing`).

### Files modified
- `src/components/JackpotCelebration.tsx` — headline + subtitle removal.

---

## Aggregate state

| Metric                 | Pre-track | Post-track | Delta                |
| ---------------------- | --------- | ---------- | -------------------- |
| Tests passing          | 321       | **321**    | unchanged (strings + small logic only) |
| `tsc -b`               | clean     | clean      | —                    |
| `npm run build`        | clean (~445 ms) | clean (~434 ms) | bundle 413.97 KB / 127.64 KB gzip |

**Files touched (6):**
- `src/engine/adventure/progressManager.ts` — new `getRunStatus()` helper + `RunStatus` type export.
- `src/App.tsx` — TitleScreen entry-verb wiring + NEW RUN confirm dialog; AdventureHeroCard signature + copy.
- `src/components/ChapterMap.tsx` — header rename.
- `src/components/ClassicSetup.tsx` — Jett-locked flavor rename.
- `src/components/GameView.tsx` — header segment label + type + quit dialog title.
- `src/components/LevelCompleteOverlay.tsx` — final-level header.
- `src/components/JackpotCelebration.tsx` — headline + subtitle.

---

## Honest skips and edge cases called out

| Item | Status | Notes |
| ---- | ------ | ----- |
| L2 mechanic-name renames | **No-op.** Zero player-facing `Jackpot` strings outside `JackpotCelebration.tsx`. Spec predicted this. | — |
| Internal code references unchanged | By design. Spec explicitly scoped to copy only. | — |
| World name strings unchanged | Deferred per spec (Marcus session pending). | `levelConfig.ts` `WORLD_NAMES` untouched. |
| `clearProgress()` doesn't wipe Jett-Classic unlock | Intentional + documented in the confirm dialog copy. | Once earned, stays earned. |
| Run card kicker `CAMPAIGN · NEW` / `CAMPAIGN · CH. 1` | Kept as-is per CC discretion in spec. | No Run-native rewrite that didn't duplicate "The Run" title. |
| Run card stats line `12 levels · 4 worlds to conquer` | Kept as-is. | Spec default. |
| Subtitle "X sweep(s) the board" | **Dropped.** Bundle A grammar fix preserved as a code comment for reference. | New headline already says "took the table." |

---

## TC manual playtest checklist

Visit `http://192.168.1.79:8091/?unlock` (phone) or `http://localhost:8091/?reset` first if you want to verify the `fresh` / `in-progress` / `complete` states cleanly.

### L1 — Adventure → The Run + entry verb
- [ ] **Home screen card title:** Reads `The Run` (was `Adventure`).
- [ ] **First-time visitor (no save):** Run card CTA reads `BEGIN`. Hint pill: `New here? The Run starts with a tutorial.`
- [ ] **Mid-Run state:** Save exists with some levels incomplete → CTA reads `RESUME`. No hint pill.
- [ ] **Completed Run:** Use `?unlock` to mark all 12 complete → CTA reads `NEW RUN`. Tap → confirm dialog opens with the copy above. CANCEL leaves save intact; START NEW RUN wipes and routes to ChapterMap fresh.
- [ ] **ChapterMap header:** Reads `THE RUN · THE BASICS` (or whichever world).
- [ ] **ClassicSetup:** Jett locked card shows `Beat The Run World 4 to unlock` (was `Beat Adventure World 4 to unlock`).
- [ ] **Game-screen header (Adventure):** Mode segment reads `THE RUN` (was `ADVENTURE`).
- [ ] **Quit dialog mid-Run:** Title reads `Return to The Run Map?` (was `Return to Adventure Map?`).
- [ ] **Final level (4-3) win:** LevelComplete header reads `THE RUN COMPLETE` (was `ADVENTURE COMPLETE`).
- [ ] **START GAME on Classic Setup:** UNCHANGED.

### L3 — Take the Table popup
- [ ] **Trigger Jackpot as YOU:** Headline reads `TABLE TAKEN!` in amber. No "You sweep the board" subtitle. Points + card count still shown below.
- [ ] **Trigger Jackpot as Calvin (set up a game with Calvin):** Headline reads `CALVIN TOOK THE TABLE!` in Calvin blue. Same.
- [ ] **Trigger Jackpot as Rex / Nina / Jett:** Headline matches `[NAME] TOOK THE TABLE!` in their player color.
- [ ] **Animation unchanged:** Scale-in spring, fade-out, hold duration ≈2.5s, no card-fly/sound (not implemented yet).
- [ ] **Toast suppression still works (Bundle C):** During the celebration, no in-game hint/celebration toast appears under the overlay.
- [ ] **Board tint still fires (Bundle A):** Tan tint on Zone E during the deck-empty hand stays.

---

## What this closes

- ✅ Subsystem 1: Adventure → The Run + entry verb hierarchy
- ✅ Subsystem 2: Jackpot mechanic-name pass (no-op confirmed)
- ✅ Subsystem 3: Take the Table popup formula

After this lands, brand language is unified end-to-end. Internal code refactor (variable/file names) remains a separate optional cleanup if TC ever wants it. World names are queued behind Marcus's pending session.

---

*Authored against Marcus Language Rename Spec May 15, 2026 (Notion `3612f2662cac81449bf2ee56ea5c2074`). Three subsystems shipped in one CC pass. After this lands: TC plays the checklist, commits + pushes.*
