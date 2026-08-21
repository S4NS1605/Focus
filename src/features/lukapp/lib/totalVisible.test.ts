import { describe, it, expect } from 'vitest';
import { totalVisible } from './cajitas';
import type { Cajita, CajitaMovimiento } from '../data/modelos';

/**
 * Estas comprobaciones vivían en PatrimonioCard.test.tsx. Esa tarjeta ya no
 * existe —su número es ahora la cifra grande de Inicio— pero la regla que
 * probaba sigue siendo verdad y ahora la preguntan dos pantallas, así que se
 * comprueba sobre la función que las dos usan.
 */
const cajita = (id: string, tipo: Cajita['tipo']): Cajita => ({
  id,
  nombre: id,
  icon: 'wallet',
  tipo,
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
});

const mov = (cajitaId: string, deltaCop: number): CajitaMovimiento => ({
  id: `m_${cajitaId}_${deltaCop}`,
  cajitaId,
  kind: 'ajuste',
  deltaCop,
  categoria: null,
  occurredOn: '2026-01-01',
  nota: '',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const CAJITAS = [
  cajita('banco', 'cuenta'),
  cajita('ahorro', 'cajita'),
  cajita('tarjeta', 'tarjeta'),
];
const MOVS = [mov('banco', 1_000_000), mov('ahorro', 500_000), mov('tarjeta', 300_000)];

describe('totalVisible', () => {
  it('con los ahorros contados, suma cuentas y ahorros y resta lo que debes', () => {
    // 1.000.000 + 500.000 − 300.000
    expect(totalVisible(CAJITAS, MOVS, [], true)).toBe(1_200_000);
  });

  it('sin contar los ahorros, deja fuera lo guardado', () => {
    // 1.000.000 − 300.000. Los 500.000 del ahorro no entran.
    expect(totalVisible(CAJITAS, MOVS, [], false)).toBe(700_000);
  });

  it('las deudas restan en los dos casos', () => {
    expect(totalVisible(CAJITAS, MOVS, [], true)).toBeLessThan(1_500_000);
    expect(totalVisible(CAJITAS, MOVS, [], false)).toBeLessThan(1_000_000);
  });

  it('sin nada, es cero y no explota', () => {
    expect(totalVisible([], [], [], true)).toBe(0);
    expect(totalVisible([], [], [], false)).toBe(0);
  });
});
