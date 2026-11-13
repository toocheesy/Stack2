import type { Difficulty, GameState } from '../../engine/types';
import { C } from '../../config/colors';
import { opponentName } from '../../game/useGameController';

/** The opponents' colours (STACKED v2, D-007 rulings 24, 87, 94): Nina azure,
 *  Rex wisteria; Calvin and Jett wear Classic's line colour for now. A colour
 *  follows the bot, never the seat or the pick order. Gold is never a bot's. */
export const BOT_COLOURS: Record<Difficulty, string> = {
  beginner: C.line.classic,
  intermediate: C.botAzure,
  advanced: C.botWisteria,
  expert: C.line.classic,
};

export interface Seat {
  /** The name on the seat; when both seats hold one personality, with its seat number. */
  name: string;
  colour: string;
}

export function seatOf(state: GameState, player: 1 | 2): Seat {
  const difficulty = player === 1 ? state.settings.bot1Personality : state.settings.bot2Personality;
  const same = state.settings.bot1Personality === state.settings.bot2Personality;
  const name = opponentName(state, player);
  return { name: same ? `${name} · ${player}` : name, colour: BOT_COLOURS[difficulty] };
}
