import type { CajitaMovimiento } from '../data/modelos';
import { daysBetween } from './localDate';

const DIAS_ANIO = 365;

/**
 * Daily rate equivalent to an annual EFFECTIVE rate.
 *
 * This is the whole reason E.A. exists as a separate figure, and the one place
 * this calculation is usually got wrong: E.A. already includes compounding, so
 * the daily rate is the 365th ROOT, never `EA / 365`. At 13% E.A. the correct
 * daily rate is 0.03349%, while the naive division gives 0.03562% — about 6%
 * too much, compounding into a visibly wrong figure over a year.
 */
export const tasaDiaria = (tasaEaPct: number): number =>
  Math.pow(1 + tasaEaPct / 100, 1 / DIAS_ANIO) - 1;

/** What a balance earns in a single day at the given annual effective rate. */
export const rendimientoDiario = (saldoCop: number, tasaEaPct: number): number =>
  saldoCop * tasaDiaria(tasaEaPct);

/** Growth factor for holding a balance `dias` days. */
const factor = (tasaEaPct: number, dias: number): number =>
  Math.pow(1 + tasaEaPct / 100, dias / DIAS_ANIO);

export interface RendimientoEstimado {
  /** Interest accrued from the first movement up to `hasta`, compounded. */
  acumuladoCop: number;
  /** What it earns today at the current balance. */
  diarioCop: number;
  /** What a full year at today's balance would add, if nothing moved. */
  anualCop: number;
  /** Days of history the accrual covers, for showing what the figure is based on. */
  dias: number;
}

/**
 * Interest a pocket has accrued, walking its real balance history.
 *
 * A flat `saldo * tasa * dias` would be wrong twice over: it ignores compounding,
 * and it pretends today's balance was there the whole time. Money deposited
 * yesterday has not been earning for six months. So this replays the movements in
 * order, growing whatever balance actually stood during each gap.
 *
 * The result is DERIVED, never written as a movement. The app's core invariant is
 * that a balance equals the sum of its movements, and inventing interest rows
 * would make the app's numbers disagree with the bank's. When the real payment
 * lands, the user records it as a `rendimiento` movement — this figure is only
 * there to tell them roughly what to expect.
 */
export const rendimientoEstimado = (
  movimientos: readonly CajitaMovimiento[],
  cajitaId: string,
  tasaEaPct: number | null,
  hoy: string,
): RendimientoEstimado | null => {
  if (tasaEaPct === null || tasaEaPct <= 0) return null;

  const propios = movimientos
    .filter((m) => m.cajitaId === cajitaId)
    .sort((a, b) =>
      a.occurredOn !== b.occurredOn
        ? a.occurredOn.localeCompare(b.occurredOn)
        : a.createdAt.localeCompare(b.createdAt),
    );

  if (propios.length === 0) return null;

  let saldo = 0;
  let conIntereses = 0;
  let fecha = propios[0].occurredOn;

  for (const mov of propios) {
    const dias = daysBetween(fecha, mov.occurredOn);
    if (dias > 0 && saldo > 0) conIntereses += saldo * (factor(tasaEaPct, dias) - 1);
    saldo += mov.deltaCop;
    fecha = mov.occurredOn;
  }

  // Movements dated in the future would otherwise subtract interest.
  const diasFinales = Math.max(0, daysBetween(fecha, hoy));
  if (diasFinales > 0 && saldo > 0) conIntereses += saldo * (factor(tasaEaPct, diasFinales) - 1);

  return {
    acumuladoCop: Math.round(conIntereses),
    diarioCop: Math.round(rendimientoDiario(Math.max(0, saldo), tasaEaPct)),
    anualCop: Math.round(Math.max(0, saldo) * (tasaEaPct / 100)),
    dias: Math.max(0, daysBetween(propios[0].occurredOn, hoy)),
  };
};
