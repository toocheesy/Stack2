// @vitest-environment jsdom
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C } from '../../src/config/colors';

// The privacy page, PP3 Topic Cards (D-007 release 4, rulings 48, 48a, 53,
// 108, 112): the notice's words as they were, plus "Back to STACKED" twice
// and nothing else; the date unchanged; every colour a value in colors.ts
// and none of them tangerine; the theme colour lemon; the fonts served from
// this site and no request to any other; the topics as h2 headings; no script.

const ROOT = process.cwd();
const html = readFileSync(join(ROOT, 'public', 'privacy.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

// The notice as it stood before release 4, block by block (the bold lead-ins
// now headings), with the two links around it.
const EXPECTED = [
  'Back to STACKED',
  'STACKED — Privacy',
  'Last updated: November 8, 2026',
  'The short version.',
  'STACKED has no accounts and never asks for your name or email. We use Google Analytics to count plays and see how the game is used. You can turn that off anytime in Settings.',
  'What\'s collected.',
  'When you play on stackedthegame.com, Google Analytics records:',
  'pages viewed and basic page activity, like scrolling and link clicks',
  'game moments: starting a game, your first capture, finishing a game (mode, win or loss, score and length), finishing the tutorial, and installing the app',
  'the deal number of each game, so we can replay a deal that went wrong',
  'your device and browser type, screen size, language, and rough location (city and country), which Google works out from your connection',
  'Google sets a cookie in your browser with a random ID, so a returning visit counts as the same player.',
  'Why.',
  'To see how many people play, where they get stuck, and what to fix next. We don\'t sell this data or use it for ads, and Google\'s ad-profile linking (Google signals) is off.',
  'How long it\'s kept.',
  'Detailed activity is deleted after 2 months. Anything tied to your random ID is deleted 14 months after your last visit.',
  'Turning it off.',
  'Open Settings (the gear on the home screen) and turn off "Share anonymous play data." It stays off on that browser and device. If your browser sends a Global Privacy Control signal, analytics stays off automatically. We don\'t respond to the older "Do Not Track" signal.',
  'What stays on your device.',
  'Your saved games and tutorial and install markers live in your browser\'s storage. They\'re never sent to us. Clearing this site\'s data in your browser erases them.',
  'Hosting.',
  'The site is served by Vercel, which handles your connection to deliver the pages, like any web host.',
  'Kids.',
  'STACKED isn\'t directed to children under 13, and we don\'t knowingly collect personal information from them.',
  'Changes.',
  'If this notice changes, we\'ll update this page and its date.',
  'Questions: privacy@stackedthegame.com',
  'Back to STACKED',
];
const TOPICS = ['The short version.', 'What\'s collected.', 'Why.', 'How long it\'s kept.', 'Turning it off.', 'What stays on your device.', 'Hosting.', 'Kids.', 'Changes.'];

const tidy = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const colourValues = new Set<string>();
for (const v of Object.values(C)) {
  if (typeof v === 'string') colourValues.add(v.toUpperCase());
  else for (const w of Object.values(v)) colourValues.add(w.toUpperCase());
}

describe('the privacy page (PP3)', () => {
  it('reads the same words as before, plus "Back to STACKED" at the top and the end, and nothing else', () => {
    const blocks = Array.from(doc.body.querySelectorAll('h1, h2, p, li, a.back')).map((el) => tidy(el.textContent));
    expect(blocks).toEqual(EXPECTED);
    expect(tidy(doc.body.textContent)).toBe(EXPECTED.join(' '));
    expect(doc.title).toBe('STACKED — Privacy');
  });

  it('the date still reads November 8, 2026', () => {
    expect(html).toContain('Last updated: November 8, 2026');
    expect(doc.querySelector('.updated')!.textContent).toBe('Last updated: November 8, 2026');
  });

  it('the two links go to / and are 44px tall; the email is the mailto link it was', () => {
    const backs = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a.back'));
    expect(backs).toHaveLength(2);
    for (const a of backs) expect(a.getAttribute('href')).toBe('/');
    expect(html).toMatch(/\.back\s*\{[^}]*height:\s*44px/);
    const mail = doc.querySelector('a[href^="mailto:"]')!;
    expect(mail.getAttribute('href')).toBe('mailto:privacy@stackedthegame.com');
    expect(mail.textContent).toBe('privacy@stackedthegame.com');
  });

  it('every colour on the page is a value in colors.ts, none is tangerine, and the theme colour is lemon', () => {
    const found = Array.from(new Set((html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => c.toUpperCase())));
    expect(found.length).toBeGreaterThan(3);
    for (const c of found) expect(colourValues.has(c), `${c} is not in colors.ts`).toBe(true);
    expect(found).not.toContain(C.stackUpper.toUpperCase());
    expect(html).not.toMatch(/rgba?\(/);
    expect(doc.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(C.ground.brand);
    expect(C.ground.brand).toBe('#FFF4B8');
  });

  it('the fonts come from /fonts/ on this site, every file exists, and the page asks nothing of any other site', () => {
    const faces = html.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(3);
    const families = faces.map((f) => `${f.match(/font-family:\s*'([^']+)'/)![1]} ${f.match(/font-weight:\s*(\d+)/)![1]}`).sort();
    expect(families).toEqual(['Abril Fatface 400', 'Josefin Sans 400', 'Josefin Sans 700']);
    const urls = html.match(/url\(([^)]+)\)/g) ?? [];
    expect(urls.length).toBe(3);
    for (const u of urls) {
      const path = u.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
      expect(path.startsWith('/fonts/')).toBe(true);
      expect(path.endsWith('.woff2')).toBe(true);
      expect(existsSync(join(ROOT, 'public', path)), `${path} is missing`).toBe(true);
    }
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('fonts.googleapis');
  });

  it('the topics are h2 headings, the two that can be acted on are filled, and there is no script', () => {
    expect(Array.from(doc.querySelectorAll('h2')).map((h) => h.textContent)).toEqual(TOPICS);
    expect(doc.querySelector('h1')!.textContent).toBe('STACKED — Privacy');
    const sections = Array.from(doc.querySelectorAll('section'));
    expect(sections).toHaveLength(10);
    expect(sections[0].className).toContain('navy');
    expect(sections[0].querySelector('h2')!.textContent).toBe('The short version.');
    expect(sections[4].className).toContain('cobalt');
    expect(sections[4].querySelector('h2')!.textContent).toBe('Turning it off.');
    expect(sections[9].className).toContain('dashed');
    expect(doc.querySelectorAll('li')).toHaveLength(4);
    expect(doc.querySelectorAll('script')).toHaveLength(0);
    expect(html).not.toMatch(/<script/i);
  });
});
