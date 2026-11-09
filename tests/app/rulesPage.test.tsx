// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// jsdom has no matchMedia, and the app asks for it as its modules load.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import App from '../../src/App';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import { C } from '../../src/config/colors';
import type { GameSettings } from '../../src/engine/types';

// The rules page, RP1 Card Stack (D-007 release 4, rulings 43, 60, 61, 107,
// 111), through the whole app: "How to play" on the home opens it with one
// history entry; its words, word for word, in order 01 to 08; the capture
// example drawn with the game's own card; the back button and the phone's
// back (popstate) both return home at once through that one entry; the home
// is as it was; and the back button is held in a top bar once the page scrolls.

const RULES: [string, string][] = [
  ['The goal.', 'Race your two opponents to the target score. Capture cards from the table to score.'],
  ['Your turn.', 'Capture or place a card. No passing. Capture and you keep going while you have cards; place a card and your turn is over.'],
  ['How to capture.', 'Pick a base card. Then fill up to three combos with cards that add up to it, or cards that match it. One combo can\'t do both.'],
  ['Mix it up.', 'Every combo needs a card from the other side of your base. Base from your hand? Each combo needs a table card. Base from the table? Each combo needs one from your hand.'],
  ['Face cards.', 'K, Q and J only match their own kind. Everything else adds up, 10 included. Aces count as 1.'],
  ['Points.', 'Every card you take counts, your base too. Ace 15. K, Q, J and 10 are worth 10. Everything else 5.'],
  ['Take the Table.', 'Each round has four hands of 4 cards. When the round ends, whoever captured last takes every card still on the table.'],
  ['Winning.', 'Pick your target score. Points add up from round to round. When a round ends with someone at the target, the leader wins. Tied for the lead? Play one more round.'],
];
// Every word the old home gave The Run, and the two code-only words.
const RUN_WORDS = /The Run|BEGIN|RESUME|NEW RUN|New here|CAMPAIGN|Run complete|level|world|adventure|jackpot/i;

const classicSettings: GameSettings = { targetScore: 300, bot1Personality: 'beginner', bot2Personality: 'beginner' };
const DEAL_SEED = 1;

function saveClassic() {
  saveGame('classic', {
    game: createInitialState(classicSettings, createPRNG(DEAL_SEED)),
    currentLevelId: null,
    seed: DEAL_SEED,
    dealStream: DEAL_SEED,
    botStream: botStreamSeed(DEAL_SEED),
  });
}

const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

function openRules() {
  fireEvent.click(screen.getByRole('button', { name: 'How to play' }));
}

function onHome(): boolean {
  return screen.queryByText('TAKE A SEAT') !== null && screen.queryByRole('heading', { level: 1, name: 'How to play' }) === null;
}

function onRules(): boolean {
  return screen.queryByRole('heading', { level: 1, name: 'How to play' }) !== null && screen.queryByText('TAKE A SEAT') === null;
}

/** The page's scroller: the one box that scrolls. */
function scroller(): HTMLElement {
  const el = Array.from(document.querySelectorAll<HTMLElement>('div')).find((d) => d.style.overflowY === 'auto');
  if (!el) throw new Error('no scroller');
  return el;
}

describe('the rules page (RP1)', () => {
  let push: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;
  let replace: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.gtag = vi.fn() as (...args: unknown[]) => void;
    push = vi.spyOn(window.history, 'pushState');
    replace = vi.spyOn(window.history, 'replaceState');
    // The browser's own traversal: jsdom's is asynchronous and unreliable, so
    // the test checks the call and plays the browser's popstate itself.
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.restoreAllMocks();
  });

  it('the words: the title, the eight rules in order 01 to 08 word for word, and nothing that names The Run', () => {
    render(<App />);
    openRules();
    expect(onRules()).toBe(true);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How to play');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(RULES.map(([title]) => title));

    const sections = Array.from(document.querySelectorAll('section'));
    expect(sections).toHaveLength(8);
    sections.forEach((section, i) => {
      const [title, text] = RULES[i];
      const number = String(i + 1).padStart(2, '0');
      expect(within(section).getByText(number)).toBeTruthy();
      expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe(title);
      expect(within(section).getByText(text)).toBeTruthy();
      // The pill, then the title, then the line.
      expect(section.textContent!.startsWith(number + title + text)).toBe(true);
    });

    expect(document.body.textContent).not.toMatch(RUN_WORDS);
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    expect(screen.queryByText('Privacy')).toBeNull();
  });

  it('the example under 03: the four cards are the game\'s Card (9♠, 5♥, 4♣, 9♦) at 78% of hand size, with HAND, TABLE and +20, and nothing in it is tappable', () => {
    render(<App />);
    openRules();
    const figures = document.querySelectorAll('figure');
    expect(figures).toHaveLength(1);
    const figure = figures[0];
    expect(figure.closest('section')!.querySelector('h2')!.textContent).toBe('How to capture.');

    expect(within(figure).getByText('HAND')).toBeTruthy();
    expect(within(figure).getAllByText('TABLE')).toHaveLength(2);
    expect(within(figure).getByText('+20')).toBeTruthy();
    expect(figure.querySelector('figcaption')!.textContent).toBe('+20');

    // The game's card: its face at the locked hand size, drawn at 78%.
    const faces = Array.from(figure.querySelectorAll<HTMLElement>('div')).filter((d) => d.style.backgroundColor === rgb(C.cardFace));
    expect(faces.map((f) => `${f.style.width} x ${f.style.height}`)).toEqual(Array(4).fill('72px x 100px'));
    const label = (rank: string, glyph: string) => `${rank}${glyph}︎`.repeat(3);
    expect(faces.map((f) => f.textContent)).toEqual([label('9', '♠'), label('5', '♥'), label('4', '♣'), label('9', '♦')]);
    const boxes = faces.map((f) => f.parentElement!.parentElement!);
    expect(boxes.every((b) => b.style.width === `${72 * 0.78}px` && b.style.height === `${100 * 0.78}px`)).toBe(true);
    // Hearts and diamonds red, spades and clubs dark.
    expect(faces.map((f) => f.style.color)).toEqual([rgb(C.suitDark), rgb(C.suitRed), rgb(C.suitDark), rgb(C.suitRed)]);
    // The strip is the pill navy, so the gold ring shows.
    expect(figure.style.backgroundColor).toBe(rgb(C.surface.brand));
    expect(faces.every((f) => f.style.boxShadow.includes(rgb(C.cardRing)) || f.style.boxShadow.toLowerCase().includes(C.cardRing.toLowerCase()))).toBe(true);

    // A picture only.
    expect(figure.style.pointerEvents).toBe('none');
    expect(within(figure).queryAllByRole('button')).toHaveLength(0);
  });

  it('"How to play" opens the page with one history entry; the back button returns home at once and goes back through that same entry', () => {
    render(<App />);
    expect(onHome()).toBe(true);
    const lengthBefore = window.history.length;

    openRules();
    expect(onRules()).toBe(true);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toEqual({ stackedRules: true });
    expect(window.history.length).toBe(lengthBefore + 1);
    expect(window.history.state).toEqual({ stackedRules: true });

    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    // Home at once, with no timers to run.
    expect(onHome()).toBe(true);
    // Back through the entry the page added: nothing pushed or replaced.
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('the phone\'s back (popstate) returns home at once and leaves no entry behind', () => {
    render(<App />);
    openRules();
    expect(onRules()).toBe(true);

    // The browser has already gone back when popstate fires.
    act(() => {
      window.history.replaceState(null, '');
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(onHome()).toBe(true);
    expect(back).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);

    // A popstate while the page is shut changes nothing.
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(onHome()).toBe(true);
  });

  it('after either way back, the home is as it was: CONTINUE with a saved game, Settings closed, and the page opens again from the top', () => {
    saveClassic();
    render(<App />);
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeTruthy();

    openRules();
    expect(scroller().scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(onHome()).toBe(true);
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('stacked-save-classic')).not.toBeNull();

    openRules();
    expect(scroller().scrollTop).toBe(0);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(onHome()).toBe(true);
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    // One entry per opening, none left behind.
    expect(push).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('once the page scrolls, the back button is held in a slim top bar; at the top it is not', () => {
    render(<App />);
    openRules();
    expect(screen.getAllByRole('button', { name: 'Back to home' })).toHaveLength(1);

    const box = scroller();
    box.scrollTop = 300;
    fireEvent.scroll(box);
    const held = screen.getAllByRole('button', { name: 'Back to home' });
    expect(held).toHaveLength(2);
    const bar = held[1].parentElement!;
    expect(bar.style.position).toBe('absolute');
    expect(bar.style.top).toBe('0px');
    expect(bar.style.height).toBe('72px');
    expect(bar.style.borderBottom).toContain('1.5px solid');
    expect(within(bar).getByText('How to play')).toBeTruthy();
    // The held button goes home too.
    fireEvent.click(held[1]);
    expect(onHome()).toBe(true);

    openRules();
    const again = scroller();
    again.scrollTop = 120;
    fireEvent.scroll(again);
    expect(screen.getAllByRole('button', { name: 'Back to home' })).toHaveLength(2);
    again.scrollTop = 0;
    fireEvent.scroll(again);
    expect(screen.getAllByRole('button', { name: 'Back to home' })).toHaveLength(1);
  });
});
