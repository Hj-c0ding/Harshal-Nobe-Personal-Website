import type { Entry } from '../data/entries';
import {
  DEFAULT_STATE,
  LENSES,
  filterEntries,
  formatCount,
  isDefaultState,
  isLensId,
  lensLabel,
  parseHash,
  serializeHash,
  toggleLens,
  type LensId,
  type LensState,
} from '../lib/lenses';

export interface LensesHandle {
  getState(): LensState;
  destroy(): void;
}

type Attrs = Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function buildControls(doc: Document): HTMLElement {
  const chips = [{ id: 'all', label: 'All' }, ...LENSES].map((lens) =>
    el(
      doc,
      'button',
      {
        type: 'button',
        class: 'chip',
        id: `lens-chip-${lens.id}`,
        'data-lens': lens.id,
        'aria-pressed': 'false',
      },
      [lens.label],
    ),
  );

  return el(doc, 'div', { class: 'row lens-controls' }, [
    el(doc, 'div', { class: 'margin' }, [
      el(doc, 'p', { class: 'note' }, ['pick a lens']),
    ]),
    el(doc, 'div', { class: 'body' }, [
      el(doc, 'div', { class: 'chips', role: 'group', 'aria-label': 'Lenses' }, chips),
      el(doc, 'form', { class: 'search', role: 'search', id: 'lens-search-form' }, [
        el(doc, 'label', { for: 'lens-search' }, ['Search entries']),
        el(doc, 'input', {
          id: 'lens-search',
          type: 'search',
          autocomplete: 'off',
          spellcheck: 'false',
          placeholder: 'e.g. django',
        }),
      ]),
      el(doc, 'div', { class: 'status' }, [
        el(doc, 'p', {
          id: 'lens-count',
          class: 'count',
          role: 'status',
          'aria-live': 'polite',
        }),
        el(doc, 'button', { type: 'button', id: 'lens-reset', class: 'text-button' }, [
          'Reset',
        ]),
      ]),
    ]),
  ]);
}

function buildEntry(doc: Document, entry: Entry): HTMLElement {
  const marginChildren: HTMLElement[] = [el(doc, 'p', { class: 'date' }, [entry.dates])];
  if (entry.note) marginChildren.push(el(doc, 'p', { class: 'note' }, [entry.note]));

  const heading = el(doc, 'h3', { class: 'entry-title' }, [
    el(doc, 'span', { class: 'entry-org' }, [entry.title]),
  ]);
  if (entry.role) {
    heading.append(el(doc, 'span', { class: 'entry-role' }, [entry.role]));
  }

  return el(
    doc,
    'article',
    {
      class: 'row entry',
      id: `entry-${entry.id}`,
      'data-entry-id': entry.id,
      'data-tags': entry.tags.join(' '),
    },
    [
      el(doc, 'div', { class: 'margin' }, marginChildren),
      el(doc, 'div', { class: 'body' }, [
        heading,
        el(doc, 'p', { class: 'entry-summary' }, [entry.summary]),
        el(
          doc,
          'ul',
          { class: 'tags', 'aria-label': 'Tags' },
          entry.tags.map((tag) => el(doc, 'li', {}, [lensLabel(tag)])),
        ),
      ]),
    ],
  );
}

function buildEmpty(doc: Document): HTMLElement {
  return el(doc, 'div', { class: 'row empty', id: 'lens-empty', hidden: '' }, [
    el(doc, 'div', { class: 'margin' }),
    el(doc, 'div', { class: 'body' }, [
      el(doc, 'p', { class: 'empty-message' }, [
        'Nothing on these pages matches that. Try a different lens or word.',
      ]),
      el(doc, 'button', { type: 'button', id: 'lens-clear', class: 'text-button' }, [
        'Clear lenses',
      ]),
    ]),
  ]);
}

/**
 * Renders the lens controls + entries into `root` and wires up behavior.
 * State lives in the URL hash so filtered views can be shared.
 */
export function mountLenses(
  root: HTMLElement,
  entries: readonly Entry[],
  win: Window = window,
): LensesHandle {
  const doc = root.ownerDocument;
  const controls = buildControls(doc);
  const list = el(
    doc,
    'div',
    { class: 'entries', id: 'entries' },
    entries.map((entry) => buildEntry(doc, entry)),
  );
  const empty = buildEmpty(doc);
  root.replaceChildren(controls, list, empty);

  const chips = Array.from(controls.querySelectorAll<HTMLButtonElement>('.chip'));
  const search = controls.querySelector<HTMLInputElement>('#lens-search');
  const form = controls.querySelector<HTMLFormElement>('#lens-search-form');
  const count = controls.querySelector<HTMLElement>('#lens-count');
  const reset = controls.querySelector<HTMLButtonElement>('#lens-reset');
  const clear = empty.querySelector<HTMLButtonElement>('#lens-clear');
  const articles = Array.from(list.querySelectorAll<HTMLElement>('.entry'));
  if (!search || !form || !count || !reset || !clear) {
    throw new Error('Lenses markup is incomplete');
  }

  let state: LensState = parseHash(win.location.hash);

  const writeHash = (): void => {
    const hash = serializeHash(state);
    const url = hash ? `#${hash}` : `${win.location.pathname}${win.location.search}`;
    win.history.replaceState(null, '', url);
  };

  const render = (): void => {
    for (const chip of chips) {
      const lens = chip.dataset.lens;
      const pressed =
        lens === 'all'
          ? state.lenses.length === 0
          : isLensId(lens) && state.lenses.includes(lens);
      chip.setAttribute('aria-pressed', String(pressed));
    }
    if (search.value !== state.query) search.value = state.query;

    const visible = new Set(filterEntries(entries, state).map((entry) => entry.id));
    const filtering = !isDefaultState(state);
    for (const article of articles) {
      const shown = visible.has(article.dataset.entryId ?? '');
      article.classList.toggle('is-match', filtering && shown);
      article.classList.toggle('is-dimmed', !shown);
      if (shown) {
        article.removeAttribute('aria-hidden');
        article.removeAttribute('inert');
      } else {
        article.setAttribute('aria-hidden', 'true');
        article.setAttribute('inert', '');
      }
    }
    count.textContent = formatCount(visible.size, entries.length);
    empty.hidden = visible.size !== 0;
  };

  const update = (next: LensState): void => {
    state = next;
    render();
    writeHash();
  };

  const activate = (chip: HTMLButtonElement): void => {
    const lens = chip.dataset.lens;
    if (lens === 'all' || isLensId(lens))
      update(toggleLens(state, lens as LensId | 'all'));
  };

  const onChipClick = (event: Event): void => {
    activate(event.currentTarget as HTMLButtonElement);
  };

  // Native buttons already activate on Enter/Space; we handle the keys
  // explicitly (and cancel the default) so activation fires exactly once and
  // behaves the same in every environment, including tests.
  const onChipKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (!event.repeat) activate(event.currentTarget as HTMLButtonElement);
    }
  };
  const onChipKeyup = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'Spacebar') event.preventDefault();
  };

  const onInput = (): void => update({ ...state, query: search.value });
  const onSubmit = (event: Event): void => event.preventDefault();
  const onReset = (): void => update({ ...DEFAULT_STATE });
  const onClear = (): void => {
    update({ ...DEFAULT_STATE });
    search.focus();
  };
  const onHashChange = (): void => {
    state = parseHash(win.location.hash);
    render();
  };

  for (const chip of chips) {
    chip.addEventListener('click', onChipClick);
    chip.addEventListener('keydown', onChipKeydown);
    chip.addEventListener('keyup', onChipKeyup);
  }
  search.addEventListener('input', onInput);
  form.addEventListener('submit', onSubmit);
  reset.addEventListener('click', onReset);
  clear.addEventListener('click', onClear);
  win.addEventListener('hashchange', onHashChange);

  render();

  return {
    getState: () => state,
    destroy: () => {
      win.removeEventListener('hashchange', onHashChange);
      root.replaceChildren();
    },
  };
}
