/**
 * Pure logic for the "Lenses" filter. No DOM access lives here, so every
 * function can be unit-tested in isolation and reused by any UI layer.
 */

export const LENSES = [
  { id: 'data', label: 'Data & ML' },
  { id: 'fullstack', label: 'Full-stack' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'cloud', label: 'Cloud' },
] as const;

export type LensId = (typeof LENSES)[number]['id'];

export const LENS_IDS: readonly LensId[] = LENSES.map((lens) => lens.id);

/** The minimum shape an entry needs in order to be filtered. */
export interface Searchable {
  readonly id: string;
  readonly title: string;
  readonly role?: string;
  readonly summary: string;
  readonly tags: readonly LensId[];
}

export interface LensState {
  /** Selected lenses. Empty means "All" (no lens filter). */
  readonly lenses: readonly LensId[];
  /** Raw search text as typed. Normalized only when matching/serializing. */
  readonly query: string;
}

export const DEFAULT_STATE: LensState = Object.freeze({ lenses: [], query: '' });

export function isLensId(value: unknown): value is LensId {
  return typeof value === 'string' && (LENS_IDS as readonly string[]).includes(value);
}

export function lensLabel(id: LensId): string {
  return LENSES.find((lens) => lens.id === id)?.label ?? id;
}

/**
 * Trims, lowercases, drops unknown values, and dedupes. Output is always in
 * canonical LENSES order so equal selections compare and serialize equally.
 */
export function normalizeLenses(values: Iterable<string>): LensId[] {
  const wanted = new Set<string>();
  for (const value of values) {
    wanted.add(value.trim().toLowerCase());
  }
  return LENS_IDS.filter((id) => wanted.has(id));
}

/** Lowercases and collapses whitespace. Whitespace-only becomes "". */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isDefaultState(state: LensState): boolean {
  return state.lenses.length === 0 && normalizeQuery(state.query) === '';
}

export function matchesEntry(entry: Searchable, state: LensState): boolean {
  const lensOk =
    state.lenses.length === 0 || entry.tags.some((tag) => state.lenses.includes(tag));
  if (!lensOk) return false;

  const query = normalizeQuery(state.query);
  if (query === '') return true;

  const haystack = [
    entry.title,
    entry.role ?? '',
    entry.summary,
    ...entry.tags,
    ...entry.tags.map(lensLabel),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return haystack.includes(query);
}

/** Lenses combine with OR; the search query then narrows the result. */
export function filterEntries<T extends Searchable>(
  entries: readonly T[],
  state: LensState,
): T[] {
  return entries.filter((entry) => matchesEntry(entry, state));
}

/** Toggling "all" clears the lens filter; toggling a lens adds/removes it. */
export function toggleLens(state: LensState, lens: LensId | 'all'): LensState {
  if (lens === 'all') return { ...state, lenses: [] };
  const next = state.lenses.includes(lens)
    ? state.lenses.filter((id) => id !== lens)
    : [...state.lenses, lens];
  return { ...state, lenses: normalizeLenses(next) };
}

/**
 * Parses "#lens=data,leadership&q=django". Never throws: unknown lens values,
 * duplicates, and malformed input are ignored.
 */
export function parseHash(hash: string): LensState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
  const lenses = normalizeLenses((params.get('lens') ?? '').split(','));
  const query = (params.get('q') ?? '').trim();
  return { lenses, query };
}

/** Inverse of parseHash. Returns "" (no hash) for the default state. */
export function serializeHash(state: LensState): string {
  const parts: string[] = [];
  const lenses = normalizeLenses(state.lenses);
  if (lenses.length > 0) parts.push(`lens=${lenses.join(',')}`);
  const query = state.query.trim();
  if (query !== '') parts.push(`q=${encodeURIComponent(query)}`);
  return parts.join('&');
}

export function formatCount(visible: number, total: number): string {
  return `${visible} of ${total} ${total === 1 ? 'entry' : 'entries'}`;
}
