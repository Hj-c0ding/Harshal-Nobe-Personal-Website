import { describe, expect, it } from 'vitest';
import { entries } from '../src/data/entries';
import {
  DEFAULT_STATE,
  filterEntries,
  formatCount,
  normalizeLenses,
  parseHash,
  serializeHash,
  toggleLens,
  type LensState,
  type Searchable,
} from '../src/lib/lenses';

const fixture: Searchable[] = [
  { id: 'a', title: 'Price Model', summary: 'XGBoost on housing data.', tags: ['data'] },
  { id: 'b', title: 'Fynder', summary: 'A Django app.', tags: ['fullstack'] },
  { id: 'c', title: 'FBLA', summary: 'Led state chapters.', tags: ['leadership'] },
  {
    id: 'd',
    title: 'Pipeline',
    summary: 'Python + OpenAI API automation.',
    tags: ['data', 'cloud'],
  },
  { id: 'e', title: 'AWS Cert', summary: 'Cloud Practitioner.', tags: ['cloud'] },
];

const ids = (list: readonly Searchable[]): string[] => list.map((entry) => entry.id);
const state = (lenses: LensState['lenses'], query = ''): LensState => ({ lenses, query });

describe('filterEntries', () => {
  it('filters by a single lens', () => {
    expect(ids(filterEntries(fixture, state(['leadership'])))).toEqual(['c']);
  });

  it('combines multiple lenses with OR', () => {
    expect(ids(filterEntries(fixture, state(['fullstack', 'cloud'])))).toEqual([
      'b',
      'd',
      'e',
    ]);
  });

  it('narrows a lens selection with the search query', () => {
    expect(ids(filterEntries(fixture, state(['data', 'cloud'], 'openai')))).toEqual([
      'd',
    ]);
  });

  it('returns every entry for "All" (no lenses, no query)', () => {
    expect(filterEntries(fixture, DEFAULT_STATE)).toEqual(fixture);
  });

  it('returns [] when nothing matches', () => {
    expect(filterEntries(fixture, state([], 'quantum chromodynamics'))).toEqual([]);
    expect(filterEntries(fixture, state(['leadership'], 'django'))).toEqual([]);
  });

  it('matches case-insensitively across title, summary, and tags', () => {
    expect(ids(filterEntries(fixture, state([], 'DJANGO')))).toEqual(['b']);
    expect(ids(filterEntries(fixture, state([], 'fynder')))).toEqual(['b']);
    expect(ids(filterEntries(fixture, state([], 'LEADERSHIP')))).toEqual(['c']);
  });

  it('ignores a whitespace-only query', () => {
    expect(filterEntries(fixture, state([], '   \t  '))).toEqual(fixture);
    expect(ids(filterEntries(fixture, state(['cloud'], '  ')))).toEqual(['d', 'e']);
  });

  it('works on the real site data (7 entries, expected lens counts)', () => {
    expect(entries).toHaveLength(7);
    expect(filterEntries(entries, state(['data']))).toHaveLength(3);
    expect(filterEntries(entries, state(['leadership']))).toHaveLength(2);
    expect(ids(filterEntries(entries, state([], 'django')))).toEqual(['fynder']);
  });
});

describe('toggleLens', () => {
  it('adds, removes, and clears lenses via "all"', () => {
    const one = toggleLens(DEFAULT_STATE, 'cloud');
    expect(one.lenses).toEqual(['cloud']);
    const two = toggleLens(one, 'data');
    expect(two.lenses).toEqual(['data', 'cloud']);
    expect(toggleLens(two, 'cloud').lenses).toEqual(['data']);
    expect(toggleLens({ lenses: ['data'], query: 'x' }, 'all')).toEqual({
      lenses: [],
      query: 'x',
    });
  });
});

describe('URL hash', () => {
  it('round-trips parse(serialize(state))', () => {
    const original = state(['data', 'leadership'], 'django');
    const hash = serializeHash(original);
    expect(hash).toBe('lens=data,leadership&q=django');
    expect(parseHash(`#${hash}`)).toEqual(original);
  });

  it('round-trips queries with reserved characters', () => {
    const original = state(['cloud'], 'c++ & sql = fun');
    expect(parseHash(`#${serializeHash(original)}`)).toEqual(original);
  });

  it('serializes the default state to an empty string', () => {
    expect(serializeHash(DEFAULT_STATE)).toBe('');
    expect(serializeHash(state([], '   '))).toBe('');
  });

  it('ignores invalid and unknown values without throwing', () => {
    expect(parseHash('#lens=bogus,DATA,,%20cloud%20&q=')).toEqual(
      state(['data', 'cloud'], ''),
    );
    expect(parseHash('#lens=all')).toEqual(DEFAULT_STATE);
    expect(() => parseHash('#%E0%A4%A&lens=%ZZ&&==')).not.toThrow();
    expect(parseHash('#%E0%A4%A&lens=%ZZ&&==').lenses).toEqual([]);
    expect(parseHash('')).toEqual(DEFAULT_STATE);
    expect(parseHash('#garbage')).toEqual(DEFAULT_STATE);
  });

  it('dedupes repeated lens values', () => {
    expect(parseHash('#lens=data,data,Data,leadership,data').lenses).toEqual([
      'data',
      'leadership',
    ]);
    expect(normalizeLenses(['cloud', 'cloud'])).toEqual(['cloud']);
  });
});

describe('formatCount', () => {
  it('formats the live count text', () => {
    expect(formatCount(3, 7)).toBe('3 of 7 entries');
    expect(formatCount(0, 1)).toBe('0 of 1 entry');
  });
});
