// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Reads the real design tokens from the stylesheet so this test fails if
// someone changes a color to one that breaks WCAG AA.
const css = readFileSync(
  fileURLToPath(new URL('../src/styles/main.css', import.meta.url)),
  'utf8',
);

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`Missing token --color-${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Every foreground/background pair that carries text on the site.
const textPairs: [fg: string, bg: string][] = [
  ['deepest', 'lightest'], // primary body text on light screen background
  ['dark', 'lightest'], // secondary text/dates/labels on screen
  ['accent', 'lightest'], // alert/achievement accent on screen
  ['lightest', 'deepest'], // pressed chips, HUD text, badges
  ['deepest', 'light'], // buttons, progress fill
];

describe('WCAG AA contrast', () => {
  it.each(textPairs)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
