import type { Transaction } from '../types';
import { CATEGORY_LABELS } from '../types';
import { extraerContraparte } from './contraparte';
import { formatCop } from './formatCop';
import { monthKey, shiftMonth } from './localDate';

/**
 * What the app can say about a single movement.
 *
 * Deliberately not "good" and "bad". Whether a coffee is bad spending is a value
 * judgement the app has no standing to make, and one that turns a tool into a
 * scold. What it CAN judge is how a movement compares to the user's own history,
 * which is both defensible and actionable: "4× what you usually spend on food"
 * is a fact about them, not an opinion about their life.
 */
export type TipoSenal = 'inusual' | 'recurrente' | 'hormiga' | 'duplicado' | 'creciendo' | 'nuevo';

export type Tono = 'alerta' | 'aviso' | 'neutro';

export interface Senal {
  tipo: TipoSenal;
  titulo: string;
  detalle: string;
  tono: Tono;
}

/** Amounts sorted, middle value. */
const mediana = (valores: readonly number[]): number => {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio];
};

/** How a movement is identified across months: who it was with, else its text. */
const claveDeParte = (tx: Transaction): string =>
  (extraerContraparte(tx.description) ?? tx.description).trim().toLowerCase();

/**
 * Baseline for a category, from everything BEFORE this movement.
 *
 * Median rather than mean on purpose: one rent payment would drag a mean upward
 * far enough that nothing after it ever looks unusual again. And it needs a few
 * samples — calling the second coffee of your life "unusual" is noise, not
 * insight.
 */
const MUESTRAS_MINIMAS = 4;
const VECES_INUSUAL = 3;

const senalInusual = (tx: Transaction, historial: readonly Transaction[]): Senal | null => {
  const previos = historial
    .filter(
      (t) =>
        t.id !== tx.id &&
        t.kind === tx.kind &&
        t.category === tx.category &&
        t.occurredOn <= tx.occurredOn,
    )
    .map((t) => t.amountCop);

  if (previos.length < MUESTRAS_MINIMAS) return null;

  const base = mediana(previos);
  if (base <= 0) return null;

  const veces = tx.amountCop / base;
  if (veces < VECES_INUSUAL) return null;

  return {
    tipo: 'inusual',
    titulo: `${veces.toFixed(1)}× tu gasto habitual en ${CATEGORY_LABELS[tx.category]}`,
    detalle: `Sueles gastar cerca de ${formatCop(base)}. Este fue ${formatCop(tx.amountCop)}.`,
    tono: veces >= 5 ? 'alerta' : 'aviso',
  };
};

const MESES_RECURRENTE = 3;
const TOLERANCIA_MONTO = 0.15;

/**
 * The same counterparty, in three or more distinct months, for roughly the same
 * amount. That is what a subscription looks like from the outside — and the
 * charges people most often forget are exactly the ones that never vary.
 */
const senalRecurrente = (tx: Transaction, historial: readonly Transaction[]): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const iguales = historial.filter((t) => t.kind === tx.kind && claveDeParte(t) === clave);
  const meses = new Set(iguales.map((t) => monthKey(t.occurredOn)));
  if (meses.size < MESES_RECURRENTE) return null;

  const base = mediana(iguales.map((t) => t.amountCop));
  if (base <= 0) return null;
  if (Math.abs(tx.amountCop - base) / base > TOLERANCIA_MONTO) return null;

  return {
    tipo: 'recurrente',
    titulo: 'Se repite cada mes',
    detalle: `Lleva ${meses.size} meses por unos ${formatCop(base)}. Si es una suscripción, revisa si aún la usas.`,
    tono: 'aviso',
  };
};

const VECES_HORMIGA = 5;

/**
 * Small, frequent, and large in aggregate — the spending that hides because no
 * single charge is worth noticing.
 */
const senalHormiga = (tx: Transaction, delMes: readonly Transaction[]): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const iguales = delMes.filter((t) => t.kind === tx.kind && claveDeParte(t) === clave);
  if (iguales.length < VECES_HORMIGA) return null;

  const total = iguales.reduce((t, m) => t + m.amountCop, 0);

  return {
    tipo: 'hormiga',
    titulo: `${iguales.length} veces este mes`,
    detalle: `Cada una parece poca cosa, pero suman ${formatCop(total)}.`,
    tono: 'aviso',
  };
};

/**
 * Same amount, same counterparty, same day, more than once.
 *
 * Reported, never removed: two identical coffees on one afternoon are perfectly
 * real, and the import path already relies on that being allowed. This only asks
 * the user to look.
 */
const senalDuplicado = (tx: Transaction, delMes: readonly Transaction[]): Senal | null => {
  const gemelos = delMes.filter(
    (t) =>
      t.id !== tx.id &&
      t.occurredOn === tx.occurredOn &&
      t.amountCop === tx.amountCop &&
      claveDeParte(t) === claveDeParte(tx),
  );
  if (gemelos.length === 0) return null;

  return {
    tipo: 'duplicado',
    titulo: 'Hay otro idéntico ese día',
    detalle: `${gemelos.length + 1} cobros iguales de ${formatCop(tx.amountCop)} el mismo día. Puede ser real, o un cobro doble.`,
    tono: 'aviso',
  };
};

const CRECIMIENTO_MINIMO = 0.5;

/** This counterparty is taking noticeably more than it did in recent months. */
const senalCreciendo = (tx: Transaction, historial: readonly Transaction[]): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const mes = monthKey(tx.occurredOn);
  const previos = [1, 2, 3].map((n) => shiftMonth(mes, -n));

  const totalDe = (m: string) =>
    historial
      .filter((t) => t.kind === tx.kind && claveDeParte(t) === clave && monthKey(t.occurredOn) === m)
      .reduce((t, x) => t + x.amountCop, 0);

  const anteriores = previos.map(totalDe).filter((v) => v > 0);
  if (anteriores.length === 0) return null;

  const esteMes = totalDe(mes);
  const promedio = anteriores.reduce((a, b) => a + b, 0) / anteriores.length;
  if (promedio <= 0) return null;

  const alza = (esteMes - promedio) / promedio;
  if (alza < CRECIMIENTO_MINIMO) return null;

  return {
    tipo: 'creciendo',
    titulo: `Subió ${Math.round(alza * 100)}% frente a tus últimos meses`,
    detalle: `Este mes van ${formatCop(esteMes)}, contra ${formatCop(Math.round(promedio))} de promedio.`,
    tono: alza >= 1 ? 'alerta' : 'aviso',
  };
};

/** First time this counterparty appears at all. */
const senalNuevo = (tx: Transaction, historial: readonly Transaction[]): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const antes = historial.some(
    (t) => t.id !== tx.id && claveDeParte(t) === clave && t.occurredOn < tx.occurredOn,
  );
  if (antes) return null;

  return {
    tipo: 'nuevo',
    titulo: 'Primera vez',
    detalle: 'No habías registrado nada con esta contraparte antes.',
    tono: 'neutro',
  };
};

const ORDEN: Record<Tono, number> = { alerta: 0, aviso: 1, neutro: 2 };

/**
 * Everything the app can say about one movement, most pressing first.
 *
 * `historial` is the whole ledger, not just the month: the comparisons that make
 * a verdict worth reading — is this normal for you, does it repeat, is it
 * growing — only exist across months.
 */
export const senalesDeMovimiento = (
  tx: Transaction,
  historial: readonly Transaction[],
): Senal[] => {
  const delMes = historial.filter((t) => monthKey(t.occurredOn) === monthKey(tx.occurredOn));

  return [
    senalDuplicado(tx, delMes),
    senalInusual(tx, historial),
    senalCreciendo(tx, historial),
    senalHormiga(tx, delMes),
    senalRecurrente(tx, historial),
    senalNuevo(tx, historial),
  ]
    .filter((s): s is Senal => s !== null)
    .sort((a, b) => ORDEN[a.tono] - ORDEN[b.tono]);
};
