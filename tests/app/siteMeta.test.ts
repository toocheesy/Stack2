/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Everything around the game (D-007 release 4, rulings 52, 53, 57, 58, 83):
// the page title and the three descriptions in index.html and the manifest,
// the lemon theme colour with no #0A0A0A left, and the six icons and the
// share card at their pixel sizes.

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const index = read('index.html');
const viteConfig = read('vite.config.ts');
const privacy = read('public/privacy.html');

const DESCRIPTION = 'Pull up a chair. Build combos, capture the table, and race two opponents to the score.';
const LEMON = '#FFF4B8';

function meta(html: string, attr: 'name' | 'property', key: string): string | null {
  const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
  return m ? m[1] : null;
}

/** A PNG's pixel size from its header (the IHDR chunk). */
function pngSize(p: string): string {
  const b = readFileSync(join(ROOT, p));
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

describe('the title, the descriptions and the theme colour', () => {
  it('index.html: the title, the description, og and twitter', () => {
    expect(index).toContain('<title>STACKED — Take a Seat</title>');
    expect(meta(index, 'name', 'description')).toBe(DESCRIPTION);
    expect(meta(index, 'property', 'og:description')).toBe(DESCRIPTION);
    expect(meta(index, 'name', 'twitter:description')).toBe(DESCRIPTION);
    expect(meta(index, 'property', 'og:title')).toBe('STACKED');
    expect(meta(index, 'name', 'twitter:title')).toBe('STACKED');
    expect(meta(index, 'name', 'theme-color')).toBe(LEMON);
    // The share card keeps its address.
    expect(meta(index, 'property', 'og:image')).toBe('https://stackedthegame.com/og-share.png');
    expect(meta(index, 'name', 'twitter:image')).toBe('https://stackedthegame.com/og-share.png');
  });

  it('the manifest: the description, lemon theme and background, the names unchanged', () => {
    expect(viteConfig).toContain(`description: '${DESCRIPTION}',`);
    expect(viteConfig).toContain(`theme_color: '${LEMON}',`);
    expect(viteConfig).toContain(`background_color: '${LEMON}',`);
    expect(viteConfig).toContain("name: 'STACKED',");
    expect(viteConfig).toContain("short_name: 'STACKED',");
  });

  it('no #0A0A0A is left in index.html, vite.config.ts or privacy.html', () => {
    for (const [name, text] of [['index.html', index], ['vite.config.ts', viteConfig], ['public/privacy.html', privacy]]) {
      expect(text.toUpperCase(), name).not.toContain('#0A0A0A');
    }
    expect(meta(privacy, 'name', 'theme-color')).toBe(LEMON);
  });
});

describe('the icons and the share card', () => {
  it('the six icons are PNGs at 16, 32, 180, 192, 512 and 512', () => {
    expect(pngSize('public/icons/favicon-16.png')).toBe('16x16');
    expect(pngSize('public/icons/favicon-32.png')).toBe('32x32');
    expect(pngSize('public/icons/apple-touch-icon-180.png')).toBe('180x180');
    expect(pngSize('public/icons/icon-192.png')).toBe('192x192');
    expect(pngSize('public/icons/icon-512.png')).toBe('512x512');
    expect(pngSize('public/icons/icon-maskable-512.png')).toBe('512x512');
  });

  it('the share card is a PNG at 1200 x 630', () => {
    expect(pngSize('public/og-share.png')).toBe('1200x630');
  });
});
