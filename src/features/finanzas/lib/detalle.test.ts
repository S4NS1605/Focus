import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { extraerContraparte } from './contraparte';
import { mayoresMovimientos, porDiaDelMes, resumenDelMes, topContrapartes } from './detalle';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 10000,
  category: 'transferencia',
  description: '',
  occurredOn: '2026-07-10',
  rawTranscript: '',
  createdAt: '2026-07-10T00:00:00.000Z',
  ...over,
});

describe('extraerContraparte', () => {
  it('reads the wallet shapes', () => {
    expect(extraerContraparte('Para SOLMAR BRILLYD LEON')).toBe('Solmar Brillyd Leon');
    expect(extraerContraparte('De MARIA KAMILA ESPEJO')).toBe('Maria Kamila Espejo');
    expect(extraerContraparte('ENVIO CON BRE-B A: LEIDYS')).toBe('Leidys');
    expect(extraerContraparte('PAGO EN QR BRE-B: ASADOS')).toBe('Asados');
  });

  it('strips the trailing codes banks append', () => {
    expect(extraerContraparte('Transferencia a JUAN PEREZ 8907001484')).toBe('Juan Perez');
    expect(extraerContraparte('Pago recibido de WOMPI S.A.S.')).toBe('Wompi');
  });

  it('returns null when no counterparty is named', () => {
    // These are not transfers with an anonymous party — pooling them would
    // recreate the same meaningless lump one level down.
    expect(extraerContraparte('Rendimientos Financieros')).toBeNull();
    expect(extraerContraparte('COMPRA PAQUETE PTM')).toBeNull();
    expect(extraerContraparte('')).toBeNull();
  });
});

describe('topContrapartes', () => {
  it('adds up by person and sorts by amount', () => {
    const filas = topContrapartes(
      [
        tx({ id: 'a', description: 'Para ANA MARIA GOMEZ', amountCop: 50000 }),
        tx({ id: 'b', description: 'Para ANA MARIA GOMEZ', amountCop: 30000 }),
        tx({ id: 'c', description: 'Para LUIS PEREZ', amountCop: 60000 }),
      ],
      'gasto',
    );

    expect(filas[0]).toEqual({ nombre: 'Ana Maria Gomez', totalCop: 80000, veces: 2 });
    expect(filas[1]).toEqual({ nombre: 'Luis Perez', totalCop: 60000, veces: 1 });
  });

  it('keeps the two directions apart', () => {
    const movimientos = [
      tx({ id: 'a', kind: 'gasto', description: 'Para ANA MARIA GOMEZ' }),
      tx({ id: 'b', kind: 'ingreso', description: 'De LUIS PEREZ' }),
    ];

    expect(topContrapartes(movimientos, 'gasto').map((f) => f.nombre)).toEqual(['Ana Maria Gomez']);
    expect(topContrapartes(movimientos, 'ingreso').map((f) => f.nombre)).toEqual(['Luis Perez']);
  });

  it('leaves out movements with no counterparty', () => {
    const filas = topContrapartes(
      [tx({ description: 'COMPRA PAQUETE PTM' }), tx({ id: 'b', description: 'Para ANA GOMEZ' })],
      'gasto',
    );

    expect(filas).toHaveLength(1);
  });

  it('honours the limit', () => {
    const muchos = Array.from({ length: 12 }, (_, i) =>
      tx({ id: `t${i}`, description: `Para PERSONA NUMERO${i}`, amountCop: (i + 1) * 1000 }),
    );

    expect(topContrapartes(muchos, 'gasto', 3)).toHaveLength(3);
  });
});

describe('mayoresMovimientos', () => {
  it('returns the biggest of the requested direction', () => {
    const mayores = mayoresMovimientos(
      [
        tx({ id: 'chico', amountCop: 5000 }),
        tx({ id: 'grande', amountCop: 900000 }),
        tx({ id: 'ingreso', kind: 'ingreso', amountCop: 5000000 }),
      ],
      'gasto',
      2,
    );

    expect(mayores.map((m) => m.id)).toEqual(['grande', 'chico']);
  });
});

describe('porDiaDelMes', () => {
  it('returns every day, including untouched ones', () => {
    const dias = porDiaDelMes([tx({ occurredOn: '2026-07-10', amountCop: 25000 })], '2026-07');

    expect(dias).toHaveLength(31);
    expect(dias[9]).toMatchObject({ dia: 10, gastoCop: 25000 });
    // The empty days are the point: without them a chart hides that spending
    // was a few big days rather than a steady drip.
    expect(dias[0].gastoCop).toBe(0);
  });

  it('knows how long each month is', () => {
    expect(porDiaDelMes([], '2026-02')).toHaveLength(28);
    expect(porDiaDelMes([], '2024-02')).toHaveLength(29);
    expect(porDiaDelMes([], '2026-04')).toHaveLength(30);
  });

  it('separates the two directions', () => {
    const dias = porDiaDelMes(
      [
        tx({ id: 'g', kind: 'gasto', amountCop: 10000, occurredOn: '2026-07-05' }),
        tx({ id: 'i', kind: 'ingreso', amountCop: 90000, occurredOn: '2026-07-05' }),
      ],
      '2026-07',
    );

    expect(dias[4]).toMatchObject({ gastoCop: 10000, ingresoCop: 90000 });
  });

  it('ignores movements from other months', () => {
    const dias = porDiaDelMes([tx({ occurredOn: '2026-06-10', amountCop: 99999 })], '2026-07');

    expect(dias.every((d) => d.gastoCop === 0)).toBe(true);
  });
});

describe('resumenDelMes', () => {
  it('averages over the days with spending, not the whole month', () => {
    const r = resumenDelMes(
      [
        tx({ id: 'a', amountCop: 30000, occurredOn: '2026-07-01' }),
        tx({ id: 'b', amountCop: 60000, occurredOn: '2026-07-15' }),
      ],
      '2026-07',
    );

    expect(r.diasConGasto).toBe(2);
    // 90.000 over 2 active days, not over 31.
    expect(r.promedioPorDiaActivoCop).toBe(45000);
    expect(r.diaMasCaro?.dia).toBe(15);
  });

  it('is empty and safe with no movements', () => {
    const r = resumenDelMes([], '2026-07');

    expect(r).toMatchObject({ diasConGasto: 0, promedioPorDiaActivoCop: 0, diaMasCaro: null });
  });
});
