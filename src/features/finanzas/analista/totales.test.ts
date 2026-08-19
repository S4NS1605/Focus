import { describe, it, expect } from 'vitest';
import type { AnalisisResultado, MovimientoExtraido } from './tipos';
import { metricasCoherentes, rebanadasDelAnalisis, totalesDelAnalisis } from './totales';

const mov = (
  tipo: MovimientoExtraido['tipo'],
  montoCop: number,
  categoria: MovimientoExtraido['categoria'],
  exclusion: MovimientoExtraido['exclusion'] = null,
): MovimientoExtraido => ({
  fecha: '2026-07-15',
  descripcion: categoria,
  montoCop,
  tipo,
  categoria,
  confianza: 'alta',
  exclusion,
});

describe('totalesDelAnalisis', () => {
  it('sums each direction', () => {
    const t = totalesDelAnalisis([
      mov('ingreso', 2_000_000, 'ingreso'),
      mov('gasto', 180_000, 'mercado'),
      mov('gasto', 45_000, 'transporte'),
    ]);
    expect(t).toMatchObject({
      ingresos: 2_000_000,
      gastos: 225_000,
      balance: 1_775_000,
      contados: 3,
    });
  });

  // The whole reason this module exists.
  it('leaves an internal transfer out of both sides', () => {
    const t = totalesDelAnalisis([
      mov('ingreso', 1_000_000, 'ingreso'),
      mov('ingreso', 500_000, 'transferencia', 'traslado-propio'),
      mov('gasto', 500_000, 'transferencia', 'traslado-propio'),
    ]);
    expect(t.ingresos).toBe(1_000_000);
    expect(t.gastos).toBe(0);
    expect(t.contados).toBe(1);
  });

  it('leaves a credit-card payment out of spending', () => {
    const t = totalesDelAnalisis([
      mov('gasto', 90_000, 'ropa'),
      mov('gasto', 90_000, 'transferencia', 'pago-tarjeta'),
    ]);
    // Counting both would report 180.000 spent on a single 90.000 shirt.
    expect(t.gastos).toBe(90_000);
  });

  it('reports what it excluded instead of dropping it silently', () => {
    const t = totalesDelAnalisis([
      mov('gasto', 300_000, 'transferencia', 'pago-tarjeta'),
      mov('gasto', 200_000, 'transferencia', 'pago-tarjeta'),
      mov('gasto', 50_000, 'transferencia', 'traslado-propio'),
    ]);
    expect(t.excluidos).toEqual([
      { motivo: 'Pagos a tarjeta de crédito', cuantos: 2, montoCop: 500_000 },
      { motivo: 'Traslados entre tus cuentas', cuantos: 1, montoCop: 50_000 },
    ]);
  });

  it('handles reversals and balance rows', () => {
    const t = totalesDelAnalisis([
      mov('gasto', 45_000, 'comida'),
      mov('ingreso', 45_000, 'comida', 'reverso'),
      mov('ingreso', 9_999_999, 'otros', 'saldo-informativo'),
    ]);
    expect(t.ingresos).toBe(0);
    expect(t.gastos).toBe(45_000);
  });

  it('is all zeros for an empty statement', () => {
    expect(totalesDelAnalisis([])).toMatchObject({
      ingresos: 0,
      gastos: 0,
      balance: 0,
      contados: 0,
    });
  });

  it('is all zeros when every row is excluded', () => {
    const t = totalesDelAnalisis([mov('gasto', 100, 'otros', 'saldo-informativo')]);
    expect(t).toMatchObject({ ingresos: 0, gastos: 0, contados: 0 });
    expect(t.excluidos).toHaveLength(1);
  });
});

describe('rebanadasDelAnalisis', () => {
  it('ignores excluded rows when computing shares', () => {
    const rebanadas = rebanadasDelAnalisis(
      [
        mov('gasto', 60_000, 'mercado'),
        mov('gasto', 40_000, 'comida'),
        mov('gasto', 900_000, 'transferencia', 'pago-tarjeta'),
      ],
      'gasto',
    );
    expect(rebanadas).toEqual([
      { categoria: 'mercado', total: 60_000, pct: 60 },
      { categoria: 'comida', total: 40_000, pct: 40 },
    ]);
  });

  it('is empty when nothing counts', () => {
    expect(rebanadasDelAnalisis([mov('gasto', 1, 'otros', 'reverso')], 'gasto')).toEqual([]);
  });
});

describe('metricasCoherentes', () => {
  const base = (movimientos: MovimientoExtraido[], gastoDeclarado: number): AnalisisResultado => ({
    periodo: { desde: '2026-07-01', hasta: '2026-07-31', etiqueta: 'julio 2026' },
    veredicto: '',
    metricas: [{ etiqueta: 'Gasto total', valorCop: gastoDeclarado, nota: null }],
    alertas: [],
    recomendaciones: [],
    movimientos,
    advertencias: [],
  });

  it('accepts a metrics table that matches the movements', () => {
    const movimientos = [mov('gasto', 100_000, 'mercado')];
    expect(metricasCoherentes(base(movimientos, 100_000))).toBe(true);
  });

  it('tolerates small rounding differences', () => {
    const movimientos = [mov('gasto', 100_000, 'mercado')];
    expect(metricasCoherentes(base(movimientos, 101_000))).toBe(true);
  });

  // If the narrative was written against numbers the auditable movement list
  // does not support, the UI must be able to say so.
  it('rejects a metrics table that contradicts the movements', () => {
    const movimientos = [mov('gasto', 100_000, 'mercado')];
    expect(metricasCoherentes(base(movimientos, 400_000))).toBe(false);
  });

  it('does not fail when there is nothing to compare', () => {
    expect(metricasCoherentes(base([], 0))).toBe(true);
  });
});
