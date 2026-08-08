import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import {
  ajusteHacia,
  patrimonio,
  historialDeCajita,
  resumenDeCajitas,
  saldoDeCajita,
  saldosPorCajita,
  totalEnCajitas,
} from './cajitas';

const mov = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'm1',
  cajitaId: 'c1',
  kind: 'deposito',
  deltaCop: 100000,
  categoria: null,
  occurredOn: '2026-08-01',
  nota: '',
  createdAt: '2026-08-01T10:00:00.000Z',
  ...over,
});

const caj = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'c1',
  nombre: 'Vacaciones',
  icon: '🏖️',
  tipo: 'cajita',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

describe('saldosPorCajita', () => {
  it('sums deltas per pocket', () => {
    const saldos = saldosPorCajita([
      mov({ id: 'a', cajitaId: 'c1', deltaCop: 100000 }),
      mov({ id: 'b', cajitaId: 'c1', deltaCop: 50000 }),
      mov({ id: 'c', cajitaId: 'c2', deltaCop: 30000 }),
    ]);

    expect(saldos.get('c1')).toBe(150000);
    expect(saldos.get('c2')).toBe(30000);
  });

  it('nets withdrawals against deposits', () => {
    const saldos = saldosPorCajita([
      mov({ id: 'a', deltaCop: 200000 }),
      mov({ id: 'b', kind: 'retiro', deltaCop: -80000 }),
    ]);

    expect(saldos.get('c1')).toBe(120000);
  });

  it('is empty for a pocket with no movements', () => {
    expect(saldoDeCajita([], 'c1')).toBe(0);
  });
});

describe('ajusteHacia', () => {
  it('produces the delta that reaches the stated balance', () => {
    expect(ajusteHacia(150000, 200000)).toBe(50000);
  });

  it('goes negative when the real balance is lower than recorded', () => {
    expect(ajusteHacia(200000, 150000)).toBe(-50000);
  });

  it('is zero when nothing changed', () => {
    expect(ajusteHacia(150000, 150000)).toBe(0);
  });

  it('round-trips: applying the adjustment lands exactly on the target', () => {
    const movimientos = [mov({ deltaCop: 137_500 })];
    const actual = saldoDeCajita(movimientos, 'c1');

    const delta = ajusteHacia(actual, 300_000);
    const despues = saldoDeCajita([...movimientos, mov({ id: 'x', deltaCop: delta })], 'c1');

    expect(despues).toBe(300_000);
  });
});

describe('historialDeCajita', () => {
  it('returns newest first with the balance after each movement', () => {
    const filas = historialDeCajita(
      [
        mov({ id: 'a', occurredOn: '2026-08-01', deltaCop: 100000 }),
        mov({ id: 'b', occurredOn: '2026-08-05', deltaCop: 50000 }),
        mov({ id: 'c', occurredOn: '2026-08-10', kind: 'retiro', deltaCop: -20000 }),
      ],
      'c1',
    );

    expect(filas.map((f) => f.movimiento.id)).toEqual(['c', 'b', 'a']);
    // Each row shows the balance AFTER itself, not before.
    expect(filas.map((f) => f.saldoDespues)).toEqual([130000, 150000, 100000]);
  });

  it('breaks same-day ties by entry order', () => {
    const filas = historialDeCajita(
      [
        mov({ id: 'segundo', occurredOn: '2026-08-01', deltaCop: 10000, createdAt: '2026-08-01T12:00:00.000Z' }),
        mov({ id: 'primero', occurredOn: '2026-08-01', deltaCop: 90000, createdAt: '2026-08-01T09:00:00.000Z' }),
      ],
      'c1',
    );

    expect(filas.map((f) => f.movimiento.id)).toEqual(['segundo', 'primero']);
    expect(filas.map((f) => f.saldoDespues)).toEqual([100000, 90000]);
  });

  it('ignores movements from other pockets', () => {
    const filas = historialDeCajita(
      [mov({ id: 'mio', cajitaId: 'c1' }), mov({ id: 'ajeno', cajitaId: 'c2' })],
      'c1',
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].movimiento.id).toBe('mio');
  });
});

describe('totalEnCajitas', () => {
  it('adds up live pockets', () => {
    const total = totalEnCajitas(
      [caj({ id: 'c1' }), caj({ id: 'c2' })],
      [mov({ id: 'a', cajitaId: 'c1', deltaCop: 100000 }), mov({ id: 'b', cajitaId: 'c2', deltaCop: 250000 })],
    );

    expect(total).toBe(350000);
  });

  it('leaves archived pockets out of the total', () => {
    const total = totalEnCajitas(
      [caj({ id: 'c1' }), caj({ id: 'c2', archivedAt: '2026-08-01T00:00:00.000Z' })],
      [mov({ id: 'a', cajitaId: 'c1', deltaCop: 100000 }), mov({ id: 'b', cajitaId: 'c2', deltaCop: 250000 })],
    );

    expect(total).toBe(100000);
  });
});

describe('resumenDeCajitas', () => {
  it('sorts by balance, largest first', () => {
    const resumen = resumenDeCajitas(
      [caj({ id: 'c1', nombre: 'Chica' }), caj({ id: 'c2', nombre: 'Grande' })],
      [mov({ id: 'a', cajitaId: 'c1', deltaCop: 10000 }), mov({ id: 'b', cajitaId: 'c2', deltaCop: 500000 })],
    );

    expect(resumen.map((r) => r.cajita.nombre)).toEqual(['Grande', 'Chica']);
  });

  it('reports progress against the pocket target', () => {
    const [resumen] = resumenDeCajitas([caj({ metaCop: 400000 })], [mov({ deltaCop: 100000 })]);

    expect(resumen.pct).toBe(25);
  });

  it('caps progress at 100 when the target is overshot', () => {
    const [resumen] = resumenDeCajitas([caj({ metaCop: 100000 })], [mov({ deltaCop: 250000 })]);

    expect(resumen.pct).toBe(100);
    // The real balance is still reported in full — only the bar is capped.
    expect(resumen.saldoCop).toBe(250000);
  });

  it('has no percentage without a target', () => {
    const [resumen] = resumenDeCajitas([caj({ metaCop: null })], [mov({ deltaCop: 100000 })]);

    expect(resumen.pct).toBeNull();
  });
});

describe('patrimonio', () => {
  it('separates accounts from pockets and totals both', () => {
    const r = patrimonio(
      [
        caj({ id: 'c1', tipo: 'cuenta' }),
        caj({ id: 'c2', tipo: 'cajita' }),
        caj({ id: 'c3', tipo: 'cajita' }),
      ],
      [
        mov({ id: 'a', cajitaId: 'c1', deltaCop: 600_000 }),
        mov({ id: 'b', cajitaId: 'c2', deltaCop: 300_000 }),
        mov({ id: 'c', cajitaId: 'c3', deltaCop: 100_000 }),
      ],
    );

    expect(r).toMatchObject({ cuentasCop: 600_000, cajitasCop: 400_000, totalCop: 1_000_000 });
  });

  it('leaves archived balances out of the total', () => {
    const r = patrimonio(
      [caj({ id: 'c1', tipo: 'cuenta' }), caj({ id: 'c2', tipo: 'cuenta', archivedAt: '2026-01-01T00:00:00.000Z' })],
      [mov({ id: 'a', cajitaId: 'c1', deltaCop: 500_000 }), mov({ id: 'b', cajitaId: 'c2', deltaCop: 900_000 })],
    );

    expect(r.cuentasCop).toBe(500_000);
  });

  it('is all zeroes with nothing registered', () => {
    expect(patrimonio([], [])).toMatchObject({ cuentasCop: 0, cajitasCop: 0, totalCop: 0 });
  });

  it('subtracts debts and cards from the net, without hiding the gross', () => {
    const r = patrimonio(
      [
        caj({ id: 'c1', tipo: 'cuenta' }),
        caj({ id: 'd1', tipo: 'deuda' }),
        caj({ id: 't1', tipo: 'tarjeta' }),
      ],
      [
        mov({ id: 'a', cajitaId: 'c1', deltaCop: 1_000_000 }),
        mov({ id: 'b', cajitaId: 'd1', deltaCop: 300_000 }),
        mov({ id: 'c', cajitaId: 't1', deltaCop: 200_000 }),
      ],
    );

    // Debts are reported positive: "you owe 500.000", not "-500.000".
    expect(r.deudasCop).toBe(500_000);
    // The gross stays visible — what you have and what you owe are different
    // facts and merging them into one number hides both.
    expect(r.totalCop).toBe(1_000_000);
    expect(r.netoCop).toBe(500_000);
  });

  it('lets the net go negative when debts exceed what is held', () => {
    const r = patrimonio(
      [caj({ id: 'c1', tipo: 'cuenta' }), caj({ id: 'd1', tipo: 'deuda' })],
      [
        mov({ id: 'a', cajitaId: 'c1', deltaCop: 100_000 }),
        mov({ id: 'b', cajitaId: 'd1', deltaCop: 900_000 }),
      ],
    );

    expect(r.netoCop).toBe(-800_000);
  });
});

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 45_000,
  category: 'mercado',
  description: 'Mercado',
  occurredOn: '2026-08-10',
  cuentaId: 'c1',
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

/**
 * The point of attribution: a balance that maintains itself. Before this, an
 * account went stale the moment anything was recorded, and had to be corrected
 * by hand every time.
 */
describe('saldos con movimientos atribuidos', () => {
  it('un gasto atribuido baja el saldo de esa cuenta', () => {
    const saldo = saldoDeCajita([mov({ deltaCop: 500_000 })], 'c1', [tx({ amountCop: 45_000 })]);

    expect(saldo).toBe(455_000);
  });

  it('un ingreso atribuido lo sube', () => {
    const saldo = saldoDeCajita([mov({ deltaCop: 500_000 })], 'c1', [
      tx({ kind: 'ingreso', amountCop: 900_000 }),
    ]);

    expect(saldo).toBe(1_400_000);
  });

  it('un movimiento sin cuenta no toca ningún saldo', () => {
    // Dictar "gasté 20 mil" sin decir de dónde sigue contando en el mes, pero
    // no puede mover un saldo que nadie indicó.
    const saldo = saldoDeCajita([mov({ deltaCop: 500_000 })], 'c1', [tx({ cuentaId: null })]);

    expect(saldo).toBe(500_000);
  });

  it('un movimiento de OTRA cuenta no toca esta', () => {
    const saldo = saldoDeCajita([mov({ deltaCop: 500_000 })], 'c1', [tx({ cuentaId: 'c2' })]);

    expect(saldo).toBe(500_000);
  });

  it('el ajuste se mide contra el saldo ya afectado, sin doble conteo', () => {
    // 500.000 iniciales, 45.000 gastados => la app cree 455.000.
    // El banco dice 450.000: el ajuste debe ser -5.000, no -50.000.
    const movimientos = [mov({ deltaCop: 500_000 })];
    const transacciones = [tx({ amountCop: 45_000 })];
    const actual = saldoDeCajita(movimientos, 'c1', transacciones);

    const delta = ajusteHacia(actual, 450_000);
    expect(delta).toBe(-5_000);

    const despues = saldoDeCajita(
      [...movimientos, mov({ id: 'ajuste', deltaCop: delta })],
      'c1',
      transacciones,
    );
    expect(despues).toBe(450_000);
  });

  it('el patrimonio refleja lo atribuido', () => {
    const r = patrimonio(
      [caj({ id: 'c1', tipo: 'cuenta' })],
      [mov({ cajitaId: 'c1', deltaCop: 1_000_000 })],
      [tx({ cuentaId: 'c1', amountCop: 200_000 })],
    );

    expect(r.cuentasCop).toBe(800_000);
  });

  it('sin transacciones se comporta igual que antes', () => {
    // Compatibilidad: todo llamador que no sepa de atribución sigue igual.
    expect(saldoDeCajita([mov({ deltaCop: 500_000 })], 'c1')).toBe(500_000);
  });
});
