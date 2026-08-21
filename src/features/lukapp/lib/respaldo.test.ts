import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { instantaneaVacia } from '../data/repositorio';
import type { Instantanea } from '../data/repositorio';
import {
  VERSION_RESPALDO,
  aCsv,
  armarRespaldo,
  leerRespaldo,
  nombreDeArchivo,
  resumirRespaldo,
} from './respaldo';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 45_000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-08-10',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

const conDatos = (over: Partial<Instantanea> = {}): Instantanea => ({
  ...instantaneaVacia(),
  transacciones: [tx()],
  ...over,
});

const nombreDeCuenta = (id: string | null) => (id === null ? '' : `Cuenta ${id}`);

describe('ida y vuelta', () => {
  it('lo que sale es exactamente lo que entra', () => {
    // Si esto falla, restaurar un respaldo no devuelve la contabilidad: la
    // cambia.
    const datos = conDatos();
    const json = JSON.stringify(armarRespaldo(datos, '2026-08-13T00:00:00.000Z'));

    const leido = leerRespaldo(json);

    expect(leido.ok).toBe(true);
    expect(leido.respaldo!.datos).toEqual(datos);
  });

  it('lleva versión y fecha', () => {
    const r = armarRespaldo(conDatos(), '2026-08-13T00:00:00.000Z');

    expect(r.version).toBe(VERSION_RESPALDO);
    expect(r.generado).toBe('2026-08-13T00:00:00.000Z');
  });
});

describe('leerRespaldo — no confía en nada', () => {
  it('rechaza algo que no es JSON', () => {
    const r = leerRespaldo('esto no es json {{{');

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/JSON/i);
    expect(r.respaldo).toBeNull();
  });

  it('rechaza un JSON que no es un respaldo', () => {
    const r = leerRespaldo('{"cualquier":"cosa"}');

    expect(r.ok).toBe(false);
    expect(r.respaldo).toBeNull();
  });

  it('rechaza null y listas', () => {
    expect(leerRespaldo('null').ok).toBe(false);
    expect(leerRespaldo('[1,2,3]').ok).toBe(false);
  });

  it('rechaza un respaldo de una versión más nueva', () => {
    // Restaurarlo a medias sería peor que rechazarlo: traería campos que esta
    // versión no sabe leer.
    const r = leerRespaldo(JSON.stringify({ version: 99, datos: instantaneaVacia() }));

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/más nueva/i);
  });

  it('un respaldo viejo sin listas nuevas se restaura igual', () => {
    // Uno hecho antes de que existieran los presupuestos sigue sirviendo.
    const r = leerRespaldo(
      JSON.stringify({ version: 1, generado: 'x', datos: { transacciones: [tx()] } }),
    );

    expect(r.ok).toBe(true);
    expect(r.respaldo!.datos.presupuestos).toEqual([]);
    expect(r.respaldo!.datos.transacciones).toHaveLength(1);
  });

  it('ignora una lista que llegó con basura en vez de arreglo', () => {
    const r = leerRespaldo(
      JSON.stringify({ version: 1, datos: { transacciones: 'no soy una lista' } }),
    );

    expect(r.ok).toBe(true);
    expect(r.respaldo!.datos.transacciones).toEqual([]);
  });

  it('dice qué trae ANTES de que alguien reemplace nada', () => {
    const r = leerRespaldo(JSON.stringify(armarRespaldo(conDatos(), 'x')));

    expect(r.resumen).toMatch(/1 movimiento/);
  });
});

describe('resumirRespaldo', () => {
  it('cuenta en singular y en plural', () => {
    expect(resumirRespaldo(conDatos())).toBe('1 movimiento');
    expect(resumirRespaldo(conDatos({ transacciones: [tx(), tx({ id: 't2' })] }))).toBe(
      '2 movimientos',
    );
  });

  it('omite lo que está en cero en vez de decir "0 metas"', () => {
    expect(resumirRespaldo(conDatos())).not.toMatch(/0 /);
  });

  it('dice que está vacío cuando lo está', () => {
    expect(resumirRespaldo(instantaneaVacia())).toBe('Está vacío');
  });
});

describe('aCsv', () => {
  it('separa con punto y coma, no con coma', () => {
    // Excel en español lee la coma como separador decimal, y un CSV con comas
    // le queda todo apilado en una sola columna.
    const csv = aCsv(conDatos(), nombreDeCuenta);

    expect(csv.split('\n')[0]).toContain(';');
    expect(csv.split('\n')[0]).not.toMatch(/,/);
  });

  it('el monto sale como número, sin puntos ni símbolo', () => {
    // Una hoja de cálculo necesita un número, no un texto bonito.
    const csv = aCsv(conDatos(), nombreDeCuenta);

    expect(csv).toContain('45000');
    expect(csv).not.toContain('$45.000');
  });

  it('ordena del más viejo al más nuevo', () => {
    const csv = aCsv(
      conDatos({
        transacciones: [
          tx({ id: 'b', occurredOn: '2026-08-20', description: 'Nuevo' }),
          tx({ id: 'a', occurredOn: '2026-07-01', description: 'Viejo' }),
        ],
      }),
      nombreDeCuenta,
    );

    expect(csv.indexOf('Viejo')).toBeLessThan(csv.indexOf('Nuevo'));
  });

  it('escapa una descripción con punto y coma dentro', () => {
    // Sin esto, una descripción parte la fila y corre todas las columnas.
    const csv = aCsv(
      conDatos({ transacciones: [tx({ description: 'Pago; con nota' })] }),
      nombreDeCuenta,
    );

    expect(csv).toContain('"Pago; con nota"');
    expect(csv.split('\n')).toHaveLength(2);
  });

  it('escapa comillas duplicándolas', () => {
    const csv = aCsv(
      conDatos({ transacciones: [tx({ description: 'El "bueno"' })] }),
      nombreDeCuenta,
    );

    expect(csv).toContain('"El ""bueno"""');
  });

  it('una descripción con salto de línea no parte la fila', () => {
    const csv = aCsv(
      conDatos({ transacciones: [tx({ description: 'linea1\nlinea2' })] }),
      nombreDeCuenta,
    );

    expect(csv).toContain('"linea1\nlinea2"');
  });

  it('trae encabezados legibles', () => {
    expect(aCsv(conDatos(), nombreDeCuenta).split('\n')[0]).toBe(
      'Fecha;Tipo;Monto;Categoría;Descripción;Cuenta',
    );
  });

  it('sin movimientos deja solo el encabezado', () => {
    expect(aCsv(instantaneaVacia(), nombreDeCuenta).split('\n')).toHaveLength(1);
  });
});

describe('nombreDeArchivo', () => {
  it('lleva la fecha, para que dos respaldos no se pisen', () => {
    expect(nombreDeArchivo('2026-08-13')).toBe('finanzas-2026-08-13.json');
  });
});
