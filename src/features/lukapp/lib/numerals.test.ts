import { describe, it, expect } from 'vitest';
import { NUMERAL_WORDS, normalizeNumericToken, normalizeWord, parseAmount } from './numerals';

describe('normalizeNumericToken', () => {
  it('treats a dot followed by exactly three digits as a thousands separator', () => {
    expect(normalizeNumericToken('45.000')).toEqual(['45000']);
    expect(normalizeNumericToken('1.250.000')).toEqual(['1250000']);
  });

  it('treats a dot followed by one or two digits as a decimal', () => {
    expect(normalizeNumericToken('45.5')).toEqual(['45.5']);
  });

  it('converts the es-CO decimal comma to a dot', () => {
    expect(normalizeNumericToken('45,5')).toEqual(['45.5']);
  });

  it('expands the Colombian apostrophe millions separator', () => {
    expect(normalizeNumericToken("1'200.000")).toEqual(['1200000']);
  });

  it('splits a digit glued to a scale word', () => {
    expect(normalizeNumericToken('20mil')).toEqual(['20', 'mil']);
    expect(normalizeNumericToken('45k')).toEqual(['45', 'k']);
    expect(normalizeNumericToken('2millones')).toEqual(['2', 'millones']);
  });

  it('drops currency noise', () => {
    expect(normalizeNumericToken('$20')).toEqual(['20']);
    expect(normalizeNumericToken('cop')).toEqual([]);
  });

  it('leaves ordinary words untouched', () => {
    expect(normalizeNumericToken('almuerzo')).toEqual(['almuerzo']);
  });
});

describe('normalizeWord', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeWord('Éxito')).toBe('exito');
    expect(normalizeWord('MILLÓN')).toBe('millon');
    expect(normalizeWord('Olímpica')).toBe('olimpica');
  });
});

describe('parseAmount — digits and scales', () => {
  it('reads a digit with a scale word', () => {
    expect(parseAmount('20 mil')).toBe(20000);
    expect(parseAmount('20mil')).toBe(20000);
    expect(parseAmount('20 MIL')).toBe(20000);
  });

  it('reads the k suffix', () => {
    expect(parseAmount('45k')).toBe(45000);
    expect(parseAmount('45 k')).toBe(45000);
    expect(parseAmount('45K')).toBe(45000);
  });

  it('reads es-CO punctuation', () => {
    expect(parseAmount('45.000')).toBe(45000);
    expect(parseAmount('1.250.000')).toBe(1250000);
    expect(parseAmount("1'200.000")).toBe(1200000);
  });
});

describe('parseAmount — word numerals', () => {
  it('reads units, teens and the irregular twenties', () => {
    expect(parseAmount('quince')).toBe(15);
    expect(parseAmount('veintiuno')).toBe(21);
    expect(parseAmount('veintitrés')).toBe(23);
  });

  it('reads tens joined by "y"', () => {
    expect(parseAmount('treinta y cinco')).toBe(35);
    expect(parseAmount('noventa y nueve')).toBe(99);
  });

  it('reads hundreds', () => {
    expect(parseAmount('cien')).toBe(100);
    expect(parseAmount('ciento veinte')).toBe(120);
    expect(parseAmount('quinientos')).toBe(500);
    expect(parseAmount('novecientos noventa y nueve')).toBe(999);
  });

  it('reads feminine forms', () => {
    expect(parseAmount('doscientas mil')).toBe(200000);
    expect(parseAmount('quinientas')).toBe(500);
    expect(parseAmount('una')).toBe(1);
  });

  it('is diacritic-insensitive', () => {
    expect(parseAmount('millon')).toBe(parseAmount('millón'));
    expect(parseAmount('veintitres mil')).toBe(parseAmount('veintitrés mil'));
  });
});

describe('parseAmount — the three-register machine', () => {
  it('reads a bare scale as one of it', () => {
    expect(parseAmount('mil')).toBe(1000);
    expect(parseAmount('un millón')).toBe(1000000);
  });

  it('reads thousands groups', () => {
    expect(parseAmount('quince mil')).toBe(15000);
    expect(parseAmount('dos mil quinientos')).toBe(2500);
    expect(parseAmount('ciento veinte mil')).toBe(120000);
    expect(parseAmount('treinta y cinco mil')).toBe(35000);
    expect(parseAmount('novecientos noventa y nueve mil novecientos noventa y nueve')).toBe(999999);
  });

  // This is the case two registers cannot represent: the thousands group has to
  // be finalized separately before the million scale is applied.
  it('reads a millions group containing a thousands group', () => {
    expect(parseAmount('un millón doscientos mil')).toBe(1200000);
    expect(parseAmount('tres millones quinientos mil')).toBe(3500000);
    expect(parseAmount('mil millones')).toBe(1000000000);
  });

  it('mixes digits and words in the same numeral', () => {
    expect(parseAmount('1 millón 200 mil')).toBe(1200000);
  });
});

describe('parseAmount — Colombian slang', () => {
  it('treats luca/palo/melón as scale words', () => {
    expect(parseAmount('20 lucas')).toBe(20000);
    expect(parseAmount('veinte lucas')).toBe(20000);
    expect(parseAmount('50 luquitas')).toBe(50000);
    expect(parseAmount('2 palos')).toBe(2000000);
    expect(parseAmount('un melón')).toBe(1000000);
  });
});

describe('parseAmount — halves and decimals', () => {
  it('reads medio/media applied to a scale', () => {
    expect(parseAmount('medio millón')).toBe(500000);
    expect(parseAmount('media luca')).toBe(500);
  });

  it('multiplies a decimal by its scale', () => {
    expect(parseAmount('45,5 mil')).toBe(45500);
    expect(parseAmount('1,5 millones')).toBe(1500000);
  });

  it('halves the preceding scale for a trailing "y medio"', () => {
    expect(parseAmount('dos millones y medio')).toBe(2500000);
    expect(parseAmount('dos mil y medio')).toBe(2500);
  });
});

describe('parseAmount — rejections', () => {
  it('returns null when there is no numeral', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('hola')).toBeNull();
    expect(parseAmount('plata')).toBeNull();
    expect(parseAmount('y')).toBeNull();
  });

  it('returns null for zero and for a bare half', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('cero')).toBeNull();
    expect(parseAmount('medio')).toBeNull();
  });

  it('returns null above the sanity cap', () => {
    expect(parseAmount('99999999999999')).toBeNull();
  });

  it('stops at a second numeral instead of merging them', () => {
    expect(parseAmount('20 mil 30 mil')).toBe(20000);
    expect(parseAmount('2 millones 3 millones')).toBe(2000000);
  });

  it('still reads a units group that follows a scale', () => {
    expect(parseAmount('2 mil 500')).toBe(2500);
    expect(parseAmount('mil quinientos')).toBe(1500);
  });
});

describe('purity', () => {
  it('returns the same result for the same input', () => {
    const input = 'un millón doscientos mil';
    expect(parseAmount(input)).toBe(parseAmount(input));
  });

  it('does not mutate its input', () => {
    const input = 'gasté 45.000 en mercado';
    const copy = `${input}`;
    parseAmount(input);
    expect(input).toBe(copy);
  });
});

describe('NUMERAL_WORDS', () => {
  it('covers every word the reader can consume', () => {
    for (const w of [
      'mil',
      'millon',
      'lucas',
      'palo',
      'medio',
      'quince',
      'veinte',
      'cien',
      'y',
      'k',
    ]) {
      expect(NUMERAL_WORDS.has(w)).toBe(true);
    }
  });

  it('is already normalized, so every entry can actually match', () => {
    for (const w of NUMERAL_WORDS) {
      expect(w).toBe(normalizeWord(w));
    }
  });
});
