import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { responderAsesor, type AsesorContext } from './asesorBot';
import { LEXICO_VACIO } from './aprendizaje';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import type { CategoriaPersonal } from '../categorias';

// El bot lee `new Date()` directo (sin reloj inyectable), así que fijar el
// reloj es la única forma de probar de manera determinista todo lo que
// depende del mes actual, "mes pasado", o el día del mes (la proyección de
// gasto solo aparece a partir del día 4).
const HOY = new Date('2026-08-20T15:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});

afterEach(() => {
  vi.useRealTimers();
});

const CTX_VACIO: AsesorContext = { ultimoAsunto: null, ultimaFecha: null };

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t-${Math.random()}`,
  kind: 'gasto',
  amountCop: 10_000,
  category: 'comida',
  description: 'x',
  occurredOn: '2026-08-15',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...over,
});

const cajita = (over: Partial<Cajita> = {}): Cajita => ({
  id: `c-${Math.random()}`,
  nombre: 'Nequi',
  icon: 'Wallet',
  tipo: 'cuenta',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const preguntar = (
  texto: string,
  opts: {
    transacciones?: readonly Transaction[];
    cajitas?: readonly Cajita[];
    balances?: Record<string, number>;
    categorias?: readonly CategoriaPersonal[];
    context?: AsesorContext;
  } = {},
) =>
  responderAsesor(
    texto,
    opts.transacciones ?? [],
    opts.cajitas ?? [],
    opts.balances ?? {},
    opts.categorias ?? [],
    LEXICO_VACIO,
    opts.context ?? CTX_VACIO,
  );

describe('responderAsesor — resumen del mes', () => {
  it('suma ingresos y gastos solo del mes actual (fijado en agosto 2026)', () => {
    const transacciones = [
      tx({ kind: 'ingreso', amountCop: 1_000_000, occurredOn: '2026-08-05' }),
      tx({ kind: 'gasto', amountCop: 200_000, occurredOn: '2026-08-10', category: 'comida' }),
      // Julio: no debe contar.
      tx({ kind: 'gasto', amountCop: 999_999, occurredOn: '2026-07-15' }),
    ];
    const r = preguntar('resumen del mes', { transacciones });
    expect(r.text).toContain('1.000.000');
    expect(r.text).toContain('200.000');
    expect(r.text).not.toContain('999.999');
  });

  it('señala la categoría con más gasto del mes como "agujero negro"', () => {
    const transacciones = [
      tx({ amountCop: 300_000, category: 'comida', occurredOn: '2026-08-05' }),
      tx({ amountCop: 50_000, category: 'transporte', occurredOn: '2026-08-06' }),
    ];
    const r = preguntar('como voy este mes', { transacciones });
    expect(r.text).toContain('comida');
  });

  it('sin movimientos este mes, no dice que hay déficit', () => {
    const r = preguntar('dame mi resumen', {});
    expect(r.text).toMatch(/no has registrado movimientos/i);
  });

  it('alerta cuando los gastos superan los ingresos', () => {
    const transacciones = [
      tx({ kind: 'ingreso', amountCop: 100_000, occurredOn: '2026-08-05' }),
      tx({ kind: 'gasto', amountCop: 500_000, occurredOn: '2026-08-10' }),
    ];
    const r = preguntar('resumen', { transacciones });
    expect(r.text).toMatch(/alerta roja|gastando más/i);
  });
});

describe('responderAsesor — saldos', () => {
  it('suma cuentas y cajitas por separado', () => {
    const cajitas = [
      cajita({ id: 'cta-1', tipo: 'cuenta' }),
      cajita({ id: 'caj-1', tipo: 'cajita', nombre: 'Vacaciones' }),
    ];
    const r = preguntar('cuanto tengo', {
      cajitas,
      balances: { 'cta-1': 500_000, 'caj-1': 300_000 },
    });
    expect(r.text).toContain('500.000');
    expect(r.text).toContain('300.000');
  });

  it('responde el saldo de una cuenta específica cuando la nombra', () => {
    const cajitas = [cajita({ id: 'cta-1', nombre: 'Bancolombia' })];
    const r = preguntar('cuanto tengo en bancolombia', {
      cajitas,
      balances: { 'cta-1': 250_000 },
    });
    expect(r.text).toContain('250.000');
    expect(r.text).toContain('Bancolombia');
  });

  it('no confunde "cuánto gasté" con una pregunta de saldo', () => {
    // Ambas contienen 'cuanto', pero preguntan cosas distintas: una por lo que
    // hay, otra por lo que salió. Si el router las mezclara, "cuánto he
    // gastado" respondería con el saldo de las cuentas en vez del gasto real.
    const cajitas = [cajita({ id: 'cta-1' })];
    const r = preguntar('cuanto he gastado', {
      cajitas,
      balances: { 'cta-1': 999_999 },
    });
    expect(r.text).not.toContain('999.999');
  });
});

describe('responderAsesor — 4x1000', () => {
  it('avisa del cupo exento cuando hay una cuenta de bajo monto', () => {
    const cajitas = [cajita({ nombre: 'Nequi', esBajoMonto: true })];
    const r = preguntar('cuanto es el 4x1000', { cajitas });
    expect(r.text).toContain('Nequi');
    expect(r.text).toMatch(/exen/i);
  });

  it('sugiere marcar una cuenta de bajo monto si ninguna lo está', () => {
    const r = preguntar('que es el gmf', { cajitas: [cajita({ esBajoMonto: false })] });
    expect(r.text).toMatch(/bajo monto/i);
  });
});

describe('responderAsesor — presupuesto diario sugerido', () => {
  it('reparte el saldo entre los días que quedan del mes', () => {
    // Reloj fijo en 2026-08-20: agosto tiene 31 días, quedan 12 (20..31).
    const cajitas = [cajita({ id: 'cta-1' })];
    const r = preguntar('cuanto puedo gastar', { cajitas, balances: { 'cta-1': 1_200_000 } });
    expect(r.text).toContain('12 días');
    expect(r.text).toContain('100.000'); // 1.200.000 / 12
  });

  it('sin saldo en cuentas, lo dice en vez de calcular un presupuesto de 0', () => {
    const r = preguntar('cual es mi presupuesto', { cajitas: [cajita({ id: 'cta-1' })], balances: {} });
    expect(r.text).toMatch(/no tienes saldo/i);
  });
});

describe('responderAsesor — gastos recurrentes', () => {
  it('detecta una descripción que se repite al menos dos veces', () => {
    const transacciones = [
      tx({ description: 'Netflix', amountCop: 30_000, occurredOn: '2026-07-01' }),
      tx({ description: 'Netflix', amountCop: 30_000, occurredOn: '2026-08-01' }),
    ];
    const r = preguntar('mis suscripciones', { transacciones });
    // La agrupación normaliza la descripción a minúsculas antes de compararla.
    expect(r.text).toContain('netflix');
    expect(r.text).toContain('1 gastos recurrentes');
  });

  it('una descripción que solo aparece una vez no cuenta como recurrente', () => {
    const transacciones = [tx({ description: 'Netflix', occurredOn: '2026-08-01' })];
    const r = preguntar('gastos fijos', { transacciones });
    expect(r.text).toMatch(/no he detectado/i);
  });
});

describe('responderAsesor — detectar y proponer un movimiento', () => {
  it('propone registrar un gasto dictado, con el monto y la categoría correctos', () => {
    const r = preguntar('gaste 20 mil en comida');
    expect(r.action).toBeTruthy();
    expect(r.action!.amount).toBe(20_000);
    expect(r.action!.kind).toBe('gasto');
    expect(r.text).toContain('20.000');
  });

  it('nunca guarda solo: siempre pide confirmación antes de registrar', () => {
    const r = preguntar('gaste 20 mil en comida');
    expect(r.text).toMatch(/quieres que lo registre/i);
  });

  it('pide el monto si falta, en vez de inventar un registro', () => {
    const r = preguntar('gaste en el mercado');
    expect(r.action).toBeUndefined();
    expect(r.text).toMatch(/cuánto fue el monto/i);
  });

  it('detecta varias transacciones en una sola frase', () => {
    const r = preguntar('gaste 50 mil en comida y 20 mil en transporte');
    expect(r.actions).toBeTruthy();
    expect(r.actions!.length).toBe(2);
    expect(r.actions!.some((a) => a.amount === 50_000)).toBe(true);
    expect(r.actions!.some((a) => a.amount === 20_000)).toBe(true);
  });

  it('avisa si el gasto va a superar el promedio mensual habitual de la categoría', () => {
    // Dos meses previos gastando ~50 mil en comida; ahora un gasto de 100 mil
    // que dispara claramente el promedio.
    const transacciones = [
      tx({ category: 'comida', amountCop: 50_000, occurredOn: '2026-06-10' }),
      tx({ category: 'comida', amountCop: 50_000, occurredOn: '2026-07-10' }),
      tx({ category: 'comida', amountCop: 50_000, occurredOn: '2026-06-20' }),
    ];
    const r = preguntar('gaste 100 mil en comida', { transacciones });
    expect(r.text).toMatch(/alerta|ojo ahí/i);
  });
});

describe('responderAsesor — memoria de corrección', () => {
  it('"fueron X" corrige el monto usando la categoría de la conversación', () => {
    const r = preguntar('fueron 30 mil', {
      context: { ultimoAsunto: 'transporte', ultimaFecha: null },
    });
    expect(r.action).toBeTruthy();
    expect(r.action!.amount).toBe(30_000);
    expect(r.action!.category).toBe('transporte');
  });
});

describe('responderAsesor — preguntas de gastos por fecha', () => {
  it('filtra por "ayer" cuando el parser reconoce esa fecha', () => {
    const transacciones = [
      tx({ amountCop: 15_000, occurredOn: '2026-08-19' }), // ayer
      tx({ amountCop: 999_000, occurredOn: '2026-08-01' }), // no es ayer
    ];
    const r = preguntar('cuanto gaste ayer', { transacciones });
    expect(r.text).toContain('15.000');
    expect(r.text).not.toContain('999.000');
  });

  it('filtra por "mes pasado"', () => {
    const transacciones = [
      tx({ amountCop: 40_000, occurredOn: '2026-07-10' }),
      tx({ amountCop: 999_000, occurredOn: '2026-08-10' }),
    ];
    const r = preguntar('cuanto gaste el mes pasado', { transacciones });
    expect(r.text).toContain('40.000');
    expect(r.text).not.toContain('999.000');
  });

  it('sin movimientos en el filtro, dice cero en vez de nada', () => {
    const r = preguntar('cuanto he gastado en comida', { transacciones: [] });
    expect(r.text).toBeTruthy();
  });
});

describe('responderAsesor — enrutador de preguntas múltiples ("y")', () => {
  it('combina dos preguntas separadas por "y" en una sola respuesta', () => {
    const transacciones = [tx({ category: 'comida', amountCop: 20_000, occurredOn: '2026-08-10' })];
    const r = preguntar('cuanto tengo en cuentas y cuanto gaste en comida', {
      transacciones,
      cajitas: [cajita({ id: 'cta-1' })],
      balances: { 'cta-1': 100_000 },
    });
    expect(r.text).toContain('100.000');
    expect(r.text).toContain('20.000');
  });
});

describe('responderAsesor — saludos y charla', () => {
  it('responde algo a un saludo', () => {
    const r = preguntar('hola');
    expect(r.text.length).toBeGreaterThan(0);
  });

  it('responde a una pregunta de identidad', () => {
    const r = preguntar('quien eres');
    expect(r.text).toMatch(/asesor|reglas|offline/i);
  });

  it('cae en una respuesta de charla para algo que no reconoce como finanzas', () => {
    const r = preguntar('jajaja que buena');
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.action).toBeUndefined();
  });

  it('el fallback final nunca deja la respuesta vacía', () => {
    const r = preguntar('asdkjaslkdjaslkdj');
    expect(r.text.length).toBeGreaterThan(0);
  });
});
