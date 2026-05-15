# Header Polish Follow-Up — Bundle B Game-Screen Header

**Track:** `TRACK — Visual Paint Bundle Follow-Up (Header polish from playtest)` — P2, May 14 2026.
**Trigger:** TC playtest of Bundles A+B+C (May 14, 9:58 PM, IMG_4327). Header read `CLASSIC · 300 · R1 · H1 · 36 LEFT` with no STACKED wordmark; segments visually heavier than spec because the brand anchor was missing.
**Source of truth (referenced):** Visual Paint Brief at Notion `3602f2662cac811eb433e754b418d458`. This track is a TC-authorized override of two brief specs (drop `[N] LEFT`, change `H[N]` format) based on playtest feedback.
**Pre-track baseline:** 321 tests passing, `npm run build` clean (post Bundle C).
**Status:** Shipped. **321 of 321 tests still passing.** `tsc -b` clean. `npm run build` clean (412.44 KB / 127.27 KB gzip).

---

## What landed

Four targeted fixes to `HeaderSegments` and the Zone A layout in `src/components/GameView.tsx`. No engine changes, no Bundle A/B/C surface untouched.

### Fix 1 — Drop `[N] LEFT` segment

The deck-count segment that Bundle B added was redundant with two other signals already present:
- The new `H[N]/[total]` segment (Fix 2) directly tells the player "how many hands left this round."
- The board-border amber glow at `deck.length === 0` (the existing pre-cue from Track B) handles "hand ending soon" — confirmed coexisting with the Bundle A jackpot tint per spec section 3.

Removing it cleans up header width pressure on portrait mobile and gives the wordmark room (Fix 3).

### Fix 2 — `H[N]` → `H[N]/[total]`

Hand segment now displays `H1/4`, `H2/4`, `H3/4`, `H4/4`. The total is sourced from a derived constant in `HeaderSegments`:

```ts
// HAND_SIZE 4 × 3 players = 12 cards per deal. Deck 52 − BOARD_SIZE 4 = 48
// dealable cards. 48 / 12 = 4 hands per round. Matches the turnManager
// DEAL_NEW_HAND ↔ END_ROUND threshold (`deck.length >= 12`) exactly.
const TOTAL_HANDS_PER_ROUND = 4;
```

**Engine verification (not an honest skip):** I verified the math against `src/engine/core/gameState.ts` (`HAND_SIZE = 4`, `BOARD_SIZE = 4`) and `src/engine/core/turnManager.ts:63` (`if (state.deck.length >= 12)` — the threshold for triggering another `DEAL_NEW_HAND`). Engine deals exactly 4 hands per round under current rules. The display matches what the engine emits — `H1/4` through `H4/4` — and round-end fires on the transition from H4 to attempted H5 (where `deck.length` falls below 12).

The engine doesn't expose this as a constant — `HAND_SIZE` and `BOARD_SIZE` are private to `gameState.ts`. I declared `TOTAL_HANDS_PER_ROUND` as a local const in `HeaderSegments` with a comment-cited derivation. If engine ever changes deal math (e.g., HAND_SIZE 5, or 4 players), this needs to update — flagged in honest-skips below.

### Fix 3 — STACKED wordmark restored to header

Bundle B dropped the wordmark when the segment text moved into Zone A. Now restored at:
- **Font:** Inter Medium, weight 900, `letter-spacing: -0.02em` (matches home-screen treatment).
- **Size:** 14px (vs home-screen 18px — scaled down to fit alongside segments on portrait mobile).
- **Color:** white text + jade (`#065F46`) `!` (matches home-screen brand mark exactly).

**Layout chosen:** `[← button]   [STACKED! + segments grouped center]   [right spacer]`

The wordmark sits inline with the segments inside a centered flex group. Layout mockup:

```
[←]    STACKED!   CLASSIC · 300 · R1 · H1/4    [spacer]
```

This preserves brand presence on the left of the centered cluster while keeping segments readable. Considered alternatives:
- **Wordmark stacked above segments** (two-line header) → adds vertical weight, makes Zone A 60-64px tall, reduces board real estate.
- **Wordmark right-aligned, segments left-aligned** → loses centered visual balance.
- **Wordmark replaces left button** → loses quit affordance.

The chosen layout fits comfortably at 375px portrait widths with all 4 segments visible. Container has `min-width: 0; overflow: hidden` so segments truncate naturally if a future device pushes width.

### Fix 4 — Header font size verification

`HeaderSegments` was already rendering all segments at `fontSize: 13` Inter Medium per spec. Reviewed against the screenshot: the perceived heaviness wasn't an actual font-size drift — it was visual imbalance from the missing wordmark (Fix 3). With the wordmark restored, the brand element anchors the header weight properly.

**No font change needed.** Verified by reading the rendered style block in `HeaderSegments` (line 749, fontSize: 13).

---

## State-driven cues preserved

| Cue                             | Trigger                | Behavior                                                     |
| ------------------------------- | ---------------------- | ------------------------------------------------------------ |
| Hand 3 round-arc tint           | `state.handNumber >= 3`| `R[N]` AND `H[N]/[total]` shift white@70% → tan@90%         |
| Mode + target/level stable      | always                 | white@90% (never shift)                                      |
| Wordmark stable                 | always                 | white text + jade `!`, never tints                           |

The Hand 3 cue still fires correctly with the new format — `R3` and `H3/4` both go tan together.

---

## Files modified
- `src/components/GameView.tsx`
  - `HeaderSegments` rewritten: 4 segments instead of 5; `H[N]` → `H[N]/[TOTAL_HANDS_PER_ROUND]`; `TOTAL_HANDS_PER_ROUND = 4` const with derivation comment; `deckLeft` prop + DECK_LOW logic removed.
  - Zone A layout updated: STACKED! wordmark added inside a centered flex group adjacent to `<HeaderSegments>`. Quit button stays left, right spacer stays right for visual balance.

**Bundle A / B / C surfaces NOT touched:**
- Brand color tokens unchanged (`src/config/colors.ts`).
- Bot zone two-line layout unchanged (Bundle B S2).
- Messaging architecture (persistent + toast) unchanged (Bundle C).
- Engine code unchanged (`src/engine/`).
- Adventure restructure files unchanged.

---

## Aggregate state

| Metric                 | Pre-track | Post-track | Delta                |
| ---------------------- | --------- | ---------- | -------------------- |
| Tests passing          | 321       | **321**    | unchanged            |
| `tsc -b`               | clean     | clean      | —                    |
| `npm run build`        | clean (~420 ms) | clean (~441 ms) | bundle 412.44 KB / 127.27 KB gzip |

---

## Honest skips

| Item | Status | Resolution path |
| ---- | ------ | --------------- |
| `TOTAL_HANDS_PER_ROUND` is a local constant in `HeaderSegments`, not sourced from engine | Engine doesn't expose this — `HAND_SIZE` and `BOARD_SIZE` are private to `gameState.ts`. The constant value (4) is verified against engine math and the `deck.length >= 12` threshold in `turnManager.ts:63`. | If engine ever changes deal math (different hand size, different player count, different board size), update `TOTAL_HANDS_PER_ROUND` to match. Or expose `handsPerRound` from engine as a derivation if it becomes dynamic. |
| Wordmark size (14px) differs from home screen (18px) | Smaller to fit alongside 4 segments at portrait widths. Same font weight (900) and same brand mark composition (white text + jade `!`) so visually consistent in spirit. | If TC wants exact home-screen size, swap to a multi-line layout or drop one more segment. |

---

## TC manual playtest checklist

Visit `http://192.168.1.79:8091/?unlock` (phone) or `http://localhost:8091/?unlock` (desktop).

- [ ] **Classic mode:** Header reads `[←] STACKED! CLASSIC · 300 · R1 · H1/4 [spacer]`. Wordmark visible with jade `!`. No `36 LEFT` segment.
- [ ] **Adventure mode:** Header reads `[←] STACKED! ADVENTURE · 1-1 · R1 · H1/4 [spacer]`.
- [ ] **Hand progression:** Play through to Hand 2 → segment reads `H2/4`. Hand 3 → `H3/4` AND both `R[N]` + `H3/4` tint to tan together.
- [ ] **Round transition:** Complete a round → header transitions to `R2 · H1/4` after the new round starts.
- [ ] **Wordmark stability:** Wordmark stays white-with-jade-bang in every state — no tinting, no color shift.
- [ ] **Visual balance:** Header no longer reads as heavy/imbalanced — wordmark anchors the left side of the segment cluster.
- [ ] **Width:** All 4 segments + wordmark + button fit cleanly on portrait mobile (375px+). No truncation in normal play.

---

## What this closes

- UX Review finding 1 / 3 / Q1 (header restructure) — now correctly carrying brand + game-state in proper visual hierarchy after the polish.
- Playtest follow-up from May 14 9:58 PM (IMG_4327): the four targeted fixes specified in the ticket all landed.

Marcus Visual Paint queue + this follow-up complete. Remaining playtest items per Bundle C impact doc: stat-card re-baseline measurement (post canonical-rebuild), Adventure mode revalidation pass, anything new TC surfaces.

---

*Authored against the TC override ticket dated May 14, 2026 (post-Bundles A+B+C). One small focused track. After this lands: TC plays the checklist, commits + pushes.*
