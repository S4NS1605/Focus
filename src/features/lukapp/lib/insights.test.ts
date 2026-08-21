import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import type { Presupuesto } from './presupuestos';
import { insightsDelMes } from './insights';

const nombreDe = (c: string): string => c.charAt(0).toUpperCase() + c.slice(1);

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t-${Math.random()}`,
  kind: 'gasto',
  amountCop: 20_000,
  category: 'mercado',
  description: 'algo',
  occurredOn: '2026-08-10',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

describe('insightsDelMes — no dice nada sin base real', () => {
  it('sin transacciones no hay nada que decir', () => {
    expect(insightsDelMes([], [], '2026-08', '2026-08-15', nombreDe)).toEqual([]);
  });

  it('no proyecta con menos de tres días de mes', () => {
    const txs = [tx({ occurredOn: '2026-08-01', amountCop: 500_000 })];
    const r = insightsDelMes(txs, [], '2026-08', '2026-08-02', nombreDe);
    expect(r.find((i) => i.id === 'proyeccion-cierre')).toBeUndefined();
  });

  it('no compara categorías sin al menos dos meses de historia', () => {
    const txs = [tx({ occurredOn: '2026-08-05', category: 'comida', amountCop: 200_000 })];
    const r = insightsDelMes(txs, [], '2026-08', '2026-08-15', nombreDe);
    expect(r.find((i) => i.id.startsWith('desviacion'))).toBeUndefined();
  });

  it('una sola compra chiquita no es gasto hormiga', () => {
    const txs = [tx({ amountCop: 5_000 })];
    const r = insightsDelMes(txs, [], '2026-08', '2026-08-15', nombreDe);
    expect(r.find((i) => i.id === 'gasto-hormiga')).toBeUndefined();
  });

  it('sin presupuestos no hay aviso de presupuesto', () => {
    const txs = [tx({ amountCop: 900_000 })];
    const r = insightsDelMes(txs, [], '2026-08', '2026-08-15', nombreDe);
    expect(r.find((i) => i.id.startsWith('presupuesto'))).toBeUndefined();
  });
});

describe('insightsDelMes — sí dice algo cuando hay patrón real', () => {
  it('proyecta el cierre con historia suficiente', () => {
    const txs = Array.from({ length: 10 }, (_, i) =>
      tx({ occurredOn: `2026-08-${String(i + 1).padStart(2, '0')}`, amountCop: 50_000 }),
    );
    const r = insightsDelMes(txs, [], '2026-08', '2026-08-10', nombreDe);
    const p = r.find((i) => i.id === 'proyeccion-cierre');
    expect(p).toBeDefined();
    expect(p?.detalle).toContain('500 mil');
  });

  it('avisa cuando una categoría se disparó contra su propio promedio', () => {
    const junio = Array.from({ length: 3 }, () => tx({ occurredOn: '2026-06-05', category: 'comida', amountCop: 30_000 }));
    const julio = Array.from({ length: 3 }, () => tx({ occurredOn: '2026-07-05', category: 'comida', amountCop: 30_000 }));
    const agosto = Array.from({ length: 5 }, () => tx({ occurredOn: '2026-08-05', category: 'comida', amountCop: 40_000 }));
    const r = insightsDelMes([...junio, ...julio, ...agosto], [], '2026-08', '2026-08-15', nombreDe);
    expect(r.find((i) => i.id === 'desviacion-comida')).toBeDefined();
  });

  it('detecta el gasto hormiga cuando de verdad se acumula', () => {
    const txs = Array.from({ length: 8 }, () => tx({ amountCop: 6_000 }));
    const r = insightsDelMes(txs, [], '2026-08', '2026-08-15', nombreDe);
    const h = r.find((i) => i.id === 'gasto-hormiga');
    expect(h).toBeDefined();
    expect(h?.titulo).toContain('8 compras');
  });

  it('avisa cuando ya te pasaste de un presupuesto', () => {
    const txs = [tx({ category: 'comida', amountCop: 300_000 })];
    const presupuestos: Presupuesto[] = [
      { categoria: 'comida', montoCop: 200_000, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const r = insightsDelMes(txs, presupuestos, '2026-08', '2026-08-15', nombreDe);
    const p = r.find((i) => i.id === 'presupuesto-comida');
    expect(p).toBeDefined();
    expect(p?.tono).toBe('atento');
  });

  it('nunca da más de tres, y el atento va primero', () => {
    // Fuerza los cuatro insights a la vez.
    const historial = ['2026-06', '2026-07'].flatMap((m) =>
      Array.from({ length: 3 }, () => tx({ occurredOn: `${m}-05`, category: 'comida', amountCop: 20_000 })),
    );
    const esteMes = [
      ...Array.from({ length: 10 }, (_, i) =>
        tx({ occurredOn: `2026-08-${String(i + 1).padStart(2, '0')}`, category: 'transporte', amountCop: 50_000 }),
      ),
      ...Array.from({ length: 8 }, () => tx({ category: 'otros', amountCop: 6_000 })),
      ...Array.from({ length: 5 }, () => tx({ category: 'comida', amountCop: 40_000 })),
    ];
    const presupuestos: Presupuesto[] = [
      { categoria: 'transporte', montoCop: 100_000, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const r = insightsDelMes([...historial, ...esteMes], presupuestos, '2026-08', '2026-08-10', nombreDe);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r[0].tono).toBe('atento');
  });
});
