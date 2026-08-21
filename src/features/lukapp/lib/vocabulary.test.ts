import { describe, it, expect } from 'vitest';
import { CATEGORIES } from '../types';
import type { Category } from '../types';
import { NUMERAL_WORDS, normalizeWord } from './numerals';
import {
  AMOUNT_CUES,
  CATEGORY_KEYWORDS,
  COUNT_NOUNS,
  INCOME_IMPLIED,
  KIND_PHRASES,
  KIND_WORDS,
  MERCHANTS,
  MERCHANT_DISPLAY,
} from './vocabulary';

const intersect = (a: Iterable<string>, b: ReadonlySet<string>): string[] =>
  [...a].filter((x) => b.has(x));

// These are the highest-value tests in the suite. A keyword that collides with a
// numeral word silently corrupts amounts, and the symptom shows up months later
// as "it read the wrong number sometimes".
describe('vocabulary / numeral disjointness', () => {
  it('has no category keyword that is also a numeral word', () => {
    expect(intersect(Object.keys(CATEGORY_KEYWORDS), NUMERAL_WORDS)).toEqual([]);
  });

  it('has no direction word that is also a numeral word', () => {
    expect(intersect(KIND_WORDS, NUMERAL_WORDS)).toEqual([]);
  });

  it('has no merchant name that is also a numeral word', () => {
    expect(intersect(Object.keys(MERCHANTS), NUMERAL_WORDS)).toEqual([]);
  });

  it('has no count noun that is also a numeral word', () => {
    expect(intersect(COUNT_NOUNS, NUMERAL_WORDS)).toEqual([]);
  });
});

describe('vocabulary / normalization', () => {
  const allKeys = [
    ...Object.keys(CATEGORY_KEYWORDS),
    ...Object.keys(MERCHANTS),
    ...KIND_WORDS,
    ...COUNT_NOUNS,
    ...INCOME_IMPLIED,
    ...AMOUNT_CUES,
  ];

  it('stores every key already normalized, so each one can actually match', () => {
    const unnormalized = allKeys.filter((k) => k !== normalizeWord(k));
    expect(unnormalized).toEqual([]);
  });

  it('has no multi-word key, since matching is per token', () => {
    expect(allKeys.filter((k) => /\s/.test(k))).toEqual([]);
  });
});

describe('vocabulary / structure', () => {
  it('maps every merchant to a real category', () => {
    const categories: readonly string[] = CATEGORIES;
    const bad = Object.entries(MERCHANTS).filter(([, c]) => !categories.includes(c));
    expect(bad).toEqual([]);
  });

  it('gives every category except "otros" at least one way to be detected', () => {
    const detectable = new Set<Category>([
      ...Object.values(CATEGORY_KEYWORDS),
      ...Object.values(MERCHANTS),
    ]);
    const missing = CATEGORIES.filter((c) => c !== 'otros' && !detectable.has(c));
    expect(missing).toEqual([]);
  });

  it('only has display names for merchants that exist', () => {
    const orphans = Object.keys(MERCHANT_DISPLAY).filter((k) => !(k in MERCHANTS));
    expect(orphans).toEqual([]);
  });

  it('classifies every income-implying word as the ingreso category', () => {
    const wrong = [...INCOME_IMPLIED].filter((w) => CATEGORY_KEYWORDS[w] !== 'ingreso');
    expect(wrong).toEqual([]);
  });
});

describe('KIND_PHRASES', () => {
  // If a shorter phrase were tested first, "me costó" would match a bare "me"
  // rule and be classified as income, which is exactly backwards.
  it('is ordered longest sequence first', () => {
    const lengths = KIND_PHRASES.map((p) => p.seq.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
  });

  it('has no duplicate phrase', () => {
    const keys = KIND_PHRASES.map((p) => p.seq.join(' '));
    expect(keys.length).toBe(new Set(keys).size);
  });

  it('puts "me costó" ahead of every single-token rule', () => {
    const meCosto = KIND_PHRASES.findIndex((p) => p.seq.join(' ') === 'me costo');
    const firstSingle = KIND_PHRASES.findIndex((p) => p.seq.length === 1);
    expect(meCosto).toBeGreaterThanOrEqual(0);
    expect(meCosto).toBeLessThan(firstSingle);
  });

  it('keeps the pairwise traps on opposite sides', () => {
    const kindOf = (phrase: string) => KIND_PHRASES.find((p) => p.seq.join(' ') === phrase)?.kind;

    expect(kindOf('me costo')).toBe('gasto');
    expect(kindOf('me pagaron')).toBe('ingreso');
    expect(kindOf('pague')).toBe('gasto');
    expect(kindOf('abone')).toBe('gasto');
    expect(kindOf('me abonaron')).toBe('ingreso');
    expect(kindOf('consigne')).toBe('gasto');
    expect(kindOf('me consignaron')).toBe('ingreso');
  });
});
