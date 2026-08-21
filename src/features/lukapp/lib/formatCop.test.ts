import { describe, it, expect } from 'vitest';
import { formatAmountInput, formatCop, formatSigned, parseAmountInput } from './formatCop';

describe('formatCop', () => {
  it('groups thousands with dots, es-CO style', () => {
    expect(formatCop(1234567)).toBe('$1.234.567');
    expect(formatCop(45000)).toBe('$45.000');
    expect(formatCop(500)).toBe('$500');
    expect(formatCop(0)).toBe('$0');
  });

  it('rounds to whole pesos', () => {
    expect(formatCop(45000.4)).toBe('$45.000');
    expect(formatCop(45000.6)).toBe('$45.001');
  });

  it('keeps the sign outside the currency symbol', () => {
    expect(formatCop(-45000)).toBe('-$45.000');
  });
});

describe('formatSigned', () => {
  it('marks direction explicitly so colour is never the only cue', () => {
    expect(formatSigned(45000, 'gasto')).toBe('−$45.000');
    expect(formatSigned(45000, 'ingreso')).toBe('+$45.000');
  });
});

describe('amount input round-trip', () => {
  it('formats for display', () => {
    expect(formatAmountInput(1234567)).toBe('1.234.567');
    expect(formatAmountInput(null)).toBe('');
  });

  it('parses whatever grouping the user typed', () => {
    expect(parseAmountInput('1.234.567')).toBe(1234567);
    expect(parseAmountInput('1234567')).toBe(1234567);
    expect(parseAmountInput('$45.000')).toBe(45000);
  });

  it('rejects empty and zero', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('0')).toBeNull();
  });

  it('round-trips', () => {
    for (const value of [500, 45000, 1234567]) {
      expect(parseAmountInput(formatAmountInput(value))).toBe(value);
    }
  });
});
