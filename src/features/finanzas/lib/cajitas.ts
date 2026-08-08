import type { Cajita, CajitaMovimiento, CajitaTipo } from '../data/modelos';

/**
 * A pocket's balance is always the sum of its movements — never a stored number.
 *
 * That is what makes "just tell it how much you have" safe: setting a balance
 * records the delta needed to reach it, so the history and the balance can never
 * disagree, and every past figure stays reconstructable.
 */
export const saldosPorCajita = (
  movimientos: readonly CajitaMovimiento[],
): Map<string, number> => {
  const saldos = new Map<string, number>();
  for (const mov of movimientos) {
    saldos.set(mov.cajitaId, (saldos.get(mov.cajitaId) ?? 0) + mov.deltaCop);
  }
  return saldos;
};

export const saldoDeCajita = (
  movimientos: readonly CajitaMovimiento[],
  cajitaId: string,
): number =>
  movimientos.reduce((total, mov) => (mov.cajitaId === cajitaId ? total + mov.deltaCop : total), 0);

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
): number => {
  const saldos = saldosPorCajita(movimientos);
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
): ResumenCajita[] => {
  const saldos = saldosPorCajita(movimientos);

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
): number => totalEnCajitas(cajitas.filter((c) => c.tipo === tipo), movimientos);

export interface Patrimonio {
  cuentasCop: number;
  cajitasCop: number;
  /** Everything the user has told the app about. */
  totalCop: number;
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
): Patrimonio => {
  const cuentasCop = totalPorTipo(cajitas, movimientos, 'cuenta');
  const cajitasCop = totalPorTipo(cajitas, movimientos, 'cajita');
  return { cuentasCop, cajitasCop, totalCop: cuentasCop + cajitasCop };
};
