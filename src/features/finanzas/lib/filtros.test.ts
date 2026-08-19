import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { hacerCatalogo } from '../categorias';
import { FILTRO_VACIO, filtrarMovimientos, filtroActivo, resumirFiltrado } from './filtros';
import type { Filtro } from './filtros';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 45_000,
  category: 'comida',
  description: 'Almuerzo en el trabajo',
  occurredOn: '2026-08-10',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

const LIBRO: Transaction[] = [
  tx({ id: 'a', description: 'Almuerzo en el trabajo', category: 'comida', amountCop: 45_000 }),
  tx({
    id: 'b',
    description: 'Envio con BRE-B a: JUAN PEREZ',
    category: 'transferencia',
    amountCop: 120_000,
    occurredOn: '2026-03-04',
    cuentaId: 'nequi',
  }),
  tx({
    id: 'c',
    kind: 'ingreso',
    description: 'Salario',
    category: 'ingreso',
    amountCop: 2_500_000,
    occurredOn: '2026-07-30',
  }),
  tx({
    id: 'd',
    description: 'Mercado del mes',
    category: 'mercado',
    amountCop: 300_000,
    occurredOn: '2026-06-15',
    cuentaId: 'banco',
  }),
];

const con = (over: Partial<Filtro>): Filtro => ({ ...FILTRO_VACIO, ...over });
const ids = (filtro: Filtro) =>
  filtrarMovimientos(LIBRO, filtro)
    .map((t) => t.id)
    .sort();

describe('filtroActivo', () => {
  it('un filtro sin tocar no filtra nada', () => {
    // De esto depende que el mes siga mandando mientras nadie busque.
    expect(filtroActivo(FILTRO_VACIO)).toBe(false);
  });

  it('espacios en blanco no cuentan como búsqueda', () => {
    expect(filtroActivo(con({ texto: '   ' }))).toBe(false);
  });

  it('cualquier campo puesto lo activa', () => {
    expect(filtroActivo(con({ texto: 'juan' }))).toBe(true);
    expect(filtroActivo(con({ categoria: 'comida' }))).toBe(true);
    expect(filtroActivo(con({ cuentaId: 'nequi' }))).toBe(true);
    expect(filtroActivo(con({ kind: 'ingreso' }))).toBe(true);
    expect(filtroActivo(con({ desde: '2026-01-01' }))).toBe(true);
  });
});

describe('filtrarMovimientos', () => {
  it('sin filtro devuelve todo', () => {
    expect(filtrarMovimientos(LIBRO, FILTRO_VACIO)).toHaveLength(LIBRO.length);
  });

  it('busca en la descripción', () => {
    expect(ids(con({ texto: 'almuerzo' }))).toEqual(['a']);
  });

  it('encuentra a la contraparte aunque el banco le ponga prefijo', () => {
    // El banco escribe "Envio con BRE-B a: JUAN PEREZ"; buscar "juan perez"
    // tiene que encontrarlo sin que el usuario sepa cómo se llama el riel.
    expect(ids(con({ texto: 'juan perez' }))).toEqual(['b']);
  });

  it('ignora tildes y mayúsculas', () => {
    expect(ids(con({ texto: 'JUÁN PÉREZ' }))).toEqual(['b']);
  });

  it('busca por monto sin importar cómo se escriban los miles', () => {
    // Nadie teclea "45.000" igual dos veces.
    expect(ids(con({ texto: '45000' }))).toEqual(['a']);
    expect(ids(con({ texto: '45.000' }))).toEqual(['a']);
    expect(ids(con({ texto: '$120,000' }))).toEqual(['b']);
  });

  it('busca por el nombre de la categoría, no solo por su clave', () => {
    const catalogo = hacerCatalogo([]);
    const encontrados = filtrarMovimientos(LIBRO, con({ texto: 'mercado' }), catalogo);

    expect(encontrados.map((t) => t.id)).toEqual(['d']);
  });

  it('filtra por categoría', () => {
    expect(ids(con({ categoria: 'comida' }))).toEqual(['a']);
  });

  it('filtra por cuenta', () => {
    expect(ids(con({ cuentaId: 'nequi' }))).toEqual(['b']);
  });

  it('filtra por tipo', () => {
    expect(ids(con({ kind: 'ingreso' }))).toEqual(['c']);
  });

  it('filtra por rango de fechas, con los extremos incluidos', () => {
    expect(ids(con({ desde: '2026-06-15', hasta: '2026-07-30' }))).toEqual(['c', 'd']);
  });

  it('combina condiciones en vez de quedarse con la última', () => {
    expect(ids(con({ kind: 'gasto', desde: '2026-06-01' }))).toEqual(['a', 'd']);
  });

  it('devuelve vacío cuando nada calza, sin inventar resultados', () => {
    expect(ids(con({ texto: 'bicicleta' }))).toEqual([]);
  });

  it('no confunde un monto con una fecha', () => {
    expect(ids(con({ texto: '2026' }))).toEqual([]);
  });
});

describe('resumirFiltrado', () => {
  it('cuenta y separa lo que entra de lo que sale', () => {
    // Una lista filtrada sigue teniendo que responder "¿cuánto es esto?".
    const resumen = resumirFiltrado(LIBRO);

    expect(resumen.cuantos).toBe(4);
    expect(resumen.gastoCop).toBe(465_000);
    expect(resumen.ingresoCop).toBe(2_500_000);
  });

  it('con nada seleccionado da ceros, no NaN', () => {
    expect(resumirFiltrado([])).toEqual({ cuantos: 0, gastoCop: 0, ingresoCop: 0 });
  });
});
