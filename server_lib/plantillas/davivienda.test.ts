import { describe, expect, it } from 'vitest';
import { pareceDavivienda, parsearDavivienda, periodoDavivienda } from './davivienda';

const CABECERA = [
  'Banco Davivienda S.A NIT.860.034.313-7',
  'CUENTA DE AHORRO',
  'INFORME DEL MES: JULIO /2026',
  'Fecha Valor Doc. Clase de Movimiento Oficina',
].join('\n');

const extracto = (...filas: string[]): string => [CABECERA, ...filas].join('\n');

describe('pareceDavivienda', () => {
  it('reconoce el extracto por banco y cabecera de mes', () => {
    expect(pareceDavivienda(CABECERA)).toBe(true);
  });

  it('no reclama extractos de otros bancos', () => {
    expect(pareceDavivienda('Estado de cuenta Bancolombia')).toBe(false);
    expect(pareceDavivienda('Extracto de depósito de bajo monto Nequi')).toBe(false);
  });
});

describe('periodoDavivienda', () => {
  it('deriva el mes completo de la cabecera', () => {
    expect(periodoDavivienda(CABECERA)).toEqual({
      desde: '2026-07-01',
      hasta: '2026-07-31',
      etiqueta: 'julio 2026',
    });
  });

  it('acierta el último día de meses cortos y bisiestos', () => {
    expect(periodoDavivienda('Davivienda INFORME DEL MES: ABRIL /2026')?.hasta).toBe('2026-04-30');
    expect(periodoDavivienda('Davivienda INFORME DEL MES: FEBRERO /2024')?.hasta).toBe('2024-02-29');
    expect(periodoDavivienda('Davivienda INFORME DEL MES: FEBRERO /2026')?.hasta).toBe('2026-02-28');
  });

  it('entiende el mes con tilde', () => {
    expect(periodoDavivienda('Davivienda INFORME DEL MES: MARZO /2026')?.etiqueta).toBe('marzo 2026');
  });
});

describe('parsearDavivienda', () => {
  it('lee el signo que va DESPUES del monto', () => {
    // Este banco escribe "614,139.00-", no "-614,139.00". Leerlo como los demás
    // convertiría cada retiro en un depósito.
    const movs = parsearDavivienda(
      extracto(
        '30 07 $ 614,139.00+ 8509 Abono En Cuenta Por Pago de Nomina',
        '31 07 $ 8,000.00- 2750 Transferencia A Llave Otra Entidad Redeban BreB',
      ),
    );

    expect(movs).toHaveLength(2);
    expect(movs[0]).toMatchObject({ tipo: 'ingreso', montoCop: 614139 });
    expect(movs[1]).toMatchObject({ tipo: 'gasto', montoCop: 8000 });
  });

  it('toma el año de la cabecera, que no viene en la fila', () => {
    const [mov] = parsearDavivienda(extracto('30 07 $ 1,000.00+ 0001 Algo'));

    expect(mov.fecha).toBe('2026-07-30');
  });

  it('fecha en el año anterior una fila de diciembre en un extracto de enero', () => {
    const [mov] = parsearDavivienda(
      ['Davivienda', 'INFORME DEL MES: ENERO /2026', '31 12 $ 1,000.00- 0001 Compra'].join('\n'),
    );

    // Sin esto quedaría en diciembre de 2026: doce meses en el futuro.
    expect(mov.fecha).toBe('2025-12-31');
  });

  it('excluye los movimientos contra el Bolsillo', () => {
    // El extracto imprime las DOS caras del mismo traslado: el débito en la
    // cuenta y el crédito en el bolsillo, con el mismo número de documento.
    const movs = parsearDavivienda(
      extracto(
        '30 07 $ 614,139.00- 1025 Transferencia de Dinero a Bolsillo App Davivienda',
        '30 07 $ 614,139.00+ 1025 Transferencia desde Cuenta a Bolsillo App Davivienda',
        '31 07 $ 614,139.00+ 3359 Abono cancelacion del Bolsillo App Davivienda',
        '31 07 $ 614,139.00- 3359 Debito por cancelacion del Bolsillo App Davivienda',
      ),
    );

    expect(movs).toHaveLength(4);
    expect(movs.every((m) => m.exclusion === 'traslado-propio')).toBe(true);
  });

  it('lee montos de centavos sin parte entera agrupada', () => {
    const [mov] = parsearDavivienda(extracto('31 07 $ 3.34+ 0000 Rendimientos Financieros. 0000'));

    expect(mov).toMatchObject({ montoCop: 3, tipo: 'ingreso', categoria: 'ingreso' });
  });

  it('ignora las lineas de saldo y los avisos legales', () => {
    const movs = parsearDavivienda(
      extracto(
        'Saldo Anterior $0.00',
        'Nuevo Saldo $606,142.34',
        'Este producto cuenta con seguro de depósitos',
        '30 07 $ 1,000.00+ 0001 Un movimiento de verdad',
      ),
    );

    expect(movs).toHaveLength(1);
    expect(movs[0].descripcion).toBe('Un movimiento de verdad');
  });

  it('devuelve vacio sin cabecera de mes, en vez de inventar un año', () => {
    expect(parsearDavivienda('30 07 $ 1,000.00+ 0001 Algo')).toEqual([]);
  });
});
