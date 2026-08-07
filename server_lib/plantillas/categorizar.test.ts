import { describe, expect, it } from 'vitest';
import { categorizarDescripcion, exclusionDeDescripcion } from './categorizar';

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
