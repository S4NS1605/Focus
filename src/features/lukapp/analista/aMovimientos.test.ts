import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import type { MovimientoExtraido } from './tipos';
import { claveDeMovimiento, planearImportacion } from './aMovimientos';

let n = 0;
const idFijo = () => {
  n += 1;
  return `id-${n}`;
};
const ahoraFijo = () => '2026-07-30T12:00:00.000Z';

const mov = (overrides: Partial<MovimientoExtraido> = {}): MovimientoExtraido => ({
  fecha: '2026-07-15',
  descripcion: 'Mercado Éxito',
  montoCop: 180_000,
  tipo: 'gasto',
  categoria: 'mercado',
  confianza: 'alta',
  exclusion: null,
  ...overrides,
});

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'existente',
  kind: 'gasto',
  amountCop: 180_000,
  category: 'mercado',
  description: 'Mercado Éxito',
  occurredOn: '2026-07-15',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-07-15T10:00:00.000Z',
  ...overrides,
});

describe('claveDeMovimiento', () => {
  it('ignores case and accents in the description', () => {
    expect(claveDeMovimiento('2026-07-15', 'gasto', 1000, 'MERCADO EXITO')).toBe(
      claveDeMovimiento('2026-07-15', 'gasto', 1000, 'Mercado Éxito'),
    );
  });

  it('collapses runs of whitespace', () => {
    expect(claveDeMovimiento('2026-07-15', 'gasto', 1000, '  Mercado   Éxito ')).toBe(
      claveDeMovimiento('2026-07-15', 'gasto', 1000, 'Mercado Éxito'),
    );
  });

  it('separates on day, direction and amount', () => {
    const base = claveDeMovimiento('2026-07-15', 'gasto', 1000, 'x');
    expect(claveDeMovimiento('2026-07-16', 'gasto', 1000, 'x')).not.toBe(base);
    expect(claveDeMovimiento('2026-07-15', 'ingreso', 1000, 'x')).not.toBe(base);
    expect(claveDeMovimiento('2026-07-15', 'gasto', 1001, 'x')).not.toBe(base);
  });
});

describe('planearImportacion', () => {
  it('imports everything into an empty ledger', () => {
    const plan = planearImportacion([mov(), mov({ montoCop: 45_000 })], [], idFijo, ahoraFijo);
    expect(plan.nuevos).toHaveLength(2);
    expect(plan.duplicados).toHaveLength(0);
  });

  it('maps a movement onto a Transaction, marking its provenance', () => {
    const plan = planearImportacion([mov()], [], () => 'uuid-1', ahoraFijo);
    expect(plan.nuevos[0]).toEqual({
      id: 'uuid-1',
      kind: 'gasto',
      amountCop: 180_000,
      category: 'mercado',
      description: 'Mercado Éxito',
      occurredOn: '2026-07-15',
      cuentaId: null,
      rawTranscript: 'extracto: Mercado Éxito',
      createdAt: '2026-07-30T12:00:00.000Z',
    });
  });

  it('attributes imported rows to the account the statement belongs to', () => {
    const plan = planearImportacion([mov()], [], () => 'uuid-1', ahoraFijo, 'cuenta-nequi');

    // This is what makes an import move a balance instead of only filling a list.
    expect(plan.nuevos[0].cuentaId).toBe('cuenta-nequi');
  });

  it('never imports an excluded row', () => {
    const plan = planearImportacion(
      [mov({ exclusion: 'pago-tarjeta' }), mov({ exclusion: 'traslado-propio' })],
      [],
      idFijo,
      ahoraFijo,
    );
    expect(plan.nuevos).toHaveLength(0);
    expect(plan.excluidos).toHaveLength(2);
  });

  // Re-uploading the same statement must be a no-op.
  it('imports nothing the second time the same statement is uploaded', () => {
    const movimientos = [mov(), mov({ montoCop: 45_000, descripcion: 'TransMilenio' })];
    const primera = planearImportacion(movimientos, [], idFijo, ahoraFijo);
    const segunda = planearImportacion(movimientos, primera.nuevos, idFijo, ahoraFijo);

    expect(primera.nuevos).toHaveLength(2);
    expect(segunda.nuevos).toHaveLength(0);
    expect(segunda.duplicados).toHaveLength(2);
  });

  it('imports only the new lines from an overlapping statement', () => {
    const junio = [mov({ fecha: '2026-06-20' })];
    const ledger = planearImportacion(junio, [], idFijo, ahoraFijo).nuevos;

    const junioYJulio = [mov({ fecha: '2026-06-20' }), mov({ fecha: '2026-07-15' })];
    const plan = planearImportacion(junioYJulio, ledger, idFijo, ahoraFijo);

    expect(plan.nuevos).toHaveLength(1);
    expect(plan.nuevos[0].occurredOn).toBe('2026-07-15');
    expect(plan.duplicados).toHaveLength(1);
  });

  // The case a naive "key must be absent" check gets wrong.
  it('keeps two genuinely identical purchases on the same day as two', () => {
    const dosCafes = [
      mov({ montoCop: 5_000, descripcion: 'Café', categoria: 'comida' }),
      mov({ montoCop: 5_000, descripcion: 'Café', categoria: 'comida' }),
    ];
    const plan = planearImportacion(dosCafes, [], idFijo, ahoraFijo);
    expect(plan.nuevos).toHaveLength(2);
  });

  it('imports only the surplus when the ledger already has one of a repeated pair', () => {
    const yaTengoUno = [tx({ amountCop: 5_000, description: 'Café', category: 'comida' })];
    const dosCafes = [
      mov({ montoCop: 5_000, descripcion: 'Café', categoria: 'comida' }),
      mov({ montoCop: 5_000, descripcion: 'Café', categoria: 'comida' }),
    ];
    const plan = planearImportacion(dosCafes, yaTengoUno, idFijo, ahoraFijo);
    expect(plan.nuevos).toHaveLength(1);
    expect(plan.duplicados).toHaveLength(1);
  });

  it('treats a differently-cased description in the ledger as the same row', () => {
    const plan = planearImportacion(
      [mov({ descripcion: 'MERCADO EXITO' })],
      [tx({ description: 'Mercado Éxito' })],
      idFijo,
      ahoraFijo,
    );
    expect(plan.nuevos).toHaveLength(0);
    expect(plan.duplicados).toHaveLength(1);
  });

  it('does not mutate its inputs', () => {
    const movimientos = [mov()];
    const existentes = [tx({ occurredOn: '2026-01-01' })];
    const copiaMov = JSON.stringify(movimientos);
    const copiaEx = JSON.stringify(existentes);
    planearImportacion(movimientos, existentes, idFijo, ahoraFijo);
    expect(JSON.stringify(movimientos)).toBe(copiaMov);
    expect(JSON.stringify(existentes)).toBe(copiaEx);
  });

  it('handles an empty statement', () => {
    const plan = planearImportacion([], [tx()], idFijo, ahoraFijo);
    expect(plan).toEqual({ nuevos: [], duplicados: [], posibles: [], excluidos: [] });
  });
});

/**
 * The case that matters when someone actually uses the app: you dictate a
 * movement, then upload the statement that contains it. The wording never
 * matches — you type "Mercado Éxito", the bank prints "COMPRA EN EXITO IBAGUE" —
 * so an exact-key match cannot see they are the same.
 */
describe('lo que ya anotaste a mano', () => {
  const manual = (over: Partial<Transaction> = {}): Transaction => ({
    id: 'mio',
    kind: 'gasto',
    amountCop: 45_000,
    category: 'mercado',
    description: 'Mercado Éxito',
    occurredOn: '2026-07-15',
    cuentaId: null,
    rawTranscript: 'gasté 45 mil en el éxito',
    createdAt: '2026-07-15T00:00:00.000Z',
    ...over,
  });

  const delBanco = (over: Partial<MovimientoExtraido> = {}): MovimientoExtraido =>
    mov({ descripcion: 'COMPRA EN EXITO IBAGUE', montoCop: 45_000, fecha: '2026-07-15', ...over });

  it('no lo importa a ciegas: lo marca como posible repetido', () => {
    const plan = planearImportacion([delBanco()], [manual()], () => 'x');

    expect(plan.nuevos).toHaveLength(0);
    expect(plan.posibles).toHaveLength(1);
    expect(plan.posibles[0].yaTengo.id).toBe('mio');
  });

  it('deja listo el movimiento por si de verdad eran distintos', () => {
    const plan = planearImportacion([delBanco()], [manual()], () => 'x');

    // Dos gastos de $45.000 el mismo día también existen. La app no decide por
    // el usuario: prepara la fila y deja que él elija.
    expect(plan.posibles[0].transaccion).toMatchObject({
      amountCop: 45_000,
      description: 'COMPRA EN EXITO IBAGUE',
    });
  });

  it('un solo apunte a mano no absorbe tres líneas del extracto', () => {
    const plan = planearImportacion(
      [
        delBanco({ descripcion: 'A' }),
        delBanco({ descripcion: 'B' }),
        delBanco({ descripcion: 'C' }),
      ],
      [manual()],
      () => 'x',
    );

    expect(plan.posibles).toHaveLength(1);
    expect(plan.nuevos).toHaveLength(2);
  });

  it('un monto distinto el mismo día no se confunde', () => {
    const plan = planearImportacion([delBanco({ montoCop: 60_000 })], [manual()], () => 'x');

    expect(plan.posibles).toHaveLength(0);
    expect(plan.nuevos).toHaveLength(1);
  });

  it('un texto idéntico sigue siendo duplicado exacto, no un posible', () => {
    const plan = planearImportacion(
      [delBanco({ descripcion: 'Mercado Éxito' })],
      [manual()],
      () => 'x',
    );

    expect(plan.duplicados).toHaveLength(1);
    expect(plan.posibles).toHaveLength(0);
  });
});

describe('estabilidad entre renders', () => {
  it('la clave de un posible repetido no cambia al recalcular el plan', () => {
    const manual: Transaction = {
      id: 'mio',
      kind: 'gasto',
      amountCop: 45_000,
      category: 'mercado',
      description: 'Mercado Éxito',
      occurredOn: '2026-07-15',
      cuentaId: null,
      rawTranscript: '',
      createdAt: '2026-07-15T00:00:00.000Z',
    };
    const delBanco = mov({ descripcion: 'COMPRA EN EXITO', montoCop: 45_000, fecha: '2026-07-15' });

    // El plan se reconstruye en cada render y acuña ids nuevos cada vez. Si la
    // interfaz recordara una casilla marcada por ese id, se desmarcaría sola.
    const a = planearImportacion([delBanco], [manual], () => crypto.randomUUID());
    const b = planearImportacion([delBanco], [manual], () => crypto.randomUUID());

    expect(a.posibles[0].transaccion.id).not.toBe(b.posibles[0].transaccion.id);
    expect(a.posibles[0].clave).toBe(b.posibles[0].clave);
  });
});
