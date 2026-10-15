import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entries } from '../src/data/entries';
import { mountLenses, type LensesHandle } from '../src/ui/lenses';

let root: HTMLElement;
let handle: LensesHandle | undefined;

function mount(hash = ''): void {
  window.history.replaceState(null, '', `/${hash}`);
  document.body.innerHTML = '<div id="root"></div>';
  root = document.getElementById('root') as HTMLElement;
  handle = mountLenses(root, entries, window);
}

const chip = (lens: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-lens="${lens}"]`) as HTMLButtonElement;
const search = (): HTMLInputElement =>
  root.querySelector<HTMLInputElement>('#lens-search') as HTMLInputElement;
const countText = (): string | null =>
  root.querySelector('#lens-count')?.textContent ?? null;
const emptyState = (): HTMLElement => root.querySelector('#lens-empty') as HTMLElement;
const articles = (): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('article.entry'));
const visibleIds = (): string[] =>
  articles()
    .filter((a) => a.getAttribute('aria-hidden') !== 'true')
    .map((a) => a.dataset.entryId ?? '');

function typeSearch(value: string): void {
  search().value = value;
  search().dispatchEvent(new Event('input', { bubbles: true }));
}

function press(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => mount());
afterEach(() => {
  handle?.destroy();
  handle = undefined;
});

describe('Lenses DOM', () => {
  it('starts with All pressed and every entry visible', () => {
    expect(chip('all').getAttribute('aria-pressed')).toBe('true');
    expect(visibleIds()).toHaveLength(7);
    expect(countText()).toBe('7 of 7 entries');
    expect(root.querySelector('#lens-count')?.getAttribute('aria-live')).toBe('polite');
    expect(emptyState().hidden).toBe(true);
  });

  it('chip click updates aria-pressed, visible entries, live count, and hash', () => {
    chip('leadership').click();

    expect(chip('leadership').getAttribute('aria-pressed')).toBe('true');
    expect(chip('all').getAttribute('aria-pressed')).toBe('false');
    expect(visibleIds()).toEqual(['fbla', 'tsa']);
    expect(countText()).toBe('2 of 7 entries');
    expect(window.location.hash).toBe('#lens=leadership');

    const hidden = articles().filter((a) => a.getAttribute('aria-hidden') === 'true');
    expect(hidden).toHaveLength(5);
    for (const a of hidden) {
      expect(a.hasAttribute('inert')).toBe(true);
      expect(a.classList.contains('is-dimmed')).toBe(true);
    }
    const matches = articles().filter((a) => a.classList.contains('is-match'));
    expect(matches.map((a) => a.dataset.entryId)).toEqual(['fbla', 'tsa']);

    // Second lens combines with OR.
    chip('fullstack').click();
    expect(visibleIds()).toEqual(['fynder', 'fbla', 'tsa']);
    expect(countText()).toBe('3 of 7 entries');

    // "All" clears the lens filter.
    chip('all').click();
    expect(chip('leadership').getAttribute('aria-pressed')).toBe('false');
    expect(visibleIds()).toHaveLength(7);
  });

  it('impossible search shows the empty state; "Clear lenses" restores all', () => {
    chip('data').click();
    typeSearch('zzz-no-such-entry');

    expect(visibleIds()).toEqual([]);
    expect(countText()).toBe('0 of 7 entries');
    expect(emptyState().hidden).toBe(false);

    (root.querySelector('#lens-clear') as HTMLButtonElement).click();

    expect(emptyState().hidden).toBe(true);
    expect(visibleIds()).toHaveLength(7);
    expect(search().value).toBe('');
    expect(chip('all').getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(search());
  });

  it('Reset clears lenses, search, and the URL hash', () => {
    handle?.destroy();
    mount('#lens=cloud&q=aws');

    expect(chip('cloud').getAttribute('aria-pressed')).toBe('true');
    expect(search().value).toBe('aws');
    expect(visibleIds()).toEqual(['aws-ccp']);

    (root.querySelector('#lens-reset') as HTMLButtonElement).click();

    expect(window.location.hash).toBe('');
    expect(search().value).toBe('');
    expect(chip('cloud').getAttribute('aria-pressed')).toBe('false');
    expect(chip('all').getAttribute('aria-pressed')).toBe('true');
    expect(countText()).toBe('7 of 7 entries');
    expect(handle?.getState()).toEqual({ lenses: [], query: '' });
  });

  it('ignores invalid hash values on load without throwing', () => {
    handle?.destroy();
    expect(() => mount('#lens=nonsense,DATA,data&q=%E0%A4%A')).not.toThrow();
    expect(chip('data').getAttribute('aria-pressed')).toBe('true');
    expect(visibleIds().length).toBeGreaterThanOrEqual(0);
  });

  it('chips are operable with Enter and Space', () => {
    const cloud = chip('cloud');
    cloud.focus();

    const enter = press(cloud, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(cloud.getAttribute('aria-pressed')).toBe('true');
    expect(visibleIds()).toEqual(['backline', 'aws-ccp']);

    press(cloud, ' ');
    expect(cloud.getAttribute('aria-pressed')).toBe('false');
    expect(visibleIds()).toHaveLength(7);

    // Other keys do nothing.
    press(cloud, 'a');
    expect(cloud.getAttribute('aria-pressed')).toBe('false');
  });
});
