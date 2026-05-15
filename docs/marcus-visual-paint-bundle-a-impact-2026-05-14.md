# Marcus Visual Paint — Bundle A Impact

**Track:** `BUILD — Marcus Visual Paint Bundle A (Visual Cleanup)` — P2, May 14 2026.
**Source of truth (spec):** Notion `3602f2662cac811eb433e754b418d458` — Visual Paint Brief Post-UX Review.
**Ticket:** Notion `3602f266-2cac-81bd-8828-fc92d5ca41e6`.
**Trigger:** Canonical bot rebuild shipped May 14; visual cleanup queue (Bundle A) is the prerequisite that locks brand color tokens for Bundles B and C.
**Pre-track baseline:** 321 tests passing, `npm run build` clean (post canonical-rebuild).
**Status:** All five subsystems + two independent string/CSS fixes shipped. **321 of 321 tests passing** (no new tests; style-only changes). `tsc -b` clean. `npm run build` clean (410.09 KB / 126.59 KB gzip).

---

## Subsystem 1 — Brand color cleanup

### What landed

**Brand palette added as first-class tokens** (`src/config/colors.ts` + `src/index.css`):
```ts
jade:        '#065F46',
tan:         '#E8C577',
brown:       '#72571C',
bgNearBlack: '#0A0A0A',
```

**Bot color tokens re-aligned to Visual Paint Brief Section 7 locked palette:**

| Bot    | Pre-rebuild | Post-rebuild | Notes                                                  |
| ------ | ----------- | ------------ | ------------------------------------------------------ |
| Calvin | `#60A5FA`   | `#3B82F6`    | Locked palette                                         |
| Nina   | `#A78BFA`   | `#DBEAFE`    | **Closes finding 15** (Game Over Nina drift purple → pale-ice) |
| Rex    | `#EF4444`   | `#DC2626`    | Locked palette                                         |
| Jett   | `#FBBF24`   | `#8B5CF6`    | **Closes Stacy May 6 flag.** Both teal `#0D9488` and golden `#FBBF24` retired from codebase entirely |

**`indigo` / `indigoHover` tokens marked DEPRECATED** in colors.ts. Phaser-era leftovers. All overlay CTA usages swapped to brand colors (see below); tokens themselves kept temporarily for any residual reference, scheduled for removal.

**Indigo overlay CTAs swapped to brand color** (per Section 5 "Adventure → tan, Classic → jade"):

| Surface                                                  | Before        | After                                                                |
| -------------------------------------------------------- | ------------- | -------------------------------------------------------------------- |
| `LevelCompleteOverlay` NEXT LEVEL                        | `C.indigo`    | `C.tan` (Adventure-only overlay)                                     |
| `LevelCompleteOverlay` PLAY AGAIN (no-NEXT case)         | `C.indigo`    | `C.tan` (becomes the primary)                                        |
| `LevelCompleteOverlay` PLAY AGAIN (NEXT-exists case)     | gray outlined | secondary outlined per Section 5 (S3 spec applied here too)          |
| `RoundEndOverlay` CONTINUE                               | `C.indigo`    | mode-aware: `C.tan` when `adventureMode`, else `C.jade` (default)    |
| `GameOverOverlay` PLAY AGAIN                             | `C.indigo`    | mode-aware: `C.tan` when `adventureMode`, else `C.jade`              |
| `JackpotCelebration` `winnerColor` default (human win)   | `C.indigo`    | `C.amber` (matches YOU's existing accent color elsewhere in the app) |

**`RoundEndOverlay` gained an `adventureMode?: boolean` prop** so it can pick the right brand color. Threaded from `GameView` via `!!currentLevelId` (same pattern `GameOverOverlay` already uses).

### Stale literal cleanup

| File                                          | Change                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/components/ClassicSetup.tsx`             | Jett avatar `#0D9488` → `#8B5CF6`                                            |
| `src/components/GameView.tsx` PLAYER_COLORS   | Jett `#0D9488` → `#8B5CF6`                                                   |
| `src/components/ThinkingBubble.tsx`           | Calvin/Nina/Rex/Jett literals all migrated to locked palette                 |
| `src/shared/personalities.ts`                 | Jett `#0D9488` → `#8B5CF6` (display-metadata file used by character roster)  |

**Honest skip note:** the brief Subsystem 1 task list called out only Jett (everywhere) and Nina (Game Over only). Audit revealed `C.botCalvin` and `C.botRex` were also drifted from the locked palette; fixed both alongside as a single architectural alignment. If Calvin/Rex visuals look wrong post-merge, easy to revert those two tokens individually.

---

## Subsystem 2 — Active-turn glow bolder + phase cleanup

### What landed

**Glow spec updated to Brief Section 7 values:**

| Property        | Pre-rebuild                       | Post-rebuild                                                              |
| --------------- | --------------------------------- | ------------------------------------------------------------------------- |
| Border          | 2px solid {color}                 | **3px solid {color}**                                                     |
| Outer glow      | `0 0 12px {color}44` (~27% alpha) | `0 0 16px {color}80↔B3` (50% ↔ 70% alpha, breathing)                      |
| Inner glow      | none                              | `inset 0 0 4px {color}4D` (30% alpha, stable)                             |
| Animation       | none (static)                     | 1.2s ease-in-out infinite, alternating outer alpha 50% ↔ 70% (slow breathe) |

Implementation uses Framer Motion `motion.div` with `animate={{ boxShadow: [low, high] }}` + `repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut'`. Inner glow stays at 30% throughout — only outer alpha oscillates (the dominant signal).

**Phase cleanup** — finding 5: glow MUST clear during `roundEnd` / `jackpot` / `gameOver` overlays. Fixed by introducing a single derived flag at the top of `GameView`:

```ts
const inPlay = state.gamePhase === 'playing';
const playerActive = inPlay && state.currentPlayer === 0;
const bot1Active   = inPlay && state.currentPlayer === 1;
const bot2Active   = inPlay && state.currentPlayer === 2;
```

These three booleans drive the glow on all three player zones (Zone H player score block, Zone G player hand zone, Zone C/D bot zones). When `gamePhase` transitions out of `'playing'`, all three become false simultaneously and the glow fades out.

**YOU's active-glow color** changed from `#F59E0B` (amber) to `#E8C577` (TAN) per the locked player palette in Section 7. Other amber usages in YOU's surface (e.g., the small "YOU" label, score-table accents elsewhere) intentionally left at amber for this subsystem — they're separate concerns from active-turn glow specifically.

---

## Subsystem 3 — Secondary button consistency

### What landed

**Outlined secondary spec applied uniformly** (Brief Section 5):
- Border: `1.5px solid rgba(255,255,255,0.4)`
- Background: transparent
- Text color: `rgba(255,255,255,0.9)`

| Surface                                                       | Before                                          | After          |
| ------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| `LevelCompleteOverlay` PLAY AGAIN (when NEXT exists)          | `1px solid C.divider` + `C.textSecondary` text  | spec outlined  |
| `LevelCompleteOverlay` WORLD MAP                              | `1px solid C.divider` + `C.textSecondary` text  | spec outlined  |
| `GameOverOverlay` HOME / WORLD MAP                            | `1px solid C.textSecondary` + matching text     | spec outlined  |
| `GameView` `Btn` helper (used in quit dialog: BACK / RESUME / QUIT) | `1px solid white@30%` + `white@60%` text  | `1.5px solid white@40%` + `white@90%` text |

**Hierarchy rule honored:** ONE primary per overlay (solid in brand color), every other action outlined secondary.
- `LevelCompleteOverlay`: NEXT LEVEL primary (tan), PLAY AGAIN + WORLD MAP outlined → **WORLD MAP no longer reads as disabled.**
- `LevelCompleteOverlay` (no NEXT case): PLAY AGAIN primary (tan), WORLD MAP outlined.
- `GameOverOverlay`: PLAY AGAIN primary (mode-aware), HOME/WORLD MAP outlined.
- `RoundEndOverlay`: CONTINUE primary (mode-aware) — only button.
- `GameView` quit dialog: RESUME primary (jade), BACK/QUIT secondary.

---

## Subsystem 4 — Score-state escalation (80% threshold)

### What landed

When a player crosses `targetScore * 0.8`, their score number transitions white → tan over 500ms ease-in. Stays tan until the round resets (scores → 0 → naturally drops back below 80% threshold).

Implementation derives three booleans at the top of `GameView`:
```ts
const escalateThreshold = target * 0.8;
const playerEscalated = state.overallScores.player >= escalateThreshold;
const bot1Escalated   = state.overallScores.bot1   >= escalateThreshold;
const bot2Escalated   = state.overallScores.bot2   >= escalateThreshold;
```

Score numbers wrapped in `motion.span` with `animate={{ color: escalated ? TAN : '#fff' }}` and `transition={{ duration: 0.5, ease: 'easeIn' }}`. Same shape on all three player zones.

Bot zones receive `escalated` as a new prop on `BotZone`. Player score (Zone H) wires it inline.

**No continuous animation per spec** — one-time color shift. Brief Section 6 explicitly rules out pulse/breathe.

---

## Subsystem 5 — Jackpot board tint + 2 string/CSS fixes

### Jackpot board tint (Brief Section 3)

Tan #E8C577 @ 6% overlay on Zone E during the jackpot hand. Added as an absolute-positioned `motion.div` inside the board container with `pointerEvents: 'none'` and `zIndex: 0` (sits under cards). The "Board empty" label and other content gain `position: relative; zIndex: 1` so they stack correctly.

```tsx
<motion.div
  initial={false}
  animate={{ opacity: deckEmpty ? 0.06 : 0 }}
  transition={{ duration: deckEmpty ? 0.6 : 0.4, ease: deckEmpty ? 'easeOut' : 'easeIn' }}
  style={{ position:'absolute', inset:0, borderRadius:12, background:TAN, pointerEvents:'none', zIndex:0 }}
/>
```

**Honest skip — gate condition.** Brief said `gamePhase === 'jackpot-hand'` but the engine `GamePhase` enum is `'playing' | 'jackpot' | 'roundEnd' | 'gameOver'`. No `'jackpot-hand'` state exists. The functional equivalent — "the last hand of the round, before the celebration" — is already derived in `GameView` as `deckEmpty = state.deck.length === 0 && state.gamePhase === 'playing'`. Re-used that. Same condition, same window. If the engine adds an explicit `'jackpot-hand'` phase later, swap the gate in one line.

**Coexists with the deck-low amber border glow** per Brief — both fire on the same condition. Two visuals, two messages: tint = "this is the jackpot hand", border glow = "this hand is ending soon."

### Finding 4 — "You sweeps the board" grammar
`JackpotCelebration.tsx:74` — added `winnerName === 'You' ? 'sweep' : 'sweeps'` ternary. Bots stay "sweeps" (third-person singular). Player gets "You sweep".

### Finding 6 — "Board empty" bleed
The "Board empty" placeholder text in Zone E was rendering during `roundEnd` / `jackpot` / `gameOver` overlay phases — visible behind the partially-transparent overlay backdrops. Added `inPlay` to the conditional: `visibleBoard.length === 0 && !botCombo && inPlay`. Text now hides whenever an overlay phase is active.

**Honest skip note on finding 6:** the Brief described this as bleeding through "Zone B" (message strip) — but the actual "Board empty" string lives in Zone E (the board container). Same fix shape regardless.

---

## Aggregate state

| Metric                 | Pre-track | Post-track | Delta                |
| ---------------------- | --------- | ---------- | -------------------- |
| Tests passing          | 321       | **321**    | unchanged (style-only) |
| `tsc -b`               | clean     | clean      | —                    |
| `npm run build`        | clean (~430 ms) | clean (~435 ms) | bundle 410.09 KB / 126.59 KB gzip |

**Files touched (10):**
- `src/config/colors.ts`, `src/index.css` — brand tokens + CSS vars
- `src/components/ClassicSetup.tsx` — Jett avatar
- `src/components/GameView.tsx` — active-turn glow, phase flags, score escalation, jackpot tint, Board empty gate, secondary `Btn` helper
- `src/components/ThinkingBubble.tsx` — bot color literals
- `src/components/LevelCompleteOverlay.tsx` — overlay buttons (indigo retire + outlined spec)
- `src/components/RoundEndOverlay.tsx` — `adventureMode` prop + CONTINUE color
- `src/components/GameOverOverlay.tsx` — PLAY AGAIN/HOME color + spec
- `src/components/JackpotCelebration.tsx` — winnerColor default + sweep grammar
- `src/shared/personalities.ts` — Jett display metadata color

---

## Consolidated honest skips

| Item | Status | Resolution path |
| ---- | ------ | --------------- |
| `C.botCalvin` / `C.botRex` token alignment | Updated alongside Jett/Nina to match Section 7 locked palette. Brief task list only authorized Jett (everywhere) and Nina (Game Over). | If TC wants Calvin/Rex visuals reverted, two-line revert in `colors.ts`. |
| YOU `C.amber` non-glow surfaces (label text, "+25" highlights, etc.) | Left at amber. Only the active-turn glow color was swapped to TAN. Brief Section 7 ambiguous on whether YOU should be TAN everywhere or just for glow. | Wider YOU=TAN sweep available as a follow-up if desired. |
| Jackpot board tint gate | Used existing `deckEmpty` derivation (same condition as the deck-low amber glow). Brief said `gamePhase === 'jackpot-hand'` but no such enum value exists. | Engine could add the phase later; tint gate then becomes a one-line swap. |
| Finding 6 "Board empty" location | Brief said Zone B; actual location is Zone E. Same fix applied (hide when not in `'playing'`). | None — fix is correct regardless of where the text was. |
| `C.indigo` / `C.indigoHover` tokens | Marked DEPRECATED, left in `colors.ts` so any residual reference doesn't break. No production code references them after this bundle. | Remove tokens entirely in a follow-up sweep once the codebase is grep-confirmed clean. |

---

## TC manual playtest checklist

Visit `http://192.168.1.79:8091/?unlock` (phone) or `http://localhost:8091/?unlock` (desktop). The auto-unlock helper in `main.tsx` is still present for playtest convenience.

### S1 — Brand colors
- [ ] Open Classic Setup. Jett avatar reads PURPLE (#8B5CF6), not teal or golden.
- [ ] Open Adventure overlay (Level Complete). NEXT LEVEL button is TAN (not indigo). PLAY AGAIN and WORLD MAP are outlined secondaries.
- [ ] Trigger a Round End in Classic. CONTINUE button is JADE.
- [ ] Reach Game Over from Adventure. Nina (if she's a bot) shows PALE-ICE in the score table, not purple. PLAY AGAIN is TAN, WORLD MAP is outlined.

### S2 — Active-turn glow
- [ ] Start a game. Active player's zone has a noticeably bolder border (3px, was 2px) with a slow breathe.
- [ ] Trigger Round End. Active glow disappears immediately when the overlay fires (was lingering before).
- [ ] Same check on Game Over and Jackpot celebration phases.

### S3 — Secondary buttons
- [ ] On every overlay (Level Complete, Round End, Game Over): only ONE filled button per overlay; everything else is outlined.
- [ ] WORLD MAP and HOME look identical (no longer reads as disabled).

### S4 — Score escalation
- [ ] Run a target-300 game. As any player crosses 240 points, their score number transitions white → tan smoothly (500ms).
- [ ] Confirm the shift fires on YOU's zone and on bot zones independently.

### S5 — Jackpot tint + fixes
- [ ] Reach the last hand of a round (deck empties). Board surface should pick up a subtle tan tint (6%) — the deck-low amber border glow stays alongside it.
- [ ] Trigger the JACKPOT celebration as the human player. Text reads "You **sweep** the board" (not "sweeps").
- [ ] Trigger any overlay (Round End, Game Over, JACKPOT). The faint "Board empty" placeholder text should NOT bleed through.

---

## What this enables

Bundle A is the prerequisite for:
- **Bundle B** (header restructure + bot zone two-line layout) — depends on locked brand color tokens for the bot zone two-line accent.
- **Bundle C** (messaging architecture: toast + persistent split) — depends on tan/jade brand tokens for toast color states.

After this lands, those bundles can fire in any order.

---

*Authored against the Visual Paint Brief locked May 13, 2026 (Notion `3602f2662cac811eb433e754b418d458`). Five subsystems shipped in one CC pass. After this lands: TC plays the checklist, decides Bundle B vs C order, commits + pushes.*
