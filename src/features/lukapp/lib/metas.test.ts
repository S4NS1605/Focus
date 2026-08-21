import { describe, it, expect } from 'vitest';
import type { Meta } from '../data/modelos';
import { metasConProgreso, progresoDeMeta } from './metas';

const meta = (over: Partial<Meta> = {}): Meta => ({
  id: 'meta-1',
  nombre: 'Viaje',
  icon: '✈️',
  objetivoCop: 1000000,
  fechaObjetivo: null,
  cajitaId: null,
  ahorradoCop: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  ...over,
});

const HOY = '2026-08-06';

describe('progresoDeMeta', () => {
  it('reads progress from the linked pocket', () => {
    const saldos = new Map([['c1', 250000]]);

    const progreso = progresoDeMeta(meta({ cajitaId: 'c1', ahorradoCop: 999 }), saldos, HOY);

    // The pocket wins; the goal's own field is ignored while linked.
    expect(progreso.ahorradoCop).toBe(250000);
    expect(progreso.pct).toBe(25);
  });

  it('falls back to the manual figure when unlinked', () => {
    const progreso = progresoDeMeta(meta({ cajitaId: null, ahorradoCop: 400000 }), new Map(), HOY);

    expect(progreso.ahorradoCop).toBe(400000);
    expect(progreso.pct).toBe(40);
  });

  it('treats a linked pocket with no movements as zero', () => {
    const progreso = progresoDeMeta(meta({ cajitaId: 'ausente' }), new Map(), HOY);

    expect(progreso.ahorradoCop).toBe(0);
    expect(progreso.faltaCop).toBe(1000000);
  });

  it('never reports a negative shortfall once met', () => {
    const progreso = progresoDeMeta(meta({ ahorradoCop: 1500000 }), new Map(), HOY);

    expect(progreso.completada).toBe(true);
    expect(progreso.faltaCop).toBe(0);
    expect(progreso.pct).toBe(100);
  });

  it('computes the monthly pace needed to hit the date', () => {
    // 1.000.000 still to save over roughly 3 months.
    const progreso = progresoDeMeta(
      meta({ fechaObjetivo: '2026-11-04', ahorradoCop: 0 }),
      new Map(),
      HOY,
    );

    expect(progreso.diasRestantes).toBe(90);
    // 1.000.000 / (90 / 30.44) ≈ 338.223
    expect(progreso.ritmoMensualCop).toBe(338223);
  });

  it('has no pace for an open-ended goal', () => {
    const progreso = progresoDeMeta(meta({ fechaObjetivo: null }), new Map(), HOY);

    expect(progreso.diasRestantes).toBeNull();
    expect(progreso.ritmoMensualCop).toBeNull();
  });

  it('has no pace once the goal is met', () => {
    const progreso = progresoDeMeta(
      meta({ fechaObjetivo: '2026-12-31', ahorradoCop: 1000000 }),
      new Map(),
      HOY,
    );

    expect(progreso.ritmoMensualCop).toBeNull();
  });

  it('reports an overdue goal as negative days and no pace', () => {
    const progreso = progresoDeMeta(meta({ fechaObjetivo: '2026-08-01' }), new Map(), HOY);

    expect(progreso.diasRestantes).toBe(-5);
    // A required monthly pace for a deadline in the past is not a number.
    expect(progreso.ritmoMensualCop).toBeNull();
  });

  it('survives a zero target without dividing by zero', () => {
    const progreso = progresoDeMeta(meta({ objetivoCop: 0, ahorradoCop: 0 }), new Map(), HOY);

    expect(progreso.pct).toBe(0);
    expect(progreso.completada).toBe(false);
  });
});

describe('metasConProgreso', () => {
  it('puts the nearest deadline first and completed goals last', () => {
    const filas = metasConProgreso(
      [
        meta({ id: 'lejana', nombre: 'Lejana', fechaObjetivo: '2026-12-31' }),
        meta({ id: 'lista', nombre: 'Lista', ahorradoCop: 1000000, fechaObjetivo: '2026-08-10' }),
        meta({ id: 'cercana', nombre: 'Cercana', fechaObjetivo: '2026-09-01' }),
      ],
      new Map(),
      HOY,
    );

    expect(filas.map((f) => f.meta.id)).toEqual(['cercana', 'lejana', 'lista']);
  });

  it('sorts open-ended goals after dated ones', () => {
    const filas = metasConProgreso(
      [
        meta({ id: 'abierta', nombre: 'Abierta', fechaObjetivo: null }),
        meta({ id: 'con-fecha', nombre: 'Con fecha', fechaObjetivo: '2027-01-01' }),
      ],
      new Map(),
      HOY,
    );

    expect(filas.map((f) => f.meta.id)).toEqual(['con-fecha', 'abierta']);
  });
});
