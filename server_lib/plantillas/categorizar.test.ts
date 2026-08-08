import { describe, expect, it } from 'vitest';
import {
  categorizarDescripcion,
  esContraparteElTitular,
  exclusionDeDescripcion,
} from './categorizar';

describe('categorizarDescripcion', () => {
  it('reconoce comercios conocidos', () => {
    expect(categorizarDescripcion('COMPRA EN MAKRO IBAG')).toBe('mercado');
    expect(categorizarDescripcion('COMPRA EN UBER RIDES')).toBe('transporte');
    expect(categorizarDescripcion('COMPRA EN SPOTIFY')).toBe('entretenimiento');
  });

  it('cae en categoría genérica por palabra clave si no hay comercio', () => {
    expect(categorizarDescripcion('PAGO DE ARRIENDO')).toBe('servicios');
  });

  it('usa otros cuando nada coincide', () => {
    expect(categorizarDescripcion('MOVIMIENTO DESCONOCIDO XYZ')).toBe('otros');
  });

  // Wallet statements label person-to-person movements with nothing but a name.
  // A real Nequi extract was 80 of 105 rows in this shape, all landing in
  // "otros" and rendering the whole breakdown useless.
  describe('transferencias persona a persona', () => {
    it('reconoce "Para <NOMBRE>" como transferencia', () => {
      expect(categorizarDescripcion('Para SOLMAR BRILLYD LEON')).toBe('transferencia');
      expect(categorizarDescripcion('Para MICHAEL STIVENS')).toBe('transferencia');
    });

    it('reconoce "De <NOMBRE>" como transferencia', () => {
      expect(categorizarDescripcion('De MARIA KAMILA ESPEJO')).toBe('transferencia');
    });

    it('deja que el comercio gane sobre el patron De/Para', () => {
      // "Para Exito" es una tienda, no un amigo: la tabla de comercios manda.
      expect(categorizarDescripcion('Para EXITO')).toBe('mercado');
      expect(categorizarDescripcion('De FARMATODO')).toBe('salud');
    });

    it('no confunde una sola palabra tras De/Para', () => {
      // Sin al menos dos palabras de nombre no hay evidencia de que sea persona.
      // (Ojo: "algo" no sirve de ejemplo — es merienda en Colombia y ya está
      // en el vocabulario de comida.)
      expect(categorizarDescripcion('Para zzqx')).toBe('otros');
    });
  });

  describe('lineas propias de billetera', () => {
    it('trata los intereses pagados como ingreso', () => {
      expect(categorizarDescripcion('Pago de Intereses')).toBe('ingreso');
    });

    it('trata un cobro recibido como ingreso', () => {
      expect(categorizarDescripcion('Pago recibido de WOMPI S.A.S.')).toBe('ingreso');
    });
  });
});

describe('exclusionDeDescripcion', () => {
  it('detecta pagos de tarjeta', () => {
    expect(exclusionDeDescripcion('Pagaste tu tarjeta')).toBe('pago-tarjeta');
  });

  it('detecta traslados propios entre Nequi y el banco', () => {
    expect(exclusionDeDescripcion('TRANSFERENCIA DESDE NEQUI')).toBe('traslado-propio');
    expect(exclusionDeDescripcion('TRANSFERENCIAS A NEQUI')).toBe('traslado-propio');
    expect(exclusionDeDescripcion('Recarga desde Bancolombia')).toBe('traslado-propio');
  });

  it('no marca movimientos reales', () => {
    expect(exclusionDeDescripcion('COMPRA EN FARMATODO')).toBeNull();
  });
});

/**
 * BRE-B is Colombia's instant payment rail, not an own-accounts feature. Every
 * BRE-B line used to be written off as an internal transfer, which removed real
 * spending from the totals — payments to other people and a QR payment at a
 * restaurant all vanished from what the user had actually spent.
 */
describe('traslados propios por nombre del titular', () => {
  const TITULAR = 'JULIAN SANTIAGO GONZALEZ REINA';

  it('reconoce un envio a uno mismo', () => {
    expect(esContraparteElTitular('ENVIO CON BRE-B A: JULIAN', TITULAR)).toBe(true);
    expect(esContraparteElTitular('RECIBI POR BRE-B DE: Julián', TITULAR)).toBe(true);
    expect(esContraparteElTitular('Julian Gonzalez', TITULAR)).toBe(true);
  });

  it('NO marca un envio a otra persona', () => {
    expect(esContraparteElTitular('ENVIO CON BRE-B A: LEIDYS', TITULAR)).toBe(false);
    expect(esContraparteElTitular('Para SOLMAR BRILLYD LEON', TITULAR)).toBe(false);
  });

  it('NO marca un pago a un comercio', () => {
    expect(esContraparteElTitular('PAGO EN QR BRE-B: ASADOS', TITULAR)).toBe(false);
  });

  it('exige que TODAS las palabras sean del titular, no una suelta', () => {
    // Un tocayo distinto no es el titular.
    expect(esContraparteElTitular('Para JULIAN MEJIA', TITULAR)).toBe(false);
  });

  it('sin titular no excluye nada por nombre', () => {
    expect(exclusionDeDescripcion('ENVIO CON BRE-B A: JULIAN')).toBeNull();
    expect(exclusionDeDescripcion('ENVIO CON BRE-B A: JULIAN', TITULAR)).toBe('traslado-propio');
  });

  it('sigue excluyendo las recargas y retiros de siempre', () => {
    expect(exclusionDeDescripcion('Recarga en corresponsal', TITULAR)).toBe('traslado-propio');
    expect(exclusionDeDescripcion('Retiro en corresponsales', TITULAR)).toBe('traslado-propio');
  });
});
