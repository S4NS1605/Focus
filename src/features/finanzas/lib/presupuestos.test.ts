import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  estadoDePresupuesto,
  estadoDeTodos,
  gastadoEnCategoria,
  promedioMensualCategoria,
  tonoDe,
} from './presupuestos';
import type { Presupuesto } from './presupuestos';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 100_000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-08-05',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-05T00:00:00.000Z',
  ...over,
});

const pre = (over: Partial<Presupuesto> = {}): Presupuesto => ({
  categoria: 'comida',
  montoCop: 400_000,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

describe('gastadoEnCategoria', () => {
  it('suma solo los gastos de esa categoría y ese mes', () => {
    const total = gastadoEnCategoria(
      [
        tx({ id: 'a', amountCop: 50_000 }),
        tx({ id: 'b', amountCop: 30_000, category: 'transporte' }),
        tx({ id: 'c', amountCop: 90_000, occurredOn: '2026-07-20' }),
      ],
      '2026-08',
      'comida',
    );

    expect(total).toBe(50_000);
  });

  it('un ingreso de esa categoría no descuenta del presupuesto', () => {
    // Un reembolso entra por su lado; el presupuesto mide lo que sale.
    const total = gastadoEnCategoria(
      [tx({ amountCop: 50_000 }), tx({ id: 'b', kind: 'ingreso', amountCop: 200_000 })],
      '2026-08',
      'comida',
    );

    expect(total).toBe(50_000);
  });
});

describe('estadoDePresupuesto', () => {
  it('dice cuánto queda y qué porcentaje va', () => {
    const e = estadoDePresupuesto(pre(), [tx({ amountCop: 100_000 })], '2026-08', '2026-08-10');

    expect(e.gastadoCop).toBe(100_000);
    expect(e.disponibleCop).toBe(300_000);
    expect(e.pctUsado).toBe(25);
    expect(e.excedidoCop).toBe(0);
  });

  it('proyecta al ritmo del mes', () => {
    // $100.000 en 10 días de agosto (31) → ~$310.000 al cierre.
    const e = estadoDePresupuesto(pre(), [tx({ amountCop: 100_000 })], '2026-08', '2026-08-10');

    expect(e.proyectadoCop).toBe(310_000);
    expect(e.vaARebasar).toBe(false);
  });

  it('avisa cuando el ritmo va a rebasar aunque todavía no se haya pasado', () => {
    // Esto es lo único que distingue un presupuesto de un informe de fin de mes:
    // avisa mientras todavía se puede hacer algo.
    const e = estadoDePresupuesto(pre(), [tx({ amountCop: 200_000 })], '2026-08', '2026-08-10');

    expect(e.excedidoCop).toBe(0);
    expect(e.proyectadoCop).toBe(620_000);
    expect(e.vaARebasar).toBe(true);
  });

  it('no divide por cero el primer instante del mes', () => {
    // Infinity en pantalla se lee como una cifra, no como "no se sabe".
    const e = estadoDePresupuesto(pre(), [], '2026-09', '2026-08-10');

    expect(Number.isFinite(e.proyectadoCop)).toBe(true);
    expect(e.proyectadoCop).toBe(0);
  });

  it('un mes ya cerrado no se proyecta: lo gastado ya se gastó', () => {
    const e = estadoDePresupuesto(
      pre(),
      [tx({ occurredOn: '2026-07-05' })],
      '2026-07',
      '2026-08-10',
    );

    expect(e.proyectadoCop).toBe(e.gastadoCop);
  });

  it('reporta el exceso cuando ya se pasó', () => {
    const e = estadoDePresupuesto(pre(), [tx({ amountCop: 500_000 })], '2026-08', '2026-08-20');

    expect(e.excedidoCop).toBe(100_000);
    expect(e.disponibleCop).toBe(0);
  });

  it('un tope en cero no genera porcentajes absurdos', () => {
    const e = estadoDePresupuesto(pre({ montoCop: 0 }), [tx()], '2026-08', '2026-08-10');

    expect(Number.isFinite(e.pctUsado)).toBe(true);
    expect(e.pctUsado).toBe(0);
  });

  it('el porcentaje se topa, para que la barra no se salga de la pantalla', () => {
    const e = estadoDePresupuesto(
      pre({ montoCop: 1_000 }),
      [tx({ amountCop: 90_000_000 })],
      '2026-08',
      '2026-08-10',
    );

    expect(e.pctUsado).toBeLessThanOrEqual(999);
  });

  it('cuenta bien los días de febrero', () => {
    // 2026 no es bisiesto: 28 días.
    const e = estadoDePresupuesto(
      pre(),
      [tx({ amountCop: 100_000, occurredOn: '2026-02-14' })],
      '2026-02',
      '2026-02-14',
    );

    expect(e.proyectadoCop).toBe(200_000);
  });
});

describe('estadoDeTodos', () => {
  it('pone arriba lo que más urge mirar', () => {
    // Un presupuesto holgado no necesita que lo miren.
    const estados = estadoDeTodos(
      [pre({ categoria: 'comida' }), pre({ categoria: 'transporte', montoCop: 100_000 })],
      [
        tx({ id: 'a', category: 'comida', amountCop: 40_000 }),
        tx({ id: 'b', category: 'transporte', amountCop: 95_000 }),
      ],
      '2026-08',
      '2026-08-10',
    );

    expect(estados[0].categoria).toBe('transporte');
  });

  it('sin presupuestos devuelve vacío, no ceros inventados', () => {
    expect(estadoDeTodos([], [tx()], '2026-08', '2026-08-10')).toEqual([]);
  });
});

describe('tonoDe', () => {
  const estadoCon = (gastado: number, tope = 400_000, hoy = '2026-08-10') =>
    estadoDePresupuesto(pre({ montoCop: tope }), [tx({ amountCop: gastado })], '2026-08', hoy);

  it('excedido manda sobre todo lo demás', () => {
    expect(tonoDe(estadoCon(500_000))).toBe('excedido');
  });

  it('atento cuando el ritmo va a rebasar', () => {
    expect(tonoDe(estadoCon(200_000))).toBe('atento');
  });

  it('atento también al pasar del 80% aunque el mes esté por cerrar', () => {
    expect(tonoDe(estadoCon(340_000, 400_000, '2026-08-30'))).toBe('atento');
  });

  it('bien cuando de verdad va bien', () => {
    expect(tonoDe(estadoCon(50_000, 400_000, '2026-08-25'))).toBe('bien');
  });
});

describe('promedioMensualCategoria', () => {
  it('promedia los meses anteriores, sin contar el mes actual', () => {
    const promedio = promedioMensualCategoria(
      [
        tx({ id: 'a', amountCop: 100_000, occurredOn: '2026-07-05' }),
        tx({ id: 'b', amountCop: 60_000, occurredOn: '2026-06-10' }),
        tx({ id: 'c', amountCop: 900_000, occurredOn: '2026-08-15' }),
      ],
      'comida',
      '2026-08',
    );

    expect(promedio).toBe(80_000);
  });

  it('sin historial devuelve null, no cero', () => {
    expect(promedioMensualCategoria([], 'comida', '2026-08')).toBeNull();
  });

  it('ignora otras categorías', () => {
    const promedio = promedioMensualCategoria(
      [tx({ category: 'transporte', occurredOn: '2026-07-05' })],
      'comida',
      '2026-08',
    );

    expect(promedio).toBeNull();
  });
});
