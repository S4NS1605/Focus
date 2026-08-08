import type { Transaction, TxKind } from '../types';
import { extraerContraparte } from './contraparte';
import { forMonth } from './aggregate';

export interface FilaContraparte {
  nombre: string;
  totalCop: number;
  veces: number;
}

/**
 * Who money actually went to or came from, largest first.
 *
 * This is the answer a category breakdown cannot give. On a wallet statement
 * "transferencia" is most of the month, so knowing it was transfers explains
 * nothing — knowing that a third of it went to one person does.
 *
 * Movements with no identifiable counterparty are left out rather than pooled
 * into an "otros" row, which would be the same uninformative lump one level
 * down.
 */
export const topContrapartes = (
  transacciones: readonly Transaction[],
  kind: TxKind,
  limite = 8,
): FilaContraparte[] => {
  const porNombre = new Map<string, FilaContraparte>();

  for (const tx of transacciones) {
    if (tx.kind !== kind) continue;
    const nombre = extraerContraparte(tx.description);
    if (!nombre) continue;

    const fila = porNombre.get(nombre) ?? { nombre, totalCop: 0, veces: 0 };
    fila.totalCop += tx.amountCop;
    fila.veces += 1;
    porNombre.set(nombre, fila);
  }

  return [...porNombre.values()]
    .sort((a, b) => (b.totalCop !== a.totalCop ? b.totalCop - a.totalCop : a.nombre.localeCompare(b.nombre)))
    .slice(0, limite);
};

/**
 * The largest single movements, either direction.
 *
 * A month is usually explained by a handful of big movements rather than by the
 * long tail, so this answers "where did it go" faster than any aggregate.
 */
export const mayoresMovimientos = (
  transacciones: readonly Transaction[],
  kind: TxKind,
  limite = 5,
): Transaction[] =>
  transacciones
    .filter((tx) => tx.kind === kind)
    .sort((a, b) => b.amountCop - a.amountCop)
    .slice(0, limite);

export interface DiaDelMes {
  /** 'YYYY-MM-DD'. */
  fecha: string;
  /** Day of month, for a compact axis label. */
  dia: number;
  gastoCop: number;
  ingresoCop: number;
}

/**
 * Every day of a month, including the ones with no movements.
 *
 * The empty days are the point: a chart that skips them hides that spending was
 * three big days rather than a steady drip, which is the shape people actually
 * recognise about their own habits.
 */
export const porDiaDelMes = (
  transacciones: readonly Transaction[],
  mes: string,
): DiaDelMes[] => {
  const [anio, m] = mes.split('-').map(Number);
  // Day 0 of the next month is the last day of this one, leap years included.
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();

  const dias: DiaDelMes[] = Array.from({ length: ultimo }, (_, i) => ({
    fecha: `${mes}-${String(i + 1).padStart(2, '0')}`,
    dia: i + 1,
    gastoCop: 0,
    ingresoCop: 0,
  }));

  for (const tx of forMonth(transacciones, mes)) {
    const indice = Number(tx.occurredOn.slice(8, 10)) - 1;
    if (indice < 0 || indice >= dias.length) continue;
    if (tx.kind === 'gasto') dias[indice].gastoCop += tx.amountCop;
    else dias[indice].ingresoCop += tx.amountCop;
  }

  return dias;
};

export interface ResumenDelMes {
  /** Days that had any spending at all. */
  diasConGasto: number;
  /** Average across only those days — an average over 31 says nothing. */
  promedioPorDiaActivoCop: number;
  /** The single heaviest day, when there was one. */
  diaMasCaro: DiaDelMes | null;
  movimientos: number;
}

export const resumenDelMes = (
  transacciones: readonly Transaction[],
  mes: string,
): ResumenDelMes => {
  const dias = porDiaDelMes(transacciones, mes);
  const activos = dias.filter((d) => d.gastoCop > 0);
  const total = activos.reduce((t, d) => t + d.gastoCop, 0);

  return {
    diasConGasto: activos.length,
    // Divided by days that actually had spending, not by the length of the
    // month: averaging in the untouched days drags every figure toward zero.
    promedioPorDiaActivoCop: activos.length > 0 ? Math.round(total / activos.length) : 0,
    diaMasCaro: activos.length > 0 ? activos.reduce((a, b) => (b.gastoCop > a.gastoCop ? b : a)) : null,
    movimientos: forMonth(transacciones, mes).length,
  };
};
