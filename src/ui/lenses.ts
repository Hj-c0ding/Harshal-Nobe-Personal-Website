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

export interface LensesCallbacks {
  onStageExpand?: (stageId: string) => void;
  onLensUse?: (lensId: string) => void;
  onSearchUse?: () => void;
}

export interface LensesHandle {
  getState(): LensState;
  isStageExpanded(stageId: string): boolean;
  collapseAllStages(): void;
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
      el(doc, 'p', { class: 'note' }, ['Choose your class:']),
    ]),
    el(doc, 'div', { class: 'body' }, [
      el(
        doc,
        'div',
        { class: 'chips', role: 'group', 'aria-label': 'Choose your class' },
        chips,
      ),
      el(doc, 'form', { class: 'search', role: 'search', id: 'lens-search-form' }, [
        el(doc, 'label', { for: 'lens-search' }, ['Search stages']),
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

function buildStage(doc: Document, entry: Entry, index: number): HTMLElement {
  const stageNum = `1-${index + 1}`;
  const detailsId = `stage-details-${entry.id}`;
  const toggleBtnId = `stage-toggle-${entry.id}`;

  const toggleBtn = el(
    doc,
    'button',
    {
      type: 'button',
      class: 'stage-toggle-btn',
      id: toggleBtnId,
      'aria-expanded': 'false',
      'aria-controls': detailsId,
    },
    [
      el(doc, 'span', { class: 'stage-badge' }, [stageNum]),
      el(doc, 'span', { class: 'stage-name' }, [entry.title]),
      el(doc, 'span', { class: 'stage-arrow', 'aria-hidden': 'true' }, ['▶']),
    ],
  );

  const headerRow = el(doc, 'div', { class: 'stage-header' }, [
    toggleBtn,
    entry.role ? el(doc, 'span', { class: 'stage-role' }, [entry.role]) : '',
  ]);

  const tagList = el(
    doc,
    'ul',
    { class: 'tags', 'aria-label': 'Tags' },
    entry.tags.map((tag) => el(doc, 'li', {}, [lensLabel(tag)])),
  );

  const detailsContainer = el(
    doc,
    'div',
    {
      class: 'stage-details',
      id: detailsId,
      hidden: '',
    },
    [
      el(doc, 'p', { class: 'stage-dates' }, [`Date: ${entry.dates}`]),
      entry.note ? el(doc, 'p', { class: 'stage-note' }, [`Note: ${entry.note}`]) : '',
      el(doc, 'p', { class: 'entry-summary' }, [entry.summary]),
      tagList,
    ],
  );

  return el(
    doc,
    'article',
    {
      class: 'row entry stage-row',
      id: `entry-${entry.id}`,
      'data-entry-id': entry.id,
      'data-tags': entry.tags.join(' '),
    },
    [
      el(doc, 'div', { class: 'margin' }, [
        el(doc, 'span', { class: 'stage-col-num' }, [stageNum]),
      ]),
      el(doc, 'div', { class: 'body' }, [headerRow, detailsContainer]),
    ],
  );
}

function buildEmpty(doc: Document): HTMLElement {
  return el(doc, 'div', { class: 'row empty', id: 'lens-empty', hidden: '' }, [
    el(doc, 'div', { class: 'margin' }),
    el(doc, 'div', { class: 'body' }, [
      el(doc, 'p', { class: 'empty-message' }, [
        'Nothing on these stages matches that. Try a different class or search term.',
      ]),
      el(doc, 'button', { type: 'button', id: 'lens-clear', class: 'text-button' }, [
        'Clear lenses',
      ]),
    ]),
  ]);
}

export function mountLenses(
  root: HTMLElement,
  entries: readonly Entry[],
  win: Window = window,
  callbacks: LensesCallbacks = {},
): LensesHandle {
  const doc = root.ownerDocument;
  const controls = buildControls(doc);
  const list = el(
    doc,
    'div',
    { class: 'entries stages-list', id: 'entries' },
    entries.map((entry, idx) => buildStage(doc, entry, idx)),
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
  const expandedStages = new Set<string>();

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
    if (lens === 'all' || isLensId(lens)) {
      if (isLensId(lens) && callbacks.onLensUse) {
        callbacks.onLensUse(lens);
      }
      update(toggleLens(state, lens as LensId | 'all'));
    }
  };

  const onChipClick = (event: Event): void => {
    activate(event.currentTarget as HTMLButtonElement);
  };

  const onChipKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (!event.repeat) activate(event.currentTarget as HTMLButtonElement);
    }
  };
  const onChipKeyup = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'Spacebar') event.preventDefault();
  };

  const onInput = (): void => {
    if (callbacks.onSearchUse && search.value.trim().length > 0) {
      callbacks.onSearchUse();
    }
    update({ ...state, query: search.value });
  };
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

  // Wire stage accordion expands
  for (const article of articles) {
    const stageId = article.dataset.entryId;
    const btn = article.querySelector<HTMLButtonElement>('.stage-toggle-btn');
    const details = article.querySelector<HTMLElement>('.stage-details');
    const arrow = article.querySelector<HTMLElement>('.stage-arrow');

    if (btn && details && stageId) {
      btn.addEventListener('click', () => {
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        const nextExpanded = !isExpanded;
        btn.setAttribute('aria-expanded', String(nextExpanded));
        details.hidden = !nextExpanded;
        if (arrow) arrow.textContent = nextExpanded ? '▼' : '▶';

        if (nextExpanded) {
          expandedStages.add(stageId);
          if (callbacks.onStageExpand) {
            callbacks.onStageExpand(stageId);
          }
        } else {
          expandedStages.delete(stageId);
        }
      });
    }
  }

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
    isStageExpanded: (stageId: string) => expandedStages.has(stageId),
    collapseAllStages: () => {
      expandedStages.clear();
      for (const article of articles) {
        const btn = article.querySelector<HTMLButtonElement>('.stage-toggle-btn');
        const details = article.querySelector<HTMLElement>('.stage-details');
        const arrow = article.querySelector<HTMLElement>('.stage-arrow');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (details) details.hidden = true;
        if (arrow) arrow.textContent = '▶';
      }
    },
    destroy: () => {
      win.removeEventListener('hashchange', onHashChange);
      root.replaceChildren();
    },
  };
}
