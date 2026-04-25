import type { Card, GamePlayerStats, PlayerIndex, RoundStats } from './types';

export type GameEventType =
  | 'jackpot_resolved'
  | 'round_end'
  | 'game_over'
  | 'new_round_started'
  | 'deck_count_changed';

export type GameEvent =
  | { type: 'jackpot_resolved'; winner: PlayerIndex; cards: Card[]; points: number }
  | { type: 'round_end'; roundNumber: number; roundStats: [RoundStats, RoundStats, RoundStats] }
  | { type: 'game_over'; winner: PlayerIndex; gameStats: [GamePlayerStats, GamePlayerStats, GamePlayerStats] }
  | { type: 'new_round_started'; roundNumber: number }
  | { type: 'deck_count_changed'; remainingCards: number };

type Listener = (event: GameEvent) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on(type: GameEventType, listener: Listener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  emit(event: GameEvent): void {
    this.listeners.get(event.type)?.forEach((fn) => fn(event));
  }

  clear(): void {
    this.listeners.clear();
  }
}
