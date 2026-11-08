import type { Card, CaptureGroup, CaptureRecord, Combination } from '../../engine/types';
import { cardLabel, cardPoints, type LastMove } from '../../game/useGameController';

// The board's words beyond the message line, as GB2, RE1p and GO2 have them.

/** One combo in words: a sum "8 + 2 = 10", a match "9" (two matched cards "9, 9"). */
function comboWords(groups: readonly CaptureGroup[], base: Card): string {
  const ranks = groups.map((g) => g.card.rank);
  const isMatch = groups.every((g) => g.card.rank === base.rank);
  return isMatch ? ranks.join(', ') : `${ranks.join(' + ')} = ${base.rank}`;
}

/** A capture's combos in words: "5 + 4 = 9 and 9". */
export function captureWords(combination: Combination): string {
  const base = combination.base;
  if (!base) return '';
  return [combination.combo1, combination.combo2, combination.combo3]
    .filter((s) => s.length > 0)
    .map((s) => comboWords(s, base))
    .join(' and ');
}

/** An opponent's move after its name, as its speech bubble words it:
 *  "took 8 + 2 = 10 (+20), then placed 6♣." · "placed 4♥." · "took 5 + 4 = 9 and 9 (+20)." */
export function moveWords(move: LastMove): string {
  const parts = move.captures.map((c) => `took ${captureWords(c.combination)} (+${c.points})`);
  if (move.placed) parts.push(`${parts.length > 0 ? 'then ' : ''}placed ${cardLabel(move.placed)}`);
  return parts.join(', ') + '.';
}

/** A recorded capture's line on the sheets (RE1p, GO2): the base, then each
 *  combo's cards joined with " + ", the combos joined with " and ":
 *  "10 = 6 + 4", "9 = 5 + 4 and 9", "K = K". */
export function captureLine(record: CaptureRecord): string {
  const combos = record.combos.filter((c) => c.length > 0).map((c) => c.map((x) => x.rank).join(' + '));
  return combos.length > 0 ? `${record.baseCard.rank} = ${combos.join(' and ')}` : record.baseCard.rank;
}

/** The Take the Table panel's points line: "A 15 · K 10 · 8, 5, 4, 9 at 5 each". */
export function pointsBreakdown(cards: readonly Card[]): string {
  const groups = new Map<number, string[]>();
  for (const c of cards) {
    const p = cardPoints(c);
    groups.set(p, [...(groups.get(p) ?? []), c.rank]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([p, ranks]) => (ranks.length === 1 ? `${ranks[0]} ${p}` : `${ranks.join(', ')} at ${p} each`))
    .join(' · ');
}

/** The capture replay's card points line: "9♠ 5 · 5♥ 5 · 4♣ 5 · 9♦ 5". */
export function cardPointsLine(cards: readonly Card[]): string {
  return cards.map((c) => `${cardLabel(c)} ${cardPoints(c)}`).join(' · ');
}

/** "6 cards · worth 45" */
export function worthWords(count: number, points: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'} · worth ${points}`;
}

/** The Take the Table panel's line on who can still take it. When you are in
 *  line, GB2's words with the two opponents in turn order; when an opponent
 *  is, D-007 ruling 100's words. */
export function takeTheTableSentence(inLine: string, others: readonly string[]): string {
  if (inLine === 'You') {
    return `You captured last. If ${others[0]} or ${others[1]} captures before the round ends, they take it instead.`;
  }
  return `${inLine} captured last. Whoever captures next before the round ends takes it instead.`;
}

export interface SourceTag {
  source: 'hand' | 'board';
  label: string;
}

/** A combo's source tags: HAND (outlined) and TABLE (solid), with ×N for several of one kind. */
export function sourceTags(groups: readonly CaptureGroup[]): SourceTag[] {
  const tags: SourceTag[] = [];
  for (const source of ['hand', 'board'] as const) {
    const n = groups.filter((g) => g.source === source).length;
    if (n > 0) tags.push({ source, label: `${source === 'hand' ? 'HAND' : 'TABLE'}${n > 1 ? ` ×${n}` : ''}` });
  }
  return tags;
}
