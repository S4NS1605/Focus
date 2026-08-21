import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { byCategory, forMonth, monthTotals, monthsPresent } from './aggregate';

let seq = 0;
const tx = (
  kind: Transaction['kind'],
  amountCop: number,
  category: Transaction['category'],
  occurredOn = '2026-07-15',
): Transaction => {
  seq += 1;
  return {
    id: `tx-${seq}`,
    kind,
    amountCop,
    category,
    description: category,
    occurredOn,
    cuentaId: null,
    rawTranscript: '',
    createdAt: `2026-07-15T00:00:${String(seq).padStart(2, '0')}Z`,
  };
};

describe('monthTotals', () => {
  it('sums each direction independently', () => {
    const t = monthTotals([
      tx('ingreso', 2_000_000, 'ingreso'),
      tx('gasto', 45_000, 'mercado'),
      tx('gasto', 15_000, 'comida'),
    ]);
    expect(t.ingresos).toBe(2_000_000);
    expect(t.gastos).toBe(60_000);
    expect(t.balance).toBe(1_940_000);
  });

  it('computes the savings rate off income', () => {
    const t = monthTotals([tx('ingreso', 1_000_000, 'ingreso'), tx('gasto', 250_000, 'mercado')]);
    expect(t.tasaAhorro).toBe(75);
  });

  it('reports a negative savings rate when spending outran income', () => {
    const t = monthTotals([tx('ingreso', 100_000, 'ingreso'), tx('gasto', 150_000, 'mercado')]);
    expect(t.tasaAhorro).toBe(-50);
  });

  // "0% saved" and "no income recorded" must not render identically.
  it('returns null rather than 0 when there is no income', () => {
    expect(monthTotals([tx('gasto', 45_000, 'mercado')]).tasaAhorro).toBeNull();
    expect(monthTotals([]).tasaAhorro).toBeNull();
  });

  it('is all zeros for no transactions', () => {
    expect(monthTotals([])).toEqual({ ingresos: 0, gastos: 0, balance: 0, tasaAhorro: null });
  });
});

describe('byCategory', () => {
  it('groups, sorts largest first, and percentages to the direction total', () => {
    const slices = byCategory(
      [
        tx('gasto', 30_000, 'comida'),
        tx('gasto', 60_000, 'mercado'),
        tx('gasto', 10_000, 'comida'),
        tx('ingreso', 900_000, 'ingreso'),
      ],
      'gasto',
    );

    expect(slices.map((s) => s.category)).toEqual(['mercado', 'comida']);
    expect(slices[0]).toEqual({ category: 'mercado', total: 60_000, pct: 60 });
    expect(slices[1]).toEqual({ category: 'comida', total: 40_000, pct: 40 });
  });

  it('percentages sum to ~100 for the requested direction only', () => {
    const slices = byCategory(
      [
        tx('gasto', 33_333, 'mercado'),
        tx('gasto', 33_333, 'comida'),
        tx('gasto', 33_334, 'transporte'),
        tx('ingreso', 5_000_000, 'ingreso'),
      ],
      'gasto',
    );
    const sum = slices.reduce((acc, s) => acc + s.pct, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.3);
  });

  it('never lets a category exceed 100% when spending outran income', () => {
    const slices = byCategory(
      [tx('ingreso', 10_000, 'ingreso'), tx('gasto', 900_000, 'mercado')],
      'gasto',
    );
    expect(slices[0].pct).toBe(100);
  });

  it('breaks ties deterministically', () => {
    const a = byCategory([tx('gasto', 1_000, 'mercado'), tx('gasto', 1_000, 'comida')], 'gasto');
    const b = byCategory([tx('gasto', 1_000, 'comida'), tx('gasto', 1_000, 'mercado')], 'gasto');
    expect(a.map((s) => s.category)).toEqual(b.map((s) => s.category));
  });

  it('is empty when nothing matches the direction', () => {
    expect(byCategory([tx('ingreso', 100, 'ingreso')], 'gasto')).toEqual([]);
    expect(byCategory([], 'gasto')).toEqual([]);
  });
});

describe('forMonth / monthsPresent', () => {
  it('filters by Bogota month key', () => {
    const all = [
      tx('gasto', 1_000, 'mercado', '2026-07-01'),
      tx('gasto', 2_000, 'mercado', '2026-07-31'),
      tx('gasto', 3_000, 'mercado', '2026-08-01'),
    ];
    expect(forMonth(all, '2026-07')).toHaveLength(2);
    expect(forMonth(all, '2026-08')).toHaveLength(1);
    expect(forMonth(all, '2026-09')).toHaveLength(0);
  });

  it('lists distinct months newest first', () => {
    const all = [
      tx('gasto', 1_000, 'mercado', '2026-06-10'),
      tx('gasto', 1_000, 'mercado', '2026-08-10'),
      tx('gasto', 1_000, 'mercado', '2026-07-10'),
      tx('gasto', 1_000, 'mercado', '2026-07-11'),
    ];
    expect(monthsPresent(all)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('is empty for no transactions', () => {
    expect(monthsPresent([])).toEqual([]);
  });
});
