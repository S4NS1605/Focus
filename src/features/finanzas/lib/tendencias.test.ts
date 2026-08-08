import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { compararCategorias, promedioMensual, serieMensual, ultimosMeses } from './tendencias';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 10000,
  category: 'comida',
  description: '',
  occurredOn: '2026-08-06',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-06T00:00:00.000Z',
  ...over,
});

describe('ultimosMeses', () => {
  it('returns the window oldest first, ending at the given month', () => {
    expect(ultimosMeses('2026-08', 3)).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('rolls back across a year boundary', () => {
    expect(ultimosMeses('2026-01', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('serieMensual', () => {
  it('keeps months with no activity as explicit zero points', () => {
    const serie = serieMensual(
      [tx({ occurredOn: '2026-06-10' }), tx({ id: 't2', occurredOn: '2026-08-02' })],
      ultimosMeses('2026-08', 3),
    );

    expect(serie.map((p) => p.month)).toEqual(['2026-06', '2026-07', '2026-08']);
    // July had nothing — it must still be a point, or the chart compresses time.
    expect(serie[1]).toMatchObject({ month: '2026-07', ingresos: 0, gastos: 0 });
  });

  it('separates income from expenses', () => {
    const serie = serieMensual(
      [
        tx({ id: 'a', kind: 'ingreso', amountCop: 2000000, occurredOn: '2026-08-01' }),
        tx({ id: 'b', kind: 'gasto', amountCop: 500000, occurredOn: '2026-08-02' }),
      ],
      ['2026-08'],
    );

    expect(serie[0]).toMatchObject({ ingresos: 2000000, gastos: 500000, balance: 1500000 });
  });
});

describe('compararCategorias', () => {
  it('reports the change per category, biggest rise first', () => {
    const transacciones = [
      tx({ id: 'a', category: 'comida', amountCop: 300000, occurredOn: '2026-08-01' }),
      tx({ id: 'b', category: 'comida', amountCop: 100000, occurredOn: '2026-07-01' }),
      tx({ id: 'c', category: 'transporte', amountCop: 50000, occurredOn: '2026-08-01' }),
      tx({ id: 'd', category: 'transporte', amountCop: 90000, occurredOn: '2026-07-01' }),
    ];

    const cambios = compararCategorias(transacciones, '2026-08', '2026-07');

    expect(cambios[0]).toMatchObject({ category: 'comida', deltaCop: 200000, deltaPct: 200 });
    expect(cambios[1]).toMatchObject({ category: 'transporte', deltaCop: -40000 });
  });

  it('reports a category that vanished rather than dropping it', () => {
    const cambios = compararCategorias(
      [tx({ category: 'ropa', amountCop: 80000, occurredOn: '2026-07-15' })],
      '2026-08',
      '2026-07',
    );

    expect(cambios).toHaveLength(1);
    expect(cambios[0]).toMatchObject({ category: 'ropa', actualCop: 0, deltaCop: -80000 });
  });

  it('has no percentage for spending that started from nothing', () => {
    const cambios = compararCategorias(
      [tx({ category: 'salud', amountCop: 120000, occurredOn: '2026-08-03' })],
      '2026-08',
      '2026-07',
    );

    // 0 -> 120.000 is new, not infinite growth.
    expect(cambios[0].deltaPct).toBeNull();
    expect(cambios[0].deltaCop).toBe(120000);
  });

  it('only compares the requested direction', () => {
    const cambios = compararCategorias(
      [
        tx({ id: 'a', kind: 'ingreso', category: 'ingreso', amountCop: 900000, occurredOn: '2026-08-01' }),
        tx({ id: 'b', kind: 'gasto', category: 'comida', amountCop: 10000, occurredOn: '2026-08-01' }),
      ],
      '2026-08',
      '2026-07',
      'ingreso',
    );

    expect(cambios.map((c) => c.category)).toEqual(['ingreso']);
  });
});

describe('promedioMensual', () => {
  it('averages only the months that had activity', () => {
    const serie = serieMensual(
      [
        tx({ id: 'a', amountCop: 100000, occurredOn: '2026-07-01' }),
        tx({ id: 'b', amountCop: 300000, occurredOn: '2026-08-01' }),
      ],
      ultimosMeses('2026-08', 4),
    );

    const promedio = promedioMensual(serie);

    // Two empty months are excluded: they mean "not recorded", not "spent zero".
    expect(promedio.meses).toBe(2);
    expect(promedio.gastos).toBe(200000);
  });

  it('is all zeroes when there is nothing at all', () => {
    expect(promedioMensual(serieMensual([], ultimosMeses('2026-08', 3)))).toEqual({
      ingresos: 0,
      gastos: 0,
      balance: 0,
      meses: 0,
    });
  });
});
