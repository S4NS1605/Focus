import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, CajitaTipo } from '../data/modelos';
import { ES_PASIVO } from '../data/modelos';

/**
 * A pocket's balance is always the sum of its movements — never a stored number.
 *
 * That is what makes "just tell it how much you have" safe: setting a balance
 * records the delta needed to reach it, so the history and the balance can never
 * disagree, and every past figure stays reconstructable.
 */
export const saldosPorCajita = (
  movimientos: readonly CajitaMovimiento[],
  /**
   * Ledger entries attributed to an account. Optional so every caller that does
   * not care about attribution keeps working unchanged.
   */
  transacciones: readonly Transaction[] = [],
): Map<string, number> => {
  const saldos = new Map<string, number>();
  for (const mov of movimientos) {
    saldos.set(mov.cajitaId, (saldos.get(mov.cajitaId) ?? 0) + mov.deltaCop);
  }
  // Income raises the account it landed in, spending lowers the one it left.
  // This is what stops a balance going stale the moment something is recorded.
  for (const tx of transacciones) {
    if (!tx.cuentaId) continue;
    const delta = tx.kind === 'ingreso' ? tx.amountCop : -tx.amountCop;
    saldos.set(tx.cuentaId, (saldos.get(tx.cuentaId) ?? 0) + delta);
  }
  return saldos;
};

export const saldoDeCajita = (
  movimientos: readonly CajitaMovimiento[],
  cajitaId: string,
  transacciones: readonly Transaction[] = [],
): number =>
  movimientos.reduce((total, mov) => (mov.cajitaId === cajitaId ? total + mov.deltaCop : total), 0) +
  transacciones.reduce(
    (total, tx) =>
      tx.cuentaId === cajitaId
        ? total + (tx.kind === 'ingreso' ? tx.amountCop : -tx.amountCop)
        : total,
    0,
  );

/** The delta that turns `saldoActual` into `saldoObjetivo`. */
export const ajusteHacia = (saldoActual: number, saldoObjetivo: number): number =>
  saldoObjetivo - saldoActual;

export interface FilaHistorial {
  movimiento: CajitaMovimiento;
  /** Balance immediately after this movement. */
  saldoDespues: number;
}

/**
 * One pocket's history, newest first, each row carrying the balance as it stood
 * right after that movement.
 *
 * The running total is accumulated oldest-first and only then reversed —
 * computing it in display order would make every row show the balance *before*
 * itself.
 */
export const historialDeCajita = (
  movimientos: readonly CajitaMovimiento[],
  cajitaId: string,
): FilaHistorial[] => {
  const propios = movimientos
    .filter((m) => m.cajitaId === cajitaId)
    // `createdAt` breaks ties within a day, so two movements on the same date
    // accumulate in the order they were actually entered.
    .sort((a, b) =>
      a.occurredOn !== b.occurredOn
        ? a.occurredOn.localeCompare(b.occurredOn)
        : a.createdAt.localeCompare(b.createdAt),
    );

  let corriendo = 0;
  const filas = propios.map((movimiento) => {
    corriendo += movimiento.deltaCop;
    return { movimiento, saldoDespues: corriendo };
  });

  return filas.reverse();
};

/** Total across live pockets. Archived ones keep their history but leave the total. */
export const totalEnCajitas = (
  cajitas: readonly Cajita[],
  movimientos: readonly CajitaMovimiento[],
  transacciones: readonly Transaction[] = [],
): number => {
  const saldos = saldosPorCajita(movimientos, transacciones);
  return cajitas
    .filter((c) => c.archivedAt === null)
    .reduce((total, c) => total + (saldos.get(c.id) ?? 0), 0);
};

export interface ResumenCajita {
  cajita: Cajita;
  saldoCop: number;
  /** Progress toward this pocket's own target, 0..100, or null when it has none. */
  pct: number | null;
}

export const resumenDeCajitas = (
  cajitas: readonly Cajita[],
  movimientos: readonly CajitaMovimiento[],
  transacciones: readonly Transaction[] = [],
): ResumenCajita[] => {
  const saldos = saldosPorCajita(movimientos, transacciones);

  return cajitas
    .filter((c) => c.archivedAt === null)
    .map((cajita) => {
      const saldoCop = saldos.get(cajita.id) ?? 0;
      return {
        cajita,
        saldoCop,
        pct:
          cajita.metaCop && cajita.metaCop > 0
            ? Math.min(100, Math.round((saldoCop / cajita.metaCop) * 1000) / 10)
            : null,
      };
    })
    .sort((a, b) => b.saldoCop - a.saldoCop);
};

/** Live balances of one kind — accounts or pockets — added up. */
export const totalPorTipo = (
  cajitas: readonly Cajita[],
  movimientos: readonly CajitaMovimiento[],
  tipo: CajitaTipo,
  transacciones: readonly Transaction[] = [],
): number =>
  totalEnCajitas(cajitas.filter((c) => c.tipo === tipo), movimientos, transacciones);

export interface Patrimonio {
  cuentasCop: number;
  cajitasCop: number;
  /** What is owed on debts and cards. Always reported as a positive figure. */
  deudasCop: number;
  /** Accounts plus pockets, before subtracting anything. */
  totalCop: number;
  /** What is actually yours once debts are paid. Can be negative. */
  netoCop: number;
}

/**
 * What the user actually has, split by where it sits.
 *
 * Deliberately separate from the month's income and expenses: a month can close
 * in the red while the accounts are perfectly healthy, and conflating the two is
 * how a summary ends up alarming for no reason.
 */
export const patrimonio = (
  cajitas: readonly Cajita[],
  movimientos: readonly CajitaMovimiento[],
  transacciones: readonly Transaction[] = [],
): Patrimonio => {
  const cuentasCop = totalPorTipo(cajitas, movimientos, 'cuenta', transacciones);
  const cajitasCop = totalPorTipo(cajitas, movimientos, 'cajita', transacciones);
  const deudasCop =
    totalPorTipo(cajitas, movimientos, 'deuda', transacciones) +
    totalPorTipo(cajitas, movimientos, 'tarjeta', transacciones);
  const totalCop = cuentasCop + cajitasCop;

  return { cuentasCop, cajitasCop, deudasCop, totalCop, netoCop: totalCop - deudasCop };
};

/** Live balances of the kinds that represent money owed. */
export const resumenDePasivos = (
  cajitas: readonly Cajita[],
  movimientos: readonly CajitaMovimiento[],
  transacciones: readonly Transaction[] = [],
): ResumenCajita[] =>
  resumenDeCajitas(cajitas.filter((c) => ES_PASIVO[c.tipo]), movimientos, transacciones);

/** Live balances of the kinds that represent money held. */
export const resumenDeActivos = (
  cajitas: readonly Cajita[],
  movimientos: readonly CajitaMovimiento[],
): ResumenCajita[] =>
  resumenDeCajitas(cajitas.filter((c) => !ES_PASIVO[c.tipo]), movimientos);
