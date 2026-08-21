import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { resumenDelMes, textoParaCompartir } from './resumenMes';
import type { TarjetaResumen } from './resumenMes';

const nombreDe = (c: string): string => c.charAt(0).toUpperCase() + c.slice(1);

let seq = 0;
const tx = (over: Partial<Transaction> = {}): Transaction => {
  seq += 1;
  return {
    id: `t-${seq}`,
    kind: 'gasto',
    amountCop: 20_000,
    category: 'mercado',
    description: 'algo',
    occurredOn: '2026-08-10',
    cuentaId: null,
    rawTranscript: '',
    createdAt: '2026-08-10T00:00:00.000Z',
    ...over,
  };
};

const tipos = (r: readonly TarjetaResumen[]): string[] => r.map((t) => t.tipo);
const buscar = <T extends TarjetaResumen['tipo']>(
  r: readonly TarjetaResumen[],
  tipo: T,
): Extract<TarjetaResumen, { tipo: T }> | undefined =>
  r.find((t): t is Extract<TarjetaResumen, { tipo: T }> => t.tipo === tipo);

describe('resumenDelMes — siempre hay portada, balance y cierre', () => {
  it('sin ninguna transacción, el resumen no se queda vacío', () => {
    const r = resumenDelMes([], '2026-08', '2026-08-15');
    expect(tipos(r)).toEqual(['portada', 'balance', 'diasActivos', 'racha', 'cierre']);
  });

  it('la portada lleva el mes pedido', () => {
    const r = resumenDelMes([], '2026-08', '2026-08-15');
    expect(buscar(r, 'portada')).toEqual({ tipo: 'portada', mes: '2026-08' });
  });

  it('un mes sin movimientos cierra con tono neutral y su frase propia', () => {
    const r = resumenDelMes([], '2026-08', '2026-08-15');
    expect(buscar(r, 'cierre')).toMatchObject({
      tono: 'neutral',
      frase: 'Un mes sin movimientos registrados todavía.',
    });
  });
});

describe('resumenDelMes — categoría estrella', () => {
  it('aparece solo cuando hubo gasto, y es la de mayor total', () => {
    const txs = [
      tx({ category: 'mercado', amountCop: 100_000 }),
      tx({ category: 'comida', amountCop: 300_000 }),
      tx({ category: 'comida', amountCop: 50_000 }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'categoriaEstrella')?.slice.category).toBe('comida');
    expect(buscar(r, 'categoriaEstrella')?.slice.total).toBe(350_000);
  });

  it('no aparece si el mes solo tuvo ingresos', () => {
    const txs = [tx({ kind: 'ingreso', category: 'ingreso', amountCop: 500_000 })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'categoriaEstrella')).toBeUndefined();
  });
});

describe('resumenDelMes — cambio de categoría vs el mes anterior', () => {
  it('reporta la que más subió y la que más bajó', () => {
    const txs = [
      tx({ category: 'comida', amountCop: 100_000, occurredOn: '2026-07-05' }),
      tx({ category: 'mercado', amountCop: 80_000, occurredOn: '2026-07-05' }),
      tx({ category: 'comida', amountCop: 150_000, occurredOn: '2026-08-05' }),
      // mercado desaparece del todo en agosto: bajada de 80.000 a 0.
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    const c = buscar(r, 'cambioCategoria');
    expect(c?.subida).toMatchObject({ category: 'comida', deltaCop: 50_000 });
    expect(c?.bajada).toMatchObject({ category: 'mercado', deltaCop: -80_000 });
  });

  it('no aparece si el mes anterior no tiene ni un movimiento', () => {
    const txs = [tx({ category: 'comida', amountCop: 150_000, occurredOn: '2026-08-05' })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'cambioCategoria')).toBeUndefined();
  });

  it('no aparece si nada cambió entre los dos meses', () => {
    const txs = [
      tx({ category: 'comida', amountCop: 100_000, occurredOn: '2026-07-05' }),
      tx({ category: 'comida', amountCop: 100_000, occurredOn: '2026-08-05' }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'cambioCategoria')).toBeUndefined();
  });

  it('una categoría nueva este mes cuenta como subida, sin bajada que reportar', () => {
    const txs = [
      tx({ category: 'comida', amountCop: 100_000, occurredOn: '2026-07-05' }),
      tx({ category: 'comida', amountCop: 100_000, occurredOn: '2026-08-05' }),
      tx({ category: 'ropa', amountCop: 60_000, occurredOn: '2026-08-05' }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    const c = buscar(r, 'cambioCategoria');
    expect(c?.subida).toMatchObject({ category: 'ropa', deltaCop: 60_000, deltaPct: null });
    expect(c?.bajada).toBeNull();
  });
});

describe('resumenDelMes — el gasto más caro', () => {
  it('encuentra el movimiento de mayor monto del mes', () => {
    const txs = [
      tx({ amountCop: 20_000, description: 'mercado chico' }),
      tx({ amountCop: 800_000, description: 'la nevera' }),
      tx({ amountCop: 15_000, description: 'cafe' }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'gastoMasCaro')?.tx.description).toBe('la nevera');
  });

  it('en un empate, se queda con el primero de la lista', () => {
    const primero = tx({ amountCop: 500_000, description: 'primero' });
    const segundo = tx({ amountCop: 500_000, description: 'segundo' });
    const r = resumenDelMes([primero, segundo], '2026-08', '2026-08-15');
    expect(buscar(r, 'gastoMasCaro')?.tx.description).toBe('primero');
  });

  it('no aparece si el mes no tuvo ni un gasto', () => {
    const txs = [tx({ kind: 'ingreso', category: 'ingreso', amountCop: 500_000 })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'gastoMasCaro')).toBeUndefined();
  });
});

describe('resumenDelMes — días activos y racha sin gastar', () => {
  it('cuenta los días distintos con algún movimiento, gasto o ingreso', () => {
    const txs = [
      tx({ occurredOn: '2026-08-01' }),
      tx({ occurredOn: '2026-08-01' }), // mismo día, no debe contar dos veces
      tx({ occurredOn: '2026-08-03', kind: 'ingreso', category: 'ingreso' }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-05');
    expect(buscar(r, 'diasActivos')).toEqual({ tipo: 'diasActivos', activos: 2, totalDias: 5 });
  });

  it('la racha más larga es la corrida de días sin gasto, no el total de días sin gasto', () => {
    // Gasto el 1, 2 y 3; nada el 4 al 10 (siete días seguidos).
    const txs = [1, 2, 3].map((d) => tx({ occurredOn: `2026-08-0${d}` }));
    const r = resumenDelMes(txs, '2026-08', '2026-08-10');
    expect(buscar(r, 'racha')).toEqual({ tipo: 'racha', dias: 7 });
  });

  it('encuentra la racha más larga aunque no sea la última del mes', () => {
    // Gasto el 1; nada el 2-5 (cuatro días); gasto el 6; nada el 7-8 (dos días).
    const txs = [tx({ occurredOn: '2026-08-01' }), tx({ occurredOn: '2026-08-06' })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-08');
    expect(buscar(r, 'racha')).toEqual({ tipo: 'racha', dias: 4 });
  });

  it('sin ningún gasto en el mes, la racha es todos los días transcurridos', () => {
    const r = resumenDelMes([], '2026-08', '2026-08-07');
    expect(buscar(r, 'racha')).toEqual({ tipo: 'racha', dias: 7 });
  });

  it('en un mes ya cerrado cuenta el mes completo, no solo hasta hoy', () => {
    const r = resumenDelMes([], '2026-07', '2026-08-15');
    expect(buscar(r, 'diasActivos')?.totalDias).toBe(31);
  });

  it('en un mes futuro no hay ni actividad ni racha que contar', () => {
    const r = resumenDelMes([], '2026-09', '2026-08-15');
    expect(buscar(r, 'diasActivos')).toBeUndefined();
    expect(buscar(r, 'racha')).toBeUndefined();
  });
});

describe('resumenDelMes — comparado con el promedio', () => {
  it('aparece y calcula el delta cuando hay meses previos con gasto', () => {
    const txs = [
      tx({ occurredOn: '2026-07-10', amountCop: 100_000 }),
      tx({ occurredOn: '2026-08-10', amountCop: 150_000 }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'comparadoConPromedio')).toEqual({
      tipo: 'comparadoConPromedio',
      gastosMesCop: 150_000,
      promedioCop: 100_000,
      deltaPct: 50,
      meses: 1,
    });
  });

  it('no aparece si nunca hubo actividad antes de este mes', () => {
    const txs = [tx({ occurredOn: '2026-08-10', amountCop: 150_000 })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'comparadoConPromedio')).toBeUndefined();
  });

  it('no aparece si los meses previos solo tuvieron ingresos, nunca gasto', () => {
    const txs = [
      tx({ occurredOn: '2026-07-10', kind: 'ingreso', category: 'ingreso', amountCop: 1_000_000 }),
      tx({ occurredOn: '2026-08-10', amountCop: 150_000 }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'comparadoConPromedio')).toBeUndefined();
  });
});

describe('resumenDelMes — el cierre', () => {
  it('tono "bien" cuando la tasa de ahorro alcanza el 20%', () => {
    const txs = [
      tx({ kind: 'ingreso', category: 'ingreso', amountCop: 100_000 }),
      tx({ amountCop: 80_000 }), // tasa de ahorro exacta: 20%
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'cierre')?.tono).toBe('bien');
  });

  it('tono "atento" cuando el balance es negativo', () => {
    const txs = [
      tx({ kind: 'ingreso', category: 'ingreso', amountCop: 100_000 }),
      tx({ amountCop: 150_000 }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'cierre')?.tono).toBe('atento');
  });

  it('tono "atento" incluso sin ingresos registrados, si hubo gasto', () => {
    // Sin ingresos, tasaAhorro es null (no 0), así que la señal es el balance.
    const txs = [tx({ amountCop: 50_000 })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'cierre')?.tono).toBe('atento');
  });

  it('tono "neutral" con balance positivo pero ahorro bajo', () => {
    const txs = [
      tx({ kind: 'ingreso', category: 'ingreso', amountCop: 100_000 }),
      tx({ amountCop: 95_000 }), // tasa de ahorro: 5%
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(buscar(r, 'cierre')?.tono).toBe('neutral');
    expect(buscar(r, 'cierre')?.frase).toBe('Otro mes más en el libro.');
  });
});

describe('resumenDelMes — orden de las tarjetas', () => {
  it('con todo presente, van en el mismo orden siempre: portada y cierre en las puntas', () => {
    const txs = [
      tx({ category: 'comida', amountCop: 100_000, occurredOn: '2026-07-05' }),
      tx({ category: 'comida', amountCop: 150_000, occurredOn: '2026-08-05' }),
      tx({ category: 'mercado', amountCop: 800_000, occurredOn: '2026-08-06' }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-15');
    expect(tipos(r)[0]).toBe('portada');
    expect(tipos(r)[tipos(r).length - 1]).toBe('cierre');
    expect(tipos(r)).toEqual([
      'portada',
      'balance',
      'categoriaEstrella',
      'cambioCategoria',
      'gastoMasCaro',
      'diasActivos',
      'racha',
      'comparadoConPromedio',
      'cierre',
    ]);
  });
});

describe('textoParaCompartir', () => {
  it('arma un párrafo con el mes, el balance, la categoría estrella y la racha', () => {
    const txs = [
      tx({ category: 'comida', amountCop: 300_000, occurredOn: '2026-08-01' }),
      tx({ kind: 'ingreso', category: 'ingreso', amountCop: 500_000, occurredOn: '2026-08-01' }),
    ];
    const r = resumenDelMes(txs, '2026-08', '2026-08-03');
    const texto = textoParaCompartir(r, nombreDe);

    expect(texto).toContain('agosto 2026');
    expect(texto).toContain('Balance: $200.000');
    expect(texto).toContain('Categoría estrella: Comida ($300.000)');
  });

  it('usa el singular cuando la racha es de un solo día', () => {
    const txs = [tx({ occurredOn: '2026-08-01' })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-02');
    expect(textoParaCompartir(r, nombreDe)).toContain('1 día seguido sin gastar');
  });

  it('usa el plural cuando la racha es de más de un día', () => {
    const r = resumenDelMes([], '2026-08', '2026-08-05');
    expect(textoParaCompartir(r, nombreDe)).toContain('5 días seguidos sin gastar');
  });

  it('no menciona la racha si fue de cero días', () => {
    // Gasto todos los días transcurridos: la racha más larga es 0.
    const txs = [tx({ occurredOn: '2026-08-01' }), tx({ occurredOn: '2026-08-02' })];
    const r = resumenDelMes(txs, '2026-08', '2026-08-02');
    expect(textoParaCompartir(r, nombreDe)).not.toContain('sin gastar');
  });

  it('no revienta si el mes no tiene ni una transacción', () => {
    const r = resumenDelMes([], '2026-08', '2026-08-15');
    expect(() => textoParaCompartir(r, nombreDe)).not.toThrow();
    expect(textoParaCompartir(r, nombreDe)).toContain('agosto 2026');
  });
});
