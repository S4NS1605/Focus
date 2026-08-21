import { describe, it, expect } from 'vitest';
import { parseTransaction } from './parseTransaction';

describe('parseTransaction — expenses', () => {
  it('reads a full expense sentence with a merchant', () => {
    const r = parseTransaction('gasté 20 mil en el mercado del D1');
    expect(r.kind).toBe('gasto');
    expect(r.amount).toBe(20000);
    expect(r.category).toBe('mercado');
    expect(r.description).toContain('D1');
    expect(r.signals.categorySource).toBe('merchant');
    expect(r.needsReview).toBe(false);
  });

  it('reads es-CO digit grouping', () => {
    const r = parseTransaction('pagué 45.000 de Transmilenio');
    expect(r.kind).toBe('gasto');
    expect(r.amount).toBe(45000);
    expect(r.category).toBe('transporte');
  });

  it('reads a category keyword without a merchant', () => {
    const r = parseTransaction('compré almuerzo por 15 mil');
    expect(r.kind).toBe('gasto');
    expect(r.amount).toBe(15000);
    expect(r.category).toBe('comida');
    expect(r.signals.categorySource).toBe('keyword');
  });

  it('reads slang amounts', () => {
    const r = parseTransaction('saqué 200 mil del cajero');
    expect(r.amount).toBe(200000);
    expect(r.category).toBe('transferencia');
  });

  it('reads a half-scale amount', () => {
    const r = parseTransaction('retiré medio millón de Nequi');
    expect(r.kind).toBe('gasto');
    expect(r.amount).toBe(500000);
    expect(r.category).toBe('transferencia');
    expect(r.description).toBe('Retiré de');
  });
});

// "me" starts both income and expense phrases. Longest-first matching is what
// keeps these on the correct side.
describe('parseTransaction — the "me" trap', () => {
  it('treats "me costó" as an expense', () => {
    const r = parseTransaction('me costó 80 lucas el Uber');
    expect(r.kind).toBe('gasto');
    expect(r.amount).toBe(80000);
    expect(r.category).toBe('transporte');
    expect(r.signals.kindSource).toBe('keyword');
  });

  it('treats "me salió" as an expense', () => {
    expect(parseTransaction('me salió en 30 mil').kind).toBe('gasto');
  });

  it('separates aboné / me abonaron', () => {
    expect(parseTransaction('aboné 100 mil').kind).toBe('gasto');
    expect(parseTransaction('me abonaron 100 mil').kind).toBe('ingreso');
  });

  it('separates consigné / me consignaron', () => {
    expect(parseTransaction('consigné 300 mil').kind).toBe('gasto');
    expect(parseTransaction("me consignaron 1'200.000").kind).toBe('ingreso');
  });

  it('treats "me cobraron" as an expense despite the -aron ending', () => {
    const r = parseTransaction('me cobraron 50 mil');
    expect(r.kind).toBe('gasto');
    expect(r.signals.kindSource).toBe('keyword');
  });
});

describe('parseTransaction — income', () => {
  it('reads an explicit income phrase', () => {
    const r = parseTransaction('me entraron 2 millones');
    expect(r.kind).toBe('ingreso');
    expect(r.amount).toBe(2000000);
  });

  it('reads the Colombian apostrophe millions separator', () => {
    expect(parseTransaction("me consignaron 1'200.000").amount).toBe(1200000);
  });

  it('reads other income verbs', () => {
    expect(parseTransaction('recibí 500 mil de un cliente').kind).toBe('ingreso');
    expect(parseTransaction('cobré 300 mil').kind).toBe('ingreso');
    expect(parseTransaction('gané 50 mil').kind).toBe('ingreso');
    expect(parseTransaction('me llegó el pago de 800 mil').kind).toBe('ingreso');
  });

  it('infers income from morphology for verbs not in the table', () => {
    const r = parseTransaction('me reembolsaron 20 mil');
    expect(r.kind).toBe('ingreso');
    expect(r.signals.kindSource).toBe('morphology');
  });

  it('infers income from the category alone, with no verb', () => {
    const r = parseTransaction('el salario de este mes');
    expect(r.kind).toBe('ingreso');
    expect(r.signals.kindSource).toBe('category-implied');
    expect(r.amount).toBeNull();
    expect(r.needsReview).toBe(true);
  });

  it('falls back to the ingreso category when nothing else matched', () => {
    const r = parseTransaction('me pagaron 900 mil');
    expect(r.kind).toBe('ingreso');
    expect(r.category).toBe('ingreso');
    expect(r.description).toBe('Me pagaron');
  });
});

// The classic bug family: a substring matcher would find `ara` in "para",
// `mil` in "familia", `uno` in "desayuno", `d1` in "d10".
describe('parseTransaction — no-substring invariants', () => {
  it('does not find the Ara supermarket inside "para"', () => {
    expect(parseTransaction('pagué el pasaje para el trabajo').category).toBe('transporte');
  });

  it('does not find "mil" inside "familia"', () => {
    expect(parseTransaction('compré comida para la familia').amount).toBeNull();
  });

  it('does not find "uno" inside "desayuno"', () => {
    const r = parseTransaction('el desayuno');
    expect(r.amount).toBeNull();
    expect(r.category).toBe('comida');
  });

  it('does not find the D1 merchant inside "d10"', () => {
    expect(parseTransaction('gasté en camisetas d10').category).toBe('ropa');
  });
});

describe('parseTransaction — amount candidate selection', () => {
  it('prefers the scaled amount over a leading quantity', () => {
    const r = parseTransaction('compré 2 pizzas por 30 mil');
    expect(r.amount).toBe(30000);
    expect(r.category).toBe('comida');
    expect(r.signals.ambiguousAmount).toBe(true);
  });

  it('prefers the amount over a count of months', () => {
    expect(parseTransaction('pagué 3 meses de gym por 300 mil').amount).toBe(300000);
  });

  it('reports an unambiguous amount as unambiguous', () => {
    expect(parseTransaction('gasté 30 mil').signals.ambiguousAmount).toBe(false);
  });
});

describe('parseTransaction — review flagging', () => {
  it('flags an amount with no direction verb', () => {
    const r = parseTransaction('20 mil');
    expect(r.amount).toBe(20000);
    expect(r.kind).toBe('gasto');
    expect(r.signals.kindSource).toBe('default');
    expect(r.needsReview).toBe(true);
  });

  it('flags a sentence with no amount and preserves the transcript', () => {
    const r = parseTransaction('compré algo');
    expect(r.amount).toBeNull();
    expect(r.needsReview).toBe(true);
    expect(r.raw).toBe('compré algo');
  });

  it('does not throw on empty input', () => {
    const r = parseTransaction('');
    expect(r.amount).toBeNull();
    expect(r.needsReview).toBe(true);
    expect(r.signals.amountSource).toBe('none');
  });
});

describe('parseTransaction — description', () => {
  it('keeps conversational phrasing including verb and stopwords', () => {
    expect(parseTransaction('gasté 20 mil en el mercado').description).toBe('Gasté en el mercado');
  });

  it('keeps the verb even if nothing else is left', () => {
    expect(parseTransaction('gasté 20 mil').description).toBe('Gasté');
  });

  it('restores merchant accents and casing that dictation flattens', () => {
    expect(parseTransaction('gasté 50 mil en exito').description).toBe('Gasté en Éxito');
    expect(parseTransaction('pagué 45 mil de transmilenio').description).toBe(
      'Pagué de TransMilenio',
    );
  });

  it('keeps a quantity that is not the amount', () => {
    expect(parseTransaction('compré 2 pizzas por 30 mil').description).toBe('Compré 2 pizzas'); // 'por' is an AMOUNT_CUE and gets consumed!
  });

  it('extracts specific message from OCR receipts', () => {
    expect(
      parseTransaction(
        '[OCR] Envío exitoso Destino Julian Mensaje Para la pizza de anoche Valor $ 50.000',
      ).description,
    ).toBe('Para la pizza de anoche');
    expect(
      parseTransaction('[OCR] Aprobado Motivo Pago de arriendo Fecha 12 de Agosto').description,
    ).toBe('Pago de arriendo');
    const nequiRaw =
      '[OCR] € comprobante de pago (O Envío Realizado A [a] Le I "| E _— L.] NN L a La “ EH El [m] P E, h: O ¡Escanea este GR con Nequi para verificar tu envío al instante! Para Josue Conversación Te envío esto como prueba para la app de finanzas gracias bro ¿Cuánto? $ 100,00 Número Nequi 310 2201494 Fecha 16 de agosto de 2026 alas 06:15 p.m. Referencia M16482536';
    const nequiTx = parseTransaction(nequiRaw);
    expect(nequiTx.description).toBe(
      'Te envío esto como prueba para la app de finanzas gracias bro (06:15)',
    );
    expect(nequiTx.amount).toBe(100);
  });
});

describe('parseTransaction — confidence', () => {
  it('decreases as signals disappear', () => {
    const full = parseTransaction('gasté 20 mil en el D1');
    const noCategory = parseTransaction('gasté 20 mil');
    const amountOnly = parseTransaction('20 mil');
    const empty = parseTransaction('');

    expect(full.confidence).toBeGreaterThan(noCategory.confidence);
    expect(noCategory.confidence).toBeGreaterThan(amountOnly.confidence);
    expect(amountOnly.confidence).toBeGreaterThan(empty.confidence);
    expect(empty.confidence).toBe(0);
  });

  it('stays within 0..1', () => {
    for (const input of ['gasté 20 mil en el D1', '', 'hola', 'me entraron 2 millones']) {
      const c = parseTransaction(input).confidence;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe('parseTransaction — robustness and purity', () => {
  const inputs = [
    'GASTÉ 20 MIL EN EL D1',
    '   gasté 20 mil   ',
    'gasté  20  mil  en  mercado.',
    '¿gasté 20 mil?',
    'me entraron 2 millones 🎉',
    `divagando mucho ${'texto '.repeat(80)}gasté 20 mil`,
  ];

  it('handles messy transcripts without throwing', () => {
    for (const input of inputs) {
      expect(() => parseTransaction(input)).not.toThrow();
    }
  });

  it('still finds the amount through the noise', () => {
    expect(parseTransaction('GASTÉ 20 MIL EN EL D1').amount).toBe(20000);
    expect(parseTransaction('¿gasté 20 mil?').amount).toBe(20000);
  });

  it('preserves raw byte-for-byte in every branch', () => {
    for (const input of [...inputs, '', 'hola']) {
      expect(parseTransaction(input).raw).toBe(input);
    }
  });

  it('is deterministic', () => {
    for (const input of inputs) {
      expect(parseTransaction(input)).toEqual(parseTransaction(input));
    }
  });
});

describe('parseTransaction — de qué cuenta habla el texto', () => {
  const CUENTAS = [
    { id: 'nequi', nombre: 'Nequi' },
    { id: 'banco', nombre: 'Bancolombia' },
    { id: 'davi', nombre: 'Davivienda' },
    { id: 'efec', nombre: 'Efectivo' },
    { id: 'bogota', nombre: 'Banco de Bogotá' },
  ];

  const leer = (texto: string) => parseTransaction(texto, CUENTAS);

  it('reconoce el banco al que le entró la plata', () => {
    const r = leer('me transfirieron 20.000 pesos a Bancolombia');

    expect(r.kind).toBe('ingreso');
    expect(r.amount).toBe(20000);
    expect(r.cuentaId).toBe('banco');
  });

  it('reconoce de dónde salió un gasto', () => {
    const r = leer('pagué 45 mil de Nequi');

    expect(r.kind).toBe('gasto');
    expect(r.cuentaId).toBe('nequi');
  });

  it('entiende el efectivo como cualquier otra cuenta', () => {
    expect(leer('gasté 12 mil en efectivo').cuentaId).toBe('efec');
  });

  it('no le importan tildes ni mayúsculas', () => {
    expect(leer('me llegaron 50 mil a BANCO DE BOGOTA').cuentaId).toBe('bogota');
  });

  it('prefiere el nombre largo cuando uno contiene al otro', () => {
    // "Banco de Bogotá" no puede resolverse como un "Banco" suelto.
    expect(leer('me consignaron 100 mil al Banco de Bogotá').cuentaId).toBe('bogota');
  });

  it('no repite el banco en la descripción', () => {
    // Con el banco ya en su propio campo, decirlo otra vez en el texto de la
    // fila es decir lo mismo dos veces.
    const r = leer('me transfirieron 20 mil a Bancolombia');

    expect(r.description.toLowerCase()).not.toContain('bancolombia');
  });

  it('deja la cuenta en nulo cuando el texto no nombra ninguna', () => {
    expect(leer('gasté 20 mil en almuerzo').cuentaId).toBeNull();
    expect(leer('gasté 20 mil en almuerzo').signals.cuentaSource).toBe('ninguna');
  });

  it('no inventa cuentas cuando no le pasan ninguna', () => {
    // El parser es función de sus entradas: sin lista, no hay nada que reconocer.
    expect(parseTransaction('me transfirieron 20 mil a Bancolombia').cuentaId).toBeNull();
  });

  it('no confunde un nombre metido dentro de otra palabra', () => {
    // Igualdad por token, nunca subcadena.
    const r = parseTransaction('gasté 20 mil en nequitos', [{ id: 'nequi', nombre: 'Nequi' }]);

    expect(r.cuentaId).toBeNull();
  });

  it('marca cuándo la frase de verdad señaló la cuenta', () => {
    expect(leer('me pagaron 80 mil a Nequi').signals.cuentaSource).toBe('preposicion');
    expect(leer('Nequi 80 mil').signals.cuentaSource).toBe('nombre');
  });

  it('con dos cuentas nombradas, gana la que lleva preposición', () => {
    const r = leer('Bancolombia me devolvió 30 mil a Nequi');

    expect(r.cuentaId).toBe('nequi');
  });

  it('el monto sigue saliendo bien con el banco de por medio', () => {
    // El banco se consume DESPUÉS del monto, así que no puede robarle dígitos.
    const r = leer('me transfirieron 1.200.000 a Davivienda');

    expect(r.amount).toBe(1_200_000);
    expect(r.cuentaId).toBe('davi');
  });
});

describe('parseTransaction — categorías del usuario', () => {
  const cat = (id: string, nombre: string) => ({
    id,
    nombre,
    icon: 'Package',
    color: '#A8A29E',
    createdAt: '2026-08-01T00:00:00.000Z',
    archivedAt: null as string | null,
  });

  it('reconoce una categoría que el usuario creó, por su nombre', () => {
    const r = parseTransaction('gasté 30 mil en mascotas', [], [cat('c-masc', 'Mascotas')]);
    expect(r.amount).toBe(30000);
    expect(r.category).toBe('c-masc');
    expect(r.signals.categorySource).toBe('usuario');
    // El nombre se conserva en la descripción, no se consume.
    expect(r.description.toLowerCase()).toContain('mascotas');
  });

  it('la categoría del usuario gana sobre la palabra genérica de fábrica', () => {
    // "café" de fábrica cae en comida; si el usuario hizo una categoría "Café",
    // esa gana — es su taxonomía, dicha a propósito.
    const r = parseTransaction('gasté 5 mil en cafe', [], [cat('c-cafe', 'Café')]);
    expect(r.category).toBe('c-cafe');
    expect(r.signals.categorySource).toBe('usuario');
  });

  it('resuelve un nombre de categoría de varias palabras', () => {
    const r = parseTransaction(
      'pagué 80 mil en cosas de la casa',
      [],
      [cat('c-casa', 'Cosas de la casa')],
    );
    expect(r.category).toBe('c-casa');
    expect(r.signals.categorySource).toBe('usuario');
  });

  it('prefiere el nombre más largo cuando dos calzan', () => {
    const cats = [cat('c-casa', 'Casa'), cat('c-cosas', 'Cosas de la casa')];
    const r = parseTransaction('80 mil en cosas de la casa', [], cats);
    expect(r.category).toBe('c-cosas');
  });

  it('no matchea el nombre dentro de otra palabra', () => {
    // "Ropa" no debe calzar dentro de "Europa".
    const r = parseTransaction('gasté 200 mil en un viaje a Europa', [], [cat('c-ropa', 'Ropa')]);
    expect(r.category).not.toBe('c-ropa');
  });

  it('un nombre de categoría archivada no resuelve', () => {
    const viejo = { ...cat('c-x', 'Mascotas'), archivedAt: '2026-01-01T00:00:00.000Z' };
    const r = parseTransaction('gasté 30 mil en mascotas', [], [viejo]);
    expect(r.category).not.toBe('c-x');
  });

  it('sin categorías del usuario, todo sigue igual', () => {
    const r = parseTransaction('compré almuerzo por 15 mil', [], []);
    expect(r.category).toBe('comida');
    expect(r.signals.categorySource).toBe('keyword');
  });
});

describe('parseTransaction — aprendido del historial', () => {
  const lex = {
    // "croquetas" aprendida hacia una categoría del usuario; "cine" desviada por
    // el usuario hacia 'salud' (contra la de fábrica, entretenimiento).
    categoriaDe: (n: string) => (n === 'croquetas' ? 'c-mascotas' : n === 'cine' ? 'salud' : null),
    tamano: 2,
  };

  it('usa lo aprendido cuando la lista de fábrica no sabe', () => {
    const r = parseTransaction('gasté 20 mil en croquetas', [], [], lex);
    expect(r.category).toBe('c-mascotas');
    expect(r.signals.categorySource).toBe('aprendida');
  });

  it('lo aprendido gana sobre la palabra genérica de fábrica', () => {
    // "cine" de fábrica es entretenimiento; el usuario lo mandó a salud siempre.
    const r = parseTransaction('pagué 18 mil de cine', [], [], lex);
    expect(r.category).toBe('salud');
    expect(r.signals.categorySource).toBe('aprendida');
  });

  it('una categoría nombrada explícitamente gana sobre lo aprendido', () => {
    const cat = {
      id: 'c-cine-real',
      nombre: 'Cine',
      icon: 'Package',
      color: '#A8A29E',
      createdAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null as string | null,
    };
    const r = parseTransaction('pagué 18 mil de cine', [], [cat], lex);
    expect(r.category).toBe('c-cine-real');
    expect(r.signals.categorySource).toBe('usuario');
  });

  it('una marca conocida gana sobre lo aprendido', () => {
    // Éxito es una marca dura (mercado); lo aprendido no la desplaza.
    const conExito = { ...lex, categoriaDe: (n: string) => (n === 'exito' ? 'salud' : null) };
    const r = parseTransaction('gasté 50 mil en Éxito', [], [], conExito);
    expect(r.category).toBe('mercado');
    expect(r.signals.categorySource).toBe('merchant');
  });

  it('sin léxico, todo sigue igual', () => {
    const r = parseTransaction('gasté 20 mil en croquetas');
    expect(r.category).toBe('otros');
    expect(r.signals.categorySource).toBe('default');
  });
});

describe('El Oráculo no inventa montos', () => {
  const almuerzo = {
    id: 't-viejo',
    kind: 'gasto' as const,
    amountCop: 13_500,
    category: 'comida',
    description: 'Almuerzo',
    occurredOn: '2026-08-01',
    cuentaId: null,
    rawTranscript: '',
    createdAt: '2026-08-01T12:00:00.000Z',
  };

  it('hereda el monto cuando la palabra sí está, entera', () => {
    // Para esto existe el Oráculo: dices "almuerzo" y ya sabe cuánto vale.
    const r = parseTransaction('almuerzo', [], [], undefined, [almuerzo]);
    expect(r.amount).toBe(13_500);
  });

  it('no hereda nada de una coincidencia de letras sueltas', () => {
    // Whisper devuelve "Gracias" cuando le llega silencio: apagar el micrófono
    // sin hablar no puede acabar siendo un gasto. La "as" de "Gracias" está
    // dentro de "Almuerzo" sin que eso signifique absolutamente nada.
    const r = parseTransaction('Gracias', [], [], undefined, [almuerzo]);
    expect(r.amount).toBeNull();
  });

  it('una palabra muy corta no dispara la memoria', () => {
    const corto = { ...almuerzo, description: 'Uber' };
    const r = parseTransaction('en', [], [], undefined, [corto]);
    expect(r.amount).toBeNull();
  });
});
