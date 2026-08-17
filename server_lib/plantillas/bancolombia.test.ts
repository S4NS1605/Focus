import { describe, expect, it } from 'vitest';
import { pareceBancolombia, parsearBancolombia, periodoBancolombia } from './bancolombia';

const ENCABEZADO = `ESTADO DE CUENTA
DESDE: 2026/03/31 HASTA: 2026/06/30
CUENTA DE AHORROS
NÚMERO [DATO PERSONAL OCULTO]
DCF:defensor@bancolombia.com.co;www.bancolombia.com/personas/defensor-financiero
JUANA PEREZ EJEMPLO
`;

const PAGINA_ROW_MAJOR = `FECHA DESCRIPCIÓN SUCURSAL DCTO. VALOR SALDO
4/04 TRANSFERENCIA DESDE NEQUI 10,000.00 10,000.46
4/04 COMPRA EN DOLLARCITY -54,000.00 39,000.46
6/04 ABONO INTERESES AHORROS .03 10,000.49
`;

const PAGINA_COLUMN_MAJOR = `FECHA DESCRIPCIÓN SUCURSAL DCTO. VALOR SALDO
24/04
25/04
COMPRA EN SAN DIEGO
TRANSFERENCIA DESDE NEQUI
-135,000.00
7,000.00
6,001.22
13,001.22
`;

describe('plantilla Bancolombia', () => {
  it('reconoce un extracto de Bancolombia', () => {
    expect(pareceBancolombia(ENCABEZADO)).toBe(true);
    expect(pareceBancolombia('cualquier otro texto')).toBe(false);
  });

  it('extrae el período', () => {
    expect(periodoBancolombia(ENCABEZADO)).toEqual({
      desde: '2026-03-31',
      hasta: '2026-06-30',
      etiqueta: '31/03/2026 — 30/06/2026',
    });
  });

  it('parsea una página en formato fila-por-línea', () => {
    const movimientos = parsearBancolombia(ENCABEZADO + PAGINA_ROW_MAJOR);
    expect(movimientos).toHaveLength(3);
    expect(movimientos[0]).toMatchObject({ fecha: '2026-04-04', montoCop: 10000, tipo: 'ingreso' });
    expect(movimientos[1]).toMatchObject({
      fecha: '2026-04-04',
      montoCop: 54000,
      tipo: 'gasto',
      categoria: 'hogar',
    });
    // ".03" pesos of paid interest — no leading digit before the decimal point.
    expect(movimientos[2]).toMatchObject({ montoCop: 0, tipo: 'ingreso' });
  });

  it('reconstruye una página que el PDF emitió columna por columna', () => {
    const movimientos = parsearBancolombia(ENCABEZADO + PAGINA_COLUMN_MAJOR);
    expect(movimientos).toHaveLength(2);
    expect(movimientos[0]).toMatchObject({
      fecha: '2026-04-24',
      descripcion: 'COMPRA EN SAN DIEGO',
      montoCop: 135000,
      tipo: 'gasto',
    });
    expect(movimientos[1]).toMatchObject({
      fecha: '2026-04-25',
      descripcion: 'TRANSFERENCIA DESDE NEQUI',
      montoCop: 7000,
      tipo: 'ingreso',
      exclusion: 'traslado-propio',
    });
  });

  it('marca los traslados a/desde Nequi como excluidos', () => {
    const [primero] = parsearBancolombia(ENCABEZADO + PAGINA_ROW_MAJOR);
    expect(primero.exclusion).toBe('traslado-propio');
  });

  it('sin período reconocible no produce nada', () => {
    expect(parsearBancolombia(PAGINA_ROW_MAJOR)).toEqual([]);
  });
});
