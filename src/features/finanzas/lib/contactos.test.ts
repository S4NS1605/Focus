import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  UMBRAL_PREGUNTA,
  balanceConAlias,
  dudasDeUnion,
  movimientosDeAlias,
  movimientosDeContacto,
  normalizarNombre,
  parecido,
  partesDelLibro,
} from './contactos';
import type { Contacto } from './contactos';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 20_000,
  category: 'transferencia',
  description: 'Envio con BRE-B a: JUAN PEREZ',
  occurredOn: '2026-08-01',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

const contacto = (over: Partial<Contacto> = {}): Contacto => ({
  id: 'k1',
  nombre: 'Juan Perez',
  alias: ['juan perez'],
  separadoDe: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

describe('normalizarNombre', () => {
  it('iguala tildes, mayúsculas y puntuación', () => {
    expect(normalizarNombre('JUAN PÉREZ')).toBe(normalizarNombre('juan perez'));
    expect(normalizarNombre('Juan P.')).toBe('juan p');
  });

  it('no colapsa nombres distintos', () => {
    expect(normalizarNombre('Ana Gómez')).not.toBe(normalizarNombre('Ana Gutiérrez'));
  });
});

describe('parecido', () => {
  it('da 1 solo cuando es literalmente el mismo nombre', () => {
    // 1 significa certeza. Nada que se deduzca puede alcanzarlo, o quien
    // compare contra 1 confundiría una suposición con un hecho.
    expect(parecido('JUAN PÉREZ', 'juan perez')).toBe(1);
    expect(parecido('Juan Perez', 'Juan P')).toBeLessThan(1);
  });

  it('reconoce una inicial en lugar del apellido', () => {
    expect(parecido('Juan Perez', 'Juan P')).toBeGreaterThanOrEqual(UMBRAL_PREGUNTA);
  });

  it('reconoce un segundo nombre de más', () => {
    expect(parecido('Juan Perez', 'Juan Carlos Perez')).toBeGreaterThanOrEqual(UMBRAL_PREGUNTA);
  });

  it('tolera una errata en palabras largas', () => {
    expect(parecido('Alejandra Gomez', 'Alejandro Gomez')).toBeGreaterThanOrEqual(UMBRAL_PREGUNTA);
  });

  it('NO tolera una letra de diferencia en nombres cortos', () => {
    // "Ana" y "Ema" están a una edición, y son dos personas distintas.
    expect(parecido('Ana', 'Ema')).toBeLessThan(UMBRAL_PREGUNTA);
  });

  it('no ve parecido donde no lo hay', () => {
    expect(parecido('Juan Perez', 'Maria Gomez')).toBe(0);
  });

  it('dos personas con el mismo nombre de pila y distinto apellido NO se parecen', () => {
    // El defecto original: puntuaba solo por tokens compartidos, y en Colombia
    // los nombres compuestos son la norma. Con una lista real de contactos casi
    // todas las preguntas eran de esta forma — dos desconocidos que comparten
    // el nombre de pila.
    expect(parecido('Ana Maria Castro', 'Ana Maria Lopez')).toBeLessThan(UMBRAL_PREGUNTA);
    expect(parecido('Juan Carlos Perez', 'Juan Carlos Gomez')).toBeLessThan(UMBRAL_PREGUNTA);
    expect(parecido('Maria Fernanda Gomez', 'Maria Fernanda Rodriguez')).toBeLessThan(
      UMBRAL_PREGUNTA,
    );
  });

  it('un segundo nombre que se contradice también los separa', () => {
    // Mismo apellido y mismo primer nombre, pero "Alberto" no es "Miguel".
    expect(parecido('Luis Alberto Torres', 'Luis Miguel Torres')).toBeLessThan(UMBRAL_PREGUNTA);
    expect(parecido('Juan Carlos Perez', 'Juan Sebastian Perez')).toBeLessThan(UMBRAL_PREGUNTA);
  });

  it('un nombre más corto NO es una contradicción', () => {
    // "Juan Perez" puede ser perfectamente como el banco escribió a "Juan
    // Carlos Perez": falta un nombre, no se contradice ninguno.
    expect(parecido('Juan Perez', 'Juan Carlos Perez')).toBeGreaterThanOrEqual(UMBRAL_PREGUNTA);
    expect(parecido('Juan P', 'Juan Carlos Perez')).toBeGreaterThanOrEqual(UMBRAL_PREGUNTA);
  });

  it('no se deja llevar por un apellido común', () => {
    // Compartir solo el apellido no basta: media familia lo comparte.
    expect(parecido('Juan Gomez', 'Maria Gomez')).toBeLessThan(UMBRAL_PREGUNTA);
  });

  it('es simétrico', () => {
    expect(parecido('Juan Perez', 'Juan Carlos Perez')).toBe(
      parecido('Juan Carlos Perez', 'Juan Perez'),
    );
  });

  it('trata un nombre vacío como sin parecido', () => {
    expect(parecido('', 'Juan')).toBe(0);
    expect(parecido('...', 'Juan')).toBe(0);
  });
});

describe('partesDelLibro', () => {
  it('junta las grafías bajo una sola clave', () => {
    const partes = partesDelLibro([
      tx({ id: 'a', description: 'Envio con BRE-B a: JUAN PEREZ' }),
      tx({ id: 'b', description: 'Transferencia a Juan Pérez' }),
    ]);

    expect(partes).toHaveLength(1);
    expect(partes[0].movimientos).toBe(2);
  });

  it('ignora los movimientos que no nombran a nadie', () => {
    const partes = partesDelLibro([
      tx({ id: 'a', description: 'Compra paquete' }),
      tx({ id: 'b', description: 'Rendimientos financieros' }),
    ]);

    expect(partes).toEqual([]);
  });

  it('muestra la grafía más frecuente, no la primera que apareció', () => {
    const partes = partesDelLibro([
      tx({ id: 'a', description: 'Transferencia a Juan Pérez' }),
      tx({ id: 'b', description: 'Envio con BRE-B a: JUAN PEREZ' }),
      tx({ id: 'c', description: 'Envio con BRE-B a: JUAN PEREZ' }),
    ]);

    expect(partes[0].nombre).toBe('Juan Perez');
  });

  it('ordena por frecuencia', () => {
    const partes = partesDelLibro([
      tx({ id: 'a', description: 'Transferencia a Ana Gomez' }),
      tx({ id: 'b', description: 'Transferencia a Juan Perez' }),
      tx({ id: 'c', description: 'Transferencia a Juan Perez' }),
    ]);

    expect(partes.map((p) => p.movimientos)).toEqual([2, 1]);
  });

  it('guarda la fecha del movimiento más reciente', () => {
    const partes = partesDelLibro([
      tx({ id: 'a', occurredOn: '2026-07-01' }),
      tx({ id: 'b', occurredOn: '2026-08-09' }),
      tx({ id: 'c', occurredOn: '2026-08-02' }),
    ]);

    expect(partes[0].ultimaFecha).toBe('2026-08-09');
  });
});

describe('dudasDeUnion', () => {
  const partes = (...nombres: string[]) =>
    partesDelLibro(
      nombres.map((n, i) => tx({ id: `t${i}`, description: `Transferencia a ${n}` })),
    );

  it('pregunta por dos grafías que se parecen', () => {
    const dudas = dudasDeUnion(partes('Juan Perez', 'Juan Carlos Perez'), []);

    expect(dudas).toHaveLength(1);
    expect([dudas[0].a.nombre, dudas[0].b.nombre].sort()).toEqual([
      'Juan Carlos Perez',
      'Juan Perez',
    ]);
  });

  it('no pregunta por dos personas distintas', () => {
    expect(dudasDeUnion(partes('Juan Perez', 'Maria Gomez'), [])).toEqual([]);
  });

  it('no pregunta por lo que ya es un mismo contacto', () => {
    const dudas = dudasDeUnion(
      partes('Juan Perez', 'Juan Carlos Perez'),
      [contacto({ alias: ['juan perez', 'juan carlos perez'] })],
    );

    expect(dudas).toEqual([]);
  });

  it('NO vuelve a preguntar lo que ya se dijo que no', () => {
    // Sin esto, la misma tarjeta reaparece en cada recarga, que es la forma más
    // rápida de convertir una ayuda en una molestia.
    const dudas = dudasDeUnion(
      partes('Juan Perez', 'Juan Carlos Perez'),
      [contacto({ alias: ['juan perez'], separadoDe: ['juan carlos perez'] })],
    );

    expect(dudas).toEqual([]);
  });

  it('da la misma clave sin importar el orden del par', () => {
    const unaVia = dudasDeUnion(partes('Juan Perez', 'Juan Carlos Perez'), [])[0];
    const otraVia = dudasDeUnion(partes('Juan Carlos Perez', 'Juan Perez'), [])[0];

    expect(unaVia.clave).toBe(otraVia.clave);
  });

  it('pone primero la que más se parece', () => {
    const dudas = dudasDeUnion(partes('Juan Perez', 'Juan P', 'Juan Carlos Perez'), []);

    expect(dudas.length).toBeGreaterThan(1);
    for (let i = 1; i < dudas.length; i += 1) {
      expect(dudas[i - 1].parecido).toBeGreaterThanOrEqual(dudas[i].parecido);
    }
  });

  it('nunca pregunta por un par idéntico', () => {
    // Ya son la misma clave; no hay nada que decidir.
    expect(dudasDeUnion(partes('Juan Perez', 'JUAN PÉREZ'), [])).toEqual([]);
  });

  it('no se pregunta a sí misma', () => {
    expect(dudasDeUnion(partes('Juan Perez'), [])).toEqual([]);
  });
});

describe('movimientosDeContacto', () => {
  it('trae todas las grafías del contacto', () => {
    const movimientos = movimientosDeContacto(
      [
        tx({ id: 'a', description: 'Envio con BRE-B a: JUAN PEREZ' }),
        tx({ id: 'b', description: 'Transferencia a Juan Carlos Perez' }),
        tx({ id: 'c', description: 'Transferencia a Maria Gomez' }),
      ],
      contacto({ alias: ['juan perez', 'juan carlos perez'] }),
    );

    expect(movimientos.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('los ordena del más reciente al más viejo', () => {
    const movimientos = movimientosDeContacto(
      [
        tx({ id: 'viejo', occurredOn: '2026-07-01' }),
        tx({ id: 'nuevo', occurredOn: '2026-08-09' }),
      ],
      contacto(),
    );

    expect(movimientos.map((m) => m.id)).toEqual(['nuevo', 'viejo']);
  });
});

describe('movimientosDeAlias y balance', () => {
  const LIBRO = [
    tx({ id: 'a', description: 'Envio con BRE-B a: JUAN PEREZ', amountCop: 50_000 }),
    tx({ id: 'b', description: 'Transferencia a Juan Carlos Perez', amountCop: 30_000 }),
    tx({ id: 'c', kind: 'ingreso', description: 'Pago recibido de Juan Perez', amountCop: 200_000 }),
    tx({ id: 'd', description: 'Transferencia a Maria Gomez', amountCop: 10_000 }),
  ];

  it('funciona sin que el contacto esté guardado', () => {
    // La mayoría de las filas de la lista son contrapartes sueltas: exigir una
    // unión previa dejaría el detalle solo para las pocas ya juntadas.
    const movs = movimientosDeAlias(LIBRO, ['juan perez']);

    expect(movs.map((m) => m.id).sort()).toEqual(['a', 'c']);
  });

  it('junta todas las grafías que se le pasen', () => {
    const movs = movimientosDeAlias(LIBRO, ['juan perez', 'juan carlos perez']);

    expect(movs.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('separa lo que le mandaste de lo que te mandó', () => {
    const b = balanceConAlias(LIBRO, ['juan perez', 'juan carlos perez']);

    expect(b.salioCop).toBe(80_000);
    expect(b.entroCop).toBe(200_000);
    expect(b.netoCop).toBe(120_000);
  });

  it('el neto es negativo cuando le has mandado más', () => {
    const b = balanceConAlias(LIBRO, ['maria gomez']);

    expect(b.netoCop).toBe(-10_000);
  });

  it('con alguien sin movimientos da ceros, no NaN', () => {
    expect(balanceConAlias(LIBRO, ['nadie'])).toEqual({
      salioCop: 0,
      entroCop: 0,
      netoCop: 0,
    });
  });
});
