import { describe, expect, it } from 'vitest';
import {
  PREFIJO_LLAVE,
  diaBogota,
  diaBogotaHoy,
  generarLlave,
  hashLlave,
  llaveDeCabecera,
  montoEnPesos,
  movimientoDesdeAtajo,
  pistaDeLlave,
} from './atajos';

describe('generarLlave', () => {
  it('lleva el prefijo de la app', () => {
    expect(generarLlave().startsWith(PREFIJO_LLAVE)).toBe(true);
  });

  it('nunca repite dos llaves seguidas', () => {
    // No prueba aleatoriedad de verdad, pero sí que no hay una constante
    // olvidada donde debería haber randomBytes.
    const a = generarLlave();
    const b = generarLlave();
    expect(a).not.toBe(b);
  });

  it('solo usa caracteres seguros para una URL o un campo de texto', () => {
    expect(generarLlave()).toMatch(/^atj_[A-Za-z0-9_-]+$/);
  });
});

describe('hashLlave', () => {
  it('la misma llave produce siempre el mismo hash', () => {
    const llave = generarLlave();
    expect(hashLlave(llave)).toBe(hashLlave(llave));
  });

  it('llaves distintas producen hashes distintos', () => {
    expect(hashLlave('atj_uno')).not.toBe(hashLlave('atj_dos'));
  });

  it('ignora espacio en blanco alrededor, como llega de una cabecera copiada a mano', () => {
    expect(hashLlave('  atj_abc  ')).toBe(hashLlave('atj_abc'));
  });

  it('nunca deja ver la llave en el resultado', () => {
    const llave = 'atj_secreta-de-verdad';
    expect(hashLlave(llave)).not.toContain(llave);
  });

  it('produce un hex de 64 caracteres (sha256)', () => {
    expect(hashLlave('atj_x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('pistaDeLlave', () => {
  it('son los últimos cuatro caracteres', () => {
    expect(pistaDeLlave('atj_abcdWXYZ')).toBe('WXYZ');
  });

  it('recorta espacio en blanco antes de tomar los últimos cuatro', () => {
    expect(pistaDeLlave('atj_abcdWXYZ  ')).toBe('WXYZ');
  });
});

describe('llaveDeCabecera', () => {
  it('acepta el formato Bearer', () => {
    expect(llaveDeCabecera('Bearer atj_123')).toBe('atj_123');
  });

  it('acepta bearer en minúscula', () => {
    expect(llaveDeCabecera('bearer atj_123')).toBe('atj_123');
  });

  it('acepta la llave pelada, sin Bearer', () => {
    // Es el caso real: en Atajos se pega el valor en un campo de texto, y
    // escribir "Bearer " delante es el paso que la gente se salta.
    expect(llaveDeCabecera('atj_123')).toBe('atj_123');
  });

  it('recorta espacio en blanco', () => {
    expect(llaveDeCabecera('  atj_123  ')).toBe('atj_123');
  });

  it('null en null, undefined en null, vacío en null', () => {
    expect(llaveDeCabecera(null)).toBeNull();
    expect(llaveDeCabecera(undefined)).toBeNull();
    expect(llaveDeCabecera('')).toBeNull();
    expect(llaveDeCabecera('   ')).toBeNull();
  });

  it('"Bearer" solo, sin nada más allá del recorte, se trata como llave literal', () => {
    // El recorte de espacio en blanco pasa antes que la regla del prefijo, así
    // que "Bearer " (con el espacio que delataría el prefijo) ya llegó sin él.
    // No hay ninguna llave real que sea la palabra "Bearer", así que esto no
    // pasa en la práctica — se documenta el comportamiento, no se le exige uno.
    expect(llaveDeCabecera('Bearer ')).toBe('Bearer');
    expect(llaveDeCabecera('Bearer')).toBe('Bearer');
  });
});

describe('montoEnPesos', () => {
  it('un entero llano', () => {
    expect(montoEnPesos('24000')).toBe(24000);
  });

  it('punto de miles a la colombiana', () => {
    expect(montoEnPesos('24.000')).toBe(24000);
  });

  it('coma de miles a la gringa', () => {
    expect(montoEnPesos('24,000')).toBe(24000);
  });

  it('símbolo de moneda y espacios', () => {
    expect(montoEnPesos('$ 24.000')).toBe(24000);
    expect(montoEnPesos('COP 24,000')).toBe(24000);
  });

  it('centavos con coma decimal a la colombiana: 24.000,50 -> 24000', () => {
    // Dos dígitos después del último separador = decimal. Se redondea a
    // pesos enteros, la moneda no tiene fracción en la práctica.
    expect(montoEnPesos('24.000,50')).toBe(24001);
  });

  it('centavos con punto decimal a la gringa: 24,000.50 -> 24001', () => {
    expect(montoEnPesos('24,000.50')).toBe(24001);
  });

  it('miles sin separador decimal detrás no se confunden con decimales', () => {
    // Tres dígitos después del separador: es de miles, no decimal.
    expect(montoEnPesos('1.234')).toBe(1234);
    expect(montoEnPesos('1,234')).toBe(1234);
  });

  it('un número ya numérico', () => {
    expect(montoEnPesos(24000)).toBe(24000);
    expect(montoEnPesos(24000.4)).toBe(24000);
    expect(montoEnPesos(24000.6)).toBe(24001);
  });

  it('rechaza cero y negativos', () => {
    expect(montoEnPesos('0')).toBeNull();
    expect(montoEnPesos('-24000')).toBeNull();
    expect(montoEnPesos(-5)).toBeNull();
    expect(montoEnPesos(0)).toBeNull();
  });

  it('rechaza lo que no tiene ni un dígito', () => {
    expect(montoEnPesos('abc')).toBeNull();
    expect(montoEnPesos('$')).toBeNull();
    expect(montoEnPesos('')).toBeNull();
  });

  it('rechaza tipos que no son número ni texto', () => {
    expect(montoEnPesos(null)).toBeNull();
    expect(montoEnPesos(undefined)).toBeNull();
    expect(montoEnPesos({})).toBeNull();
    expect(montoEnPesos([24000])).toBeNull();
  });

  it('rechaza no-finitos', () => {
    expect(montoEnPesos(Infinity)).toBeNull();
    expect(montoEnPesos(NaN)).toBeNull();
  });

  it('rechaza un monto absurdo, señal de un dedo pegado en el 0', () => {
    expect(montoEnPesos('9999999999999')).toBeNull();
  });
});

describe('diaBogota / diaBogotaHoy', () => {
  it('sin fecha, devuelve hoy en Bogotá', () => {
    const ahora = new Date('2026-08-21T23:30:00Z'); // 6:30pm en Bogotá
    expect(diaBogota(undefined, ahora)).toBe(diaBogotaHoy(ahora));
    expect(diaBogota(null, ahora)).toBe(diaBogotaHoy(ahora));
    expect(diaBogota('', ahora)).toBe(diaBogotaHoy(ahora));
  });

  it('un YYYY-MM-DD válido se devuelve tal cual', () => {
    expect(diaBogota('2026-08-15')).toBe('2026-08-15');
  });

  it('una fecha ISO con hora se convierte al día de Bogotá', () => {
    // 2026-08-21T23:30:00Z son las 6:30pm en Bogotá, mismo día calendario.
    expect(diaBogota('2026-08-21T23:30:00Z')).toBe('2026-08-21');
  });

  it('una fecha ISO cerca de medianoche puede caer en el día anterior en Bogotá', () => {
    // 2026-08-22T02:00:00Z son las 9pm del 21 en Bogotá (UTC-5).
    expect(diaBogota('2026-08-22T02:00:00Z')).toBe('2026-08-21');
  });

  it('rechaza un día calendario que no existe', () => {
    expect(diaBogota('2026-02-30')).toBeNull();
    expect(diaBogota('2026-04-31')).toBeNull();
  });

  it('rechaza texto que no es una fecha', () => {
    expect(diaBogota('no es una fecha')).toBeNull();
  });

  it('rechaza tipos que no son texto', () => {
    expect(diaBogota(12345 as unknown as string)).toBeNull();
    expect(diaBogota({} as unknown as string)).toBeNull();
  });
});

describe('movimientoDesdeAtajo', () => {
  const AHORA = new Date('2026-08-21T20:00:00Z');

  it('arma un gasto mínimo válido', () => {
    const r = movimientoDesdeAtajo({ monto: '24.000', comercio: 'Juan Valdez' }, 'user-1', AHORA);
    expect('fila' in r).toBe(true);
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.user_id).toBe('user-1');
    expect(r.fila.kind).toBe('gasto');
    expect(r.fila.amount_cop).toBe(24000);
    expect(r.fila.description).toBe('Juan Valdez');
    expect(r.fila.raw_transcript).toBe('Juan Valdez');
    expect(r.fila.cuenta_id).toBeNull();
    expect(r.fila.occurred_on).toBe(diaBogotaHoy(AHORA));
  });

  it('el raw_transcript nunca lleva "apple pay" ni el monto, solo el comercio', () => {
    // Es el material del que aprende el léxico del usuario (aprenderDe): si
    // aquí se colara "apple pay" o el monto, le enseñaría al léxico que esas
    // palabras predicen la categoría, y no es cierto para nada.
    const r = movimientoDesdeAtajo(
      { monto: '24000', comercio: 'Éxito' },
      'user-1',
      AHORA,
    );
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.raw_transcript.toLowerCase()).not.toContain('apple');
    expect(r.fila.raw_transcript).not.toContain('24000');
  });

  it('categoriza el comercio igual que el importador de extractos', () => {
    const r = movimientoDesdeAtajo({ monto: '10000', comercio: 'Rappi' }, 'user-1', AHORA);
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.category).not.toBe('otros');
  });

  it('un ingreso siempre se categoriza como ingreso, sin adivinar por comercio', () => {
    const r = movimientoDesdeAtajo(
      { monto: '10000', comercio: 'Rappi', tipo: 'ingreso' },
      'user-1',
      AHORA,
    );
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.kind).toBe('ingreso');
    expect(r.fila.category).toBe('ingreso');
  });

  it('acepta una cuentaId válida', () => {
    const cuentaId = '11111111-1111-1111-1111-111111111111';
    const r = movimientoDesdeAtajo({ monto: '10000', comercio: 'X', cuentaId }, 'user-1', AHORA);
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.cuenta_id).toBe(cuentaId);
  });

  it('rechaza una cuentaId que no es un uuid', () => {
    const r = movimientoDesdeAtajo(
      { monto: '10000', comercio: 'X', cuentaId: 'no-es-un-uuid' },
      'user-1',
      AHORA,
    );
    expect('error' in r).toBe(true);
  });

  it('respeta un id propio para que un reintento no duplique el gasto', () => {
    const id = '22222222-2222-2222-2222-222222222222';
    const r = movimientoDesdeAtajo({ monto: '10000', comercio: 'X', id }, 'user-1', AHORA);
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.id).toBe(id);
  });

  it('rechaza un id que no es un uuid', () => {
    const r = movimientoDesdeAtajo(
      { monto: '10000', comercio: 'X', id: 'no-es-un-uuid' },
      'user-1',
      AHORA,
    );
    expect('error' in r).toBe(true);
  });

  it('sin id, genera uno distinto cada vez', () => {
    const a = movimientoDesdeAtajo({ monto: '10000', comercio: 'X' }, 'user-1', AHORA);
    const b = movimientoDesdeAtajo({ monto: '10000', comercio: 'X' }, 'user-1', AHORA);
    if (!('fila' in a) || !('fila' in b)) throw new Error('esperaba fila');
    expect(a.fila.id).not.toBe(b.fila.id);
  });

  it('rechaza sin comercio', () => {
    expect('error' in movimientoDesdeAtajo({ monto: '10000' }, 'user-1', AHORA)).toBe(true);
    expect('error' in movimientoDesdeAtajo({ monto: '10000', comercio: '' }, 'user-1', AHORA)).toBe(
      true,
    );
    expect(
      'error' in movimientoDesdeAtajo({ monto: '10000', comercio: '   ' }, 'user-1', AHORA),
    ).toBe(true);
  });

  it('rechaza sin monto o con un monto inválido', () => {
    expect('error' in movimientoDesdeAtajo({ comercio: 'X' }, 'user-1', AHORA)).toBe(true);
    expect(
      'error' in movimientoDesdeAtajo({ monto: 'no-es-plata', comercio: 'X' }, 'user-1', AHORA),
    ).toBe(true);
    expect('error' in movimientoDesdeAtajo({ monto: '-100', comercio: 'X' }, 'user-1', AHORA)).toBe(
      true,
    );
  });

  it('rechaza una fecha que no se entiende', () => {
    expect(
      'error' in
        movimientoDesdeAtajo({ monto: '10000', comercio: 'X', fecha: 'ayer nomás' }, 'user-1', AHORA),
    ).toBe(true);
  });

  it('rechaza un tipo que no es gasto ni ingreso', () => {
    expect(
      'error' in
        movimientoDesdeAtajo({ monto: '10000', comercio: 'X', tipo: 'transferencia' }, 'user-1', AHORA),
    ).toBe(true);
  });

  it('recorta y colapsa espacios largos del comercio', () => {
    const r = movimientoDesdeAtajo(
      { monto: '10000', comercio: '  Juan   Valdez  Café  ' },
      'user-1',
      AHORA,
    );
    if (!('fila' in r)) throw new Error('esperaba fila');
    expect(r.fila.description).toBe('Juan Valdez Café');
  });
});
