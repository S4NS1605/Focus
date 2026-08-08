import { describe, it, expect } from 'vitest';
import type { CajitaMovimiento } from '../data/modelos';
import { rendimientoDiario, rendimientoEstimado, tasaDiaria } from './rendimiento';

const mov = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'm1',
  cajitaId: 'c1',
  kind: 'deposito',
  deltaCop: 1_000_000,
  occurredOn: '2026-01-01',
  nota: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('tasaDiaria', () => {
  it('is the 365th root, not a division', () => {
    const diaria = tasaDiaria(13);

    // EA already includes compounding: 13/365 = 0.0003562 would overstate it.
    expect(diaria).toBeCloseTo(0.0003349, 7);
    expect(diaria).toBeLessThan(0.13 / 365);
  });

  it('compounds back to exactly the annual rate over 365 days', () => {
    // The defining property: a year of daily rates must equal the E.A. figure.
    expect(Math.pow(1 + tasaDiaria(13), 365) - 1).toBeCloseTo(0.13, 10);
  });

  it('is zero for a zero rate', () => {
    expect(tasaDiaria(0)).toBe(0);
  });
});

describe('rendimientoDiario', () => {
  it('is a balance times the daily rate', () => {
    // 1.000.000 at 13% E.A. earns ~335 pesos on day one.
    expect(Math.round(rendimientoDiario(1_000_000, 13))).toBe(335);
  });
});

describe('rendimientoEstimado', () => {
  it('has nothing to report without a rate', () => {
    expect(rendimientoEstimado([mov()], 'c1', null, '2026-06-01')).toBeNull();
  });

  it('has nothing to report without movements', () => {
    expect(rendimientoEstimado([], 'c1', 13, '2026-06-01')).toBeNull();
  });

  it('accrues a full year to the annual rate', () => {
    const r = rendimientoEstimado([mov({ deltaCop: 1_000_000 })], 'c1', 13, '2027-01-01');

    // A million held one full year at 13% E.A. is 130.000, by definition.
    expect(r!.acumuladoCop).toBe(130_000);
    expect(r!.dias).toBe(365);
  });

  it('does not pretend today\'s balance was there all along', () => {
    // 1M sat for a year; another 1M arrived only yesterday.
    const r = rendimientoEstimado(
      [
        mov({ id: 'viejo', deltaCop: 1_000_000, occurredOn: '2026-01-01' }),
        mov({ id: 'nuevo', deltaCop: 1_000_000, occurredOn: '2026-12-31', createdAt: '2026-12-31T00:00:00.000Z' }),
      ],
      'c1',
      13,
      '2027-01-01',
    );

    // Naively taking the final 2M balance for the whole year would say 260.000.
    expect(r!.acumuladoCop).toBeGreaterThan(129_000);
    expect(r!.acumuladoCop).toBeLessThan(132_000);
  });

  it('compounds rather than adding simple interest', () => {
    const r = rendimientoEstimado([mov({ deltaCop: 1_000_000 })], 'c1', 13, '2028-01-01');

    // Two years compounded is 1.13^2 - 1 = 27.69%, not 26%.
    expect(r!.acumuladoCop).toBeGreaterThan(276_000);
    expect(r!.acumuladoCop).toBeLessThan(278_000);
  });

  it('stops earning once the balance is withdrawn', () => {
    const r = rendimientoEstimado(
      [
        mov({ id: 'in', deltaCop: 1_000_000, occurredOn: '2026-01-01' }),
        mov({ id: 'out', kind: 'retiro', deltaCop: -1_000_000, occurredOn: '2026-01-31', createdAt: '2026-01-31T00:00:00.000Z' }),
      ],
      'c1',
      13,
      '2027-01-01',
    );

    // Only the 30 days it was actually held.
    expect(r!.acumuladoCop).toBeGreaterThan(0);
    expect(r!.acumuladoCop).toBeLessThan(12_000);
    expect(r!.diarioCop).toBe(0);
  });

  it('never reports negative interest for a future-dated movement', () => {
    const r = rendimientoEstimado(
      [mov({ deltaCop: 500_000, occurredOn: '2027-01-01' })],
      'c1',
      13,
      '2026-06-01',
    );

    expect(r!.acumuladoCop).toBeGreaterThanOrEqual(0);
    expect(r!.dias).toBeGreaterThanOrEqual(0);
  });

  it('ignores other pockets', () => {
    const r = rendimientoEstimado(
      [mov({ cajitaId: 'otra', deltaCop: 9_000_000 }), mov({ id: 'mio', deltaCop: 1_000_000 })],
      'c1',
      13,
      '2027-01-01',
    );

    expect(r!.acumuladoCop).toBe(130_000);
  });
});
