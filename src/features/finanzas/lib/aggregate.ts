import type { CategoriaClave, Transaction, TxKind } from '../types';
import { monthKey } from './localDate';

export interface CategorySlice {
  category: CategoriaClave;
  total: number;
  /** Share of the kind's total, 0..100, rounded to one decimal. */
  pct: number;
}

export interface MonthTotals {
  ingresos: number;
  gastos: number;
  balance: number;
  /** (ingresos - gastos) / ingresos as 0..100, or null when there was no income. */
  tasaAhorro: number | null;
}

/** Transactions belonging to one 'YYYY-MM' month. */
export const forMonth = (
  transactions: readonly Transaction[],
  month: string,
): Transaction[] => transactions.filter((tx) => monthKey(tx.occurredOn) === month);

export const monthTotals = (transactions: readonly Transaction[]): MonthTotals => {
  let ingresos = 0;
  let gastos = 0;

  for (const tx of transactions) {
    if (tx.kind === 'ingreso') ingresos += tx.amountCop;
    else gastos += tx.amountCop;
  }

  return {
    ingresos,
    gastos,
    balance: ingresos - gastos,
    // Undefined rather than 0 when there is no income: a 0% savings rate and
    // "no income recorded yet" are different facts and must not look the same.
    tasaAhorro: ingresos > 0 ? Math.round(((ingresos - gastos) / ingresos) * 1000) / 10 : null,
  };
};

/**
 * Per-category totals for one direction, largest first.
 *
 * Percentages are of that direction's own total, so a breakdown of expenses
 * sums to 100% of expenses — never of the net balance, which would let a
 * category exceed 100% whenever spending outran income.
 */
export const byCategory = (
  transactions: readonly Transaction[],
  kind: TxKind,
): CategorySlice[] => {
  const totals = new Map<CategoriaClave, number>();

  for (const tx of transactions) {
    if (tx.kind !== kind) continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amountCop);
  }

  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (grand === 0) return [];

  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      pct: Math.round((total / grand) * 1000) / 10,
    }))
    .sort((a, b) => (b.total !== a.total ? b.total - a.total : a.category.localeCompare(b.category)));
};

/** Every 'YYYY-MM' present in the data, newest first. */
export const monthsPresent = (transactions: readonly Transaction[]): string[] =>
  [...new Set(transactions.map((tx) => monthKey(tx.occurredOn)))].sort((a, b) =>
    a < b ? 1 : -1,
  );
