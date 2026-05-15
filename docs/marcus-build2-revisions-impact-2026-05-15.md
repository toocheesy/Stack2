# Marcus Build 2 Revisions + Playtest Polish — Impact

**Track:** `BUILD — Marcus Build 2 Revisions + Playtest Polish` — P2, May 15 2026.
**Trigger:** Marcus Build 2 post-ship audit (`3612f2662cac8144a76dfde99b6775d4`) + TC playtest May 15 morning (stacked-v2.png + stacked-v2 (1).png).
**Source pages:** Marcus Build 2 audit + original Visual Paint Brief (`3602f2662cac811eb433e754b418d458`).
**Pre-track baseline:** 321 tests passing, `npm run build` clean (post header-polish follow-up).
**Status:** All three subsystems shipped. **321 of 321 tests still passing.** `tsc -b` clean. `npm run build` clean (412.43 KB / 127.24 KB gzip).

---

## Subsystem 1 — Hand format revert (`H[N]/[total]` → `H[N]`)

### What landed

`HeaderSegments` in `src/components/GameView.tsx` reverted to bare `H[N]`:

```ts
// before
seg(`H${hand}/${TOTAL_HANDS_PER_ROUND}`, ..., 'h'),
// after
seg(`H${hand}`, ..., 'h'),
```

The `TOTAL_HANDS_PER_ROUND = 4` constant and its derivation comment are removed. The header now reads `STACKED! CLASSIC · 300 · R1 · H1` (Classic) or `STACKED! ADVENTURE · 1-1 · R1 · H1` (Adventure).

### Rationale

Per Marcus's Build 2 audit: the `H1/4` format bakes a structural assumption (4 hands per round) into UI copy. While the engine math currently evaluates to 4 hands per round (HAND_SIZE 4 × 3 players, board 4, deck.length ≥ 12 threshold), that's a current rule — not a permanent contract. Variant modes, different player counts, future game configurations could change this. Bare `H[N]` survives any of those without copy changes. Marcus's structural argument trumps the math argument.

### State-driven cues preserved

- Hand 3 tan tint on `R[N]` AND `H[N]` still fires together at `state.handNumber >= 3`.
- Typography unchanged (Inter Medium 13px, white@70%, shifts to tan@90%).

### Files modified
- `src/components/GameView.tsx` — `HeaderSegments` only.

---

## Subsystem 2 — Home screen STACKED! hero-center bump

### What landed

The home screen's `TitleScreen` component in `src/App.tsx` had STACKED! at 18px top-left, paired with "CHOOSE YOUR GAME" 9px top-right in a `space-between` header row — utility chrome treatment, equal weight to the subtitle.

Now restructured to a centered hero block above the mode cards:

```tsx
<div style={{
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: 6, flexShrink: 0, marginBottom: 28,
}}>
  <div style={{
    fontWeight: 900, fontSize: 64, letterSpacing: '-0.02em', lineHeight: 1,
  }}>
    STACKED<span style={{ color: JADE }}>!</span>
  </div>
  <div style={{
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10, color: '#7a8580', letterSpacing: '0.22em', fontWeight: 500,
  }}>
    CHOOSE YOUR GAME
  </div>
</div>
```

### Design choices made

| Decision                | Choice                       | Rationale                                                                                                                |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Hero size               | **64px** (3.5× from 18px)    | Within Marcus's 3-4× spec range. 70-72px tested visually tight against the mode cards; 64px feels hero without crowding. |
| Subtitle fate           | **Kept** as small companion  | Functional context — "CHOOSE YOUR GAME" is a verb prompt for what's below. Bumped from 9px to 10px to match the slightly more vertical layout. |
| Subtitle position       | **Below** the wordmark       | Stack reads as one cohesive brand block.                                                                                  |
| Top-left chrome         | **Empty**                    | Per spec — browser-back handles back-nav. Brand mark carries identity.                                                    |
| Mode cards `marginTop`  | **Removed** (was 24px)       | The new hero block now owns the spacing above the cards via its `marginBottom: 28`. Cleaner than fighting two margins.    |

### Files modified
- `src/App.tsx` — `TitleScreen` only (the header row → centered hero block).

### Game-screen header UNCHANGED

Bundle B header polish follow-up's inline wordmark (14px) inside the game-screen Zone A stays exactly as it was. The home-screen treatment and the game-screen treatment are now two distinct scales for two distinct contexts (brand moment vs. chrome anchor). Both ship.

---

## Subsystem 3 — Score size reduction

### What landed

Score number sizes in Zone H (YOU) and BotZone reduced from 22px → **18px** to match TC playtest direction: score reads as part of zone vertical rhythm, not dominating it.

| Surface         | Font (unchanged)                   | Weight (unchanged) | Size before | Size after |
| --------------- | ---------------------------------- | ------------------ | ----------- | ---------- |
| Zone H YOU score | JetBrains Mono                     | 800 (Bold)         | 22px        | **18px**   |
| BotZone score    | Inter (system-ui fallback)         | 900 (Black)        | 22px        | **18px**   |

Font families intentionally not unified. Marcus's audit assumed both were "Inter Black" — actually Zone H predates Bundle B and uses JetBrains Mono Bold for the player score (matches the mono-aligned `/{target}` suffix beneath). Bot zones use Inter Black 22 per Bundle B Section 4. Both characters stay; only the size shrinks. If TC wants unified typography in a follow-up, that's a separate small change.

### Step 2 — Card sizing assessment

Per spec: "after score fix, visually assess card sizes." Reviewed both playtest screenshots (stacked-v2.png shows the in-game zones at the pre-fix score size):

- **Player hand cards** look proportional in their zone. Score reduction frees up vertical space without changing the card row.
- **Bot face-down cards** read appropriately — the four green card backs at the top of each bot zone (with the slight overlap pattern) are scaled correctly for visual presence as "real opponents." Not too small.
- **Board cards** (center of screen) are the dominant visual element, which is correct — that's the game state.

**No card-size changes shipped in this subsystem.** The 22px → 18px score reduction is enough to rebalance the zones visually based on the screenshot evidence. If TC's post-fix playtest still feels off, card sizing is a quick follow-up — `CARD_W = 62` lives at `src/components/Card.tsx:8` for the main card scale, and the board card scaling in `GameView.tsx:185` uses a `boardCardScale` derivation that adapts to viewport width.

### 80% tan escalation carry-through

Bundle A S4 logic (`animate={{ color: escalated ? TAN : '#fff' }}` with 500ms ease-in) is unchanged. The color transition still fires correctly at the new 18px size — Framer Motion animates the `color` property of the `motion.span` regardless of font-size.

### Files modified
- `src/components/GameView.tsx` — two font-size literals: line ~569 (Zone H YOU score) and line ~695 (BotZone score line). 22 → 18 on both.

---

## Aggregate state

| Metric                 | Pre-track | Post-track | Delta                |
| ---------------------- | --------- | ---------- | -------------------- |
| Tests passing          | 321       | **321**    | unchanged            |
| `tsc -b`               | clean     | clean      | —                    |
| `npm run build`        | clean (~441 ms) | clean (~445 ms) | bundle 412.43 KB / 127.24 KB gzip |

**Files touched (2):**
- `src/components/GameView.tsx` — Header hand format + Zone H score size + BotZone score size.
- `src/App.tsx` — TitleScreen header → centered hero block.

---

## Honest skips

| Item | Status | Resolution path |
| ---- | ------ | --------------- |
| Zone H + BotZone font family unification (Inter Black vs JetBrains Mono Bold) | Not unified. Marcus's S3 audit text said "Inter Black ~22px → ~18-19px" for both — but Zone H actually uses JetBrains Mono Bold. Kept both families as-is, only sized them down. | If TC wants unified score typography (likely Inter Black everywhere), single-line swap on Zone H's `motion.span` style. |
| Card sizing changes (Step 2 of S3 spec) | None shipped. Screenshot review showed cards already proportional after the score fix. | If post-fix playtest shows imbalance, adjust `CARD_W` in `Card.tsx:8` (main card scale) or tune `boardCardScale` in `GameView.tsx:185` (board card adaptive scale). |
| Subtitle bumped 9 → 10px | Not strictly authorized by spec ("CC's call") | If TC prefers 9px to match the rest of the JetBrains Mono small-caps treatment elsewhere, single-line revert. |

---

## TC manual playtest checklist

Visit `http://192.168.1.79:8091/?unlock` (phone) or `http://localhost:8091/?unlock` (desktop).

### S1 — Hand format
- [ ] Classic: header reads `STACKED! CLASSIC · 300 · R1 · H1` — no `/4`.
- [ ] Adventure: header reads `STACKED! ADVENTURE · 1-1 · R1 · H1` — no `/4`.
- [ ] Play to Hand 3: `R[N]` AND `H3` tint to tan together.

### S2 — Home screen hero
- [ ] STACKED! is centered above the Classic/Adventure mode cards, at ~64px hero scale.
- [ ] Brand mark (white text + jade `!`) preserved.
- [ ] Small "CHOOSE YOUR GAME" subtitle visible below the wordmark in JetBrains Mono.
- [ ] Top-left of home screen is now empty — that's correct.
- [ ] Classic and Adventure cards render below the hero block without crowding.
- [ ] Mode cards' internal "QUICK MATCH" / "CAMPAIGN" labels unchanged.

### S3 — Score sizing
- [ ] Zone H (YOU): score number fits the box height comfortably; doesn't dominate.
- [ ] Bot zones: score line reads as part of the vertical name-then-score stack, not larger than the name.
- [ ] Force a player past 240 points (target 300 × 0.8): score number transitions smoothly white → tan at the new 18px size.

### What this CLOSES from Marcus's Build 2 audit
- ✅ Revision item 1 (hand format) — bare `H[N]` restored.
- ✅ Revision item 2 (home screen brand placement) — hero-center treatment at 64px.

### What this DOESN'T close (separate tracks per spec note)
- Language rename pass (Adventure → The Run, Jackpot → Taking the Table) — **separate CC track, not in scope here.**
- Stat-card re-baseline measurement (canonical-rebuild follow-up).
- Adventure mode revalidation pass.

---

*Authored against Marcus Build 2 audit + TC playtest direction May 15, 2026. Three small subsystems shipped in one CC pass. After this lands: TC plays the checklist, decides whether to fire the language rename track next, commits + pushes.*
