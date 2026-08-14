import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { analizarAnomalias, detectarRecurrencia } from './senalesAvanzadas';

const tx = (amount: number, cat: string = 'comida'): Transaction => ({
  id: Math.random().toString(),
  kind: 'gasto',
  amountCop: amount,
  category: cat,
  description: '',
  occurredOn: '2026-08-01',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-01T00:00:00.000Z',
});

describe('analizarAnomalias', () => {
  it('detecta montos normales', () => {
    const txs = [10000, 12000, 11000, 13000].map((a) => tx(a));
    const r = analizarAnomalias(txs, 'comida', 11500);
    expect(r.esAnomalía).toBe(false);
    expect(r.percentil).toBeGreaterThan(40);
  });

  it('detecta anomalías (>2σ)', () => {
    const txs = [10000, 12000, 11000, 13000].map((a) => tx(a));
    const r = analizarAnomalias(txs, 'comida', 500000);
    expect(r.esAnomalía).toBe(true);
  });

  it('categoría sin historial no es anomalía', () => {
    const r = analizarAnomalias([], 'comida', 50000);
    expect(r.esAnomalía).toBe(false);
    expect(r.promedio).toBe(0);
  });
});

describe('detectarRecurrencia', () => {
  it('reconoce patrones diarios', () => {
    const r = detectarRecurrencia('café todos los días 5 mil');
    expect(r.patrón).toBe('diario');
    expect(r.confianza).toBeGreaterThan(0.7);
  });

  it('reconoce patrones mensuales', () => {
    const r = detectarRecurrencia('membresía mensual 50 mil');
    expect(r.patrón).toBe('mensual');
  });

  it('devuelve ninguno si no detecta nada', () => {
    const r = detectarRecurrencia('gasté 20 mil');
    expect(r.patrón).toBe('ninguno');
    expect(r.confianza).toBe(0);
  });
});
