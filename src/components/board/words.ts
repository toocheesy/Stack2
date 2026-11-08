import type { Card, CaptureGroup, Combination } from '../../engine/types';
import { cardLabel, cardPoints, type LastMove } from '../../game/useGameController';

// The board's words beyond the message line, as GB2 has them.

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

/** The Take the Table panel's line on who can still take it, in GB2's words
 *  with the names following the game. "you" goes last so the verb agrees. */
export function takeTheTableSentence(inLine: string, others: readonly string[]): string {
  const named = others.filter((n) => n !== 'You');
  const list = others.includes('You') ? [...named, 'you'] : named;
  const verb = list[list.length - 1] === 'you' ? 'capture' : 'captures';
  return `${inLine} captured last. If ${list[0]} or ${list[1]} ${verb} before the round ends, they take it instead.`;
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
