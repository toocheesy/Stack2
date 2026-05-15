# Marcus Visual Paint — Bundle B Impact

**Track:** `BUILD — Marcus Visual Paint Bundle B (Header + Bot Zone Refactor)` — P2, May 14 2026.
**Source of truth (spec):** Notion `3602f2662cac811eb433e754b418d458` — Visual Paint Brief Post-UX Review (sections 1 + 4).
**Ticket:** Notion `3602f266-2cac-81fb-b9ab-d4a46891dc19`.
**Depends on:** Bundle A (brand color tokens locked there). ✅ Bundle A shipped May 14 (commit `0b8ddb7`).
**Pre-track baseline:** 321 tests passing, `npm run build` clean (post Bundle A).
**Status:** Both subsystems shipped. **321 of 321 tests passing** (no new tests; layout-only changes). `tsc -b` clean. `npm run build` clean (410.87 KB / 126.86 KB gzip).

---

## Subsystem 1 — Header bar restructure

### What landed

The right-side single-segment label (`CLASSIC · 300` or `ADVENTURE · 1-1`) at the top of `GameView` was replaced with the spec's 5-segment header that absorbs game-state info from elsewhere on screen. The header now reads:

| Mode      | Format                                      |
| --------- | ------------------------------------------- |
| Classic   | `CLASSIC · 300 · R1 · H2 · 28 LEFT`         |
| Adventure | `ADVENTURE · 1-1 · R1 · H2 · 28 LEFT`       |

Implementation lives in a new `HeaderSegments` component at the bottom of `GameView.tsx`. Consumes `mode`, `targetOrLevel`, `round`, `hand`, `deckLeft`. Renders five segments interleaved with mid-dot separators.

### Typography (per spec section 1)

| Segment           | Weight        | Size  | Color (default)        | Notes                             |
| ----------------- | ------------- | ----- | ---------------------- | --------------------------------- |
| MODE              | Inter Medium  | 13px  | white @ 90%            | Letter-spacing 0.04em, all caps   |
| TARGET / LEVEL    | Inter Medium  | 13px  | white @ 90%            |                                   |
| `R[N]`            | Inter Medium  | 13px  | white @ 70%            | Secondary weight                  |
| `H[N]`            | Inter Medium  | 13px  | white @ 70%            | Secondary weight                  |
| `[N] LEFT`        | Inter Medium  | 13px  | white @ 70%            | Secondary weight                  |
| Mid-dot separator | Inter         | 13px  | white @ 40%            | 8px padding either side           |

### State-driven color shifts (per spec section 1)

| Trigger                 | Affected segments | Color shift                                 |
| ----------------------- | ----------------- | ------------------------------------------- |
| `state.handNumber >= 3` | `R[N]` and `H[N]` | white @ 70% → tan #E8C577 @ 90%             |
| `state.deck.length <= 8`| `[N] LEFT`        | white @ 70% → tan #E8C577 @ 90%             |
| Otherwise / always      | MODE, TARGET/LEVEL | stable white @ 90% (never shift)           |

The Hand 3 cue primes the player visually for the Hand-3-Fork without screaming. The deck-low cue compounds with the existing amber board border to signal "this hand is ending soon."

### Zone H impact

The `{visibleHand.length} cards` line that lived under the player's score on the bottom-left was deleted (per spec section 1). Card count now lives only in the header's `[N] LEFT` segment.

### Honest skip — strict responsive priority drop

Spec calls for explicit drop-priority order when width is insufficient (R → H → [N] LEFT first; MODE + TARGET/LEVEL never drop). Current implementation uses `min-width: 0; overflow: hidden` on the container so segments truncate naturally if the viewport is too narrow — but it doesn't enforce the strict priority drop order. On common mobile widths (375px+) all five segments fit comfortably and the question is academic. Swap to JS-measured `useState + ResizeObserver` if future device/copy pushes past width.

### Files modified
- `src/components/GameView.tsx` — Zone A header replaced with `HeaderSegments` invocation; Zone H "X cards" line deleted; `HeaderSegments` helper component added near `Btn` / `BotZone`.

---

## Subsystem 2 — Bot zone two-line refactor

### What landed

The single-line "name + score crowded horizontally" layout (which truncated 3-digit Calvin scores in the UX review) was split into two stacked lines above the face-down hand cards.

### New BotZone layout (top → bottom)

```
+------------------------+
| Calvin · 1             |  <- name line (color = bot's player color)
| 120 /100               |  <- score line (white@90% -> tan@90% at 80%)
| [card][card][card][c]  |  <- face-down hand (existing render)
+------------------------+
```

### Typography (per spec section 4)

| Element              | Weight                  | Size  | Color                                                            |
| -------------------- | ----------------------- | ----- | ---------------------------------------------------------------- |
| Name line            | Inter Medium            | 14px  | bot's player color @ 100% (Calvin #3B82F6, Nina #DBEAFE, Rex #DC2626, Jett #8B5CF6) |
| Score number         | Inter Black (weight 900)| 22px  | white @ 90% → tan #E8C577 @ 90% at 80% target (Bundle A S4 logic) |
| `/[target]` suffix   | Inter Medium            | 12px  | white @ 50%                                                      |
| Thinking ellipsis    | inherits name line      | 14px  | inherits bot color                                               |

The name line gets `whiteSpace: nowrap; overflow: hidden; textOverflow: ellipsis` so a long-form name still degrades cleanly at narrow widths. The score line uses `gap: 4px` between the score number and the `/target` suffix for clean baseline alignment.

### Duplicate bot disambiguation (per spec section 4)

When `state.settings.bot1Personality === state.settings.bot2Personality` (e.g., Adventure W1 L1 with Calvin + Calvin), the names render as `Calvin · 1` (seat 1, bot1) and `Calvin · 2` (seat 2, bot2). When the personalities differ, they render plainly: `Calvin`, `Nina`, `Rex`, `Jett`.

**Position lock:** seats are derived from `state.settings.bot1Personality` and `state.settings.bot2Personality`, which are set at game start and don't shuffle mid-game (the canonical bot rebuild's `disableSeatingSwap: true` for Adventure mode further locks this). So `Calvin · 1` always sits in its assigned seat for the entire game.

**Why position numbering, not descriptors** — per spec section 4 / doctrine 8.x: "Player should learn bot behavior through play, not the name. Numbers are functional, neutral, no strategic information leak." Descriptor-based naming (`Calvin "Slow"` / `Calvin "Cautious"`) was explicitly dropped.

### What this removes

- Single-line bot zone where name + score competed for horizontal space
- The `Calvin ...` truncation visible in the UX review's image 6
- Ambiguity in Adventure W1 levels where both bots are Calvin

### Files modified
- `src/components/GameView.tsx` — `BotZone` JSX restructured (name line + score line + cards). Caller wires duplicate-aware names from `state.settings.bot1Personality === state.settings.bot2Personality` check.

---

## Aggregate state

| Metric                 | Pre-track | Post-track | Delta                |
| ---------------------- | --------- | ---------- | -------------------- |
| Tests passing          | 321       | **321**    | unchanged (layout-only) |
| `tsc -b`               | clean     | clean      | —                    |
| `npm run build`        | clean (~435 ms) | clean (~430 ms) | bundle 410.87 KB / 126.86 KB gzip |

**Files touched (1):**
- `src/components/GameView.tsx` — Zone A header + Zone H card-count removal + `BotZone` two-line refactor + new `HeaderSegments` helper component.

---

## Honest skips

| Item | Status | Resolution path |
| ---- | ------ | --------------- |
| Strict responsive priority drop on header (R → H → [N] LEFT in order) | Container uses `min-width:0 + overflow:hidden` for natural truncation; strict drop order not implemented. | Common mobile widths (375px+) fit all 5 segments; if future copy or device pushes width past limit, swap to JS-measured `useState + ResizeObserver`. |
| Header card-count semantics | The Brief said the card count moves "out of Zone H entirely" into the header. The header's `[N] LEFT` segment shows **deck** cards remaining, not the player's hand size. Same number trends together (player hand drains as deck drains), but technically different metrics. | If the spec intent was specifically to surface player hand size, add a sixth segment. Otherwise no change needed — `[N] LEFT` is the more useful global cue. |

---

## TC manual playtest checklist

Visit `http://192.168.1.79:8091/?unlock` (phone) or `http://localhost:8091/?unlock` (desktop). Auto-unlock helper still in `main.tsx` for playtest.

### S1 — Header
- [ ] **Classic mode:** Open Classic Setup → Start. Header reads `CLASSIC · 300 · R1 · H1 · 36 LEFT` (or whatever target you picked). Mid-dots present at 8px gaps.
- [ ] **Adventure mode:** Open Adventure → 1-1. Header reads `ADVENTURE · 1-1 · R1 · H1 · 36 LEFT`.
- [ ] **Hand 3 tint:** Play to Hand 3. `R1` and `H3` segments shift to tan.
- [ ] **Deck-low tint:** Play until deck has ≤ 8 cards. `[N] LEFT` segment shifts to tan AND the existing board border glow fires alongside.
- [ ] **Zone H:** Confirm the `X cards` line under YOU's score is gone — only YOU label, score, /target remain.

### S2 — Bot zones
- [ ] **Classic with Calvin + Nina:** Top line shows just `Calvin` (in #3B82F6 blue) and `Nina` (in #DBEAFE pale-ice). Score line below with white score + dimmed `/100` suffix.
- [ ] **Adventure W1 L1 (Calvin + Calvin):** Bots render as `Calvin · 1` (left seat, bot1) and `Calvin · 2` (right seat, bot2). Position-locked across the whole game.
- [ ] **3-digit scores:** Force a bot to score over 100 (or wait for it). No name truncation in either seat.
- [ ] **80% threshold:** When a bot crosses 80% of target, score number transitions white → tan smoothly (Bundle A S4 escalation now applies cleanly to the new layout).

---

## What this enables

Bundle B + Bundle A together complete the **visual cleanup + layout** prerequisites. Bundle C (Messaging Architecture: toast layer over persistent strip + adventure hint gating) is the last bundle in the visual paint queue; it can fire next.

---

*Authored against the Visual Paint Brief locked May 13, 2026 (Notion `3602f2662cac811eb433e754b418d458`). Two subsystems shipped in one CC pass. After this lands: TC plays the checklist, decides whether to fire Bundle C now or pause for re-baseline first, commits + pushes.*
