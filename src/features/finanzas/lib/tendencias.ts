import type { CategoriaClave, Transaction, TxKind } from '../types';
import { forMonth, monthTotals } from './aggregate';
import { shiftMonth } from './localDate';

export interface PuntoMensual {
  /** 'YYYY-MM'. */
  month: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

/** The `cuantos` months ending at `hasta`, oldest first. */
export const ultimosMeses = (hasta: string, cuantos: number): string[] =>
  Array.from({ length: cuantos }, (_, i) => shiftMonth(hasta, i - (cuantos - 1)));

/**
 * A point per month, including months with no activity.
 *
 * The gaps matter: a line that silently skips empty months compresses time and
 * makes a two-month spending break look like a single steady stretch.
 */
export const serieMensual = (
  transacciones: readonly Transaction[],
  meses: readonly string[],
): PuntoMensual[] =>
  meses.map((month) => {
    const totales = monthTotals(forMonth(transacciones, month));
    return {
      month,
      ingresos: totales.ingresos,
      gastos: totales.gastos,
      balance: totales.balance,
    };
  });

export interface CambioCategoria {
  category: CategoriaClave;
  actualCop: number;
  anteriorCop: number;
  deltaCop: number;
  /**
   * Percentage change, or null when there is nothing to compare against —
   * spending that went from 0 to anything is not "infinite growth", it is new,
   * and the UI has to say so in words rather than print a meaningless number.
   */
  deltaPct: number | null;
}

const totalPorCategoria = (
  transacciones: readonly Transaction[],
  kind: TxKind,
): Map<CategoriaClave, number> => {
  const totales = new Map<CategoriaClave, number>();
  for (const tx of transacciones) {
    if (tx.kind !== kind) continue;
    totales.set(tx.category, (totales.get(tx.category) ?? 0) + tx.amountCop);
  }
  return totales;
};

/**
 * Category-by-category change between two months, biggest increase first.
 *
 * Categories present in either month appear, so one that dropped to zero is
 * still reported — a disappeared expense is exactly as interesting as a new one.
 */
export const compararCategorias = (
  transacciones: readonly Transaction[],
  mesActual: string,
  mesAnterior: string,
  kind: TxKind = 'gasto',
): CambioCategoria[] => {
  const actual = totalPorCategoria(forMonth(transacciones, mesActual), kind);
  const anterior = totalPorCategoria(forMonth(transacciones, mesAnterior), kind);

  const categorias = new Set<CategoriaClave>([...actual.keys(), ...anterior.keys()]);

  return [...categorias]
    .map((category) => {
      const actualCop = actual.get(category) ?? 0;
      const anteriorCop = anterior.get(category) ?? 0;
      return {
        category,
        actualCop,
        anteriorCop,
        deltaCop: actualCop - anteriorCop,
        deltaPct:
          anteriorCop > 0
            ? Math.round(((actualCop - anteriorCop) / anteriorCop) * 1000) / 10
            : null,
      };
    })
    .sort((a, b) => b.deltaCop - a.deltaCop);
};

export interface PromedioMensual {
  ingresos: number;
  gastos: number;
  balance: number;
  /** Months actually counted. */
  meses: number;
}

/**
 * Averages across the months that had any activity.
 *
 * Empty months are excluded on purpose: they usually mean "not recorded yet",
 * not "spent nothing", and averaging them in drags every figure toward zero
 * right when the user has the least data to notice it.
 */
export const promedioMensual = (serie: readonly PuntoMensual[]): PromedioMensual => {
  const conDatos = serie.filter((p) => p.ingresos > 0 || p.gastos > 0);
  if (conDatos.length === 0) return { ingresos: 0, gastos: 0, balance: 0, meses: 0 };

  const suma = conDatos.reduce(
    (acc, p) => ({
      ingresos: acc.ingresos + p.ingresos,
      gastos: acc.gastos + p.gastos,
      balance: acc.balance + p.balance,
    }),
    { ingresos: 0, gastos: 0, balance: 0 },
  );

  return {
    ingresos: Math.round(suma.ingresos / conDatos.length),
    gastos: Math.round(suma.gastos / conDatos.length),
    balance: Math.round(suma.balance / conDatos.length),
    meses: conDatos.length,
  };
};
