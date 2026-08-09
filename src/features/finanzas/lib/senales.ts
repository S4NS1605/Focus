import type { Transaction } from '../types';
import type { CategoriaClave } from '../types';
import { CATALOGO_BASE } from '../categorias';
import type { Catalogo } from '../categorias';
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
 * Everything the checks need, gathered in one pass.
 *
 * Without this each check re-scanned the whole ledger for every movement on
 * screen: 2.000 movements took 752ms, which is a visible freeze on the summary
 * and grows with every statement imported. Grouping once turns each verdict into
 * a lookup.
 */
export interface IndiceSenales {
  /** Typical amount per `${kind}|${category}`. */
  medianaPorCategoria: Map<string, number>;
  cuantosPorCategoria: Map<string, number>;
  /** Distinct months a counterparty appears in — a property of it, not of a row. */
  mesesPorParte: Map<string, number>;
  /** Typical amount with a counterparty. */
  medianaPorParte: Map<string, number>;
  /** Totals per `${mes}|${parte}`. */
  totalPorMesYParte: Map<string, number>;
  /** How many with a given counterparty, per `${mes}|${parte}`. */
  cuantosPorMesYParte: Map<string, number>;
  /** Movements sharing `${dia}|${monto}|${parte}`, for the twin check. */
  porDiaMontoParte: Map<string, number>;
  /** Earliest date seen for a counterparty. */
  primeraFechaPorParte: Map<string, string>;
  /**
   * How to name a category in the prose.
   *
   * Carried on the index rather than passed to each signal because the index is
   * already the one context object every signal receives, and because a signal
   * that says "3× tu gasto habitual en p-a1b2f" is worse than no signal at all.
   */
  nombreCategoria: (clave: CategoriaClave) => string;
}

const sumar = <K>(mapa: Map<K, number>, clave: K, valor: number): void => {
  mapa.set(clave, (mapa.get(clave) ?? 0) + valor);
};

export const crearIndiceSenales = (
  historial: readonly Transaction[],
  catalogo: Catalogo = CATALOGO_BASE,
): IndiceSenales => {
  const montosPorCategoria = new Map<string, number[]>();
  const montosPorParte = new Map<string, number[]>();
  const mesesVistosPorParte = new Map<string, Set<string>>();
  const totalPorMesYParte = new Map<string, number>();
  const cuantosPorMesYParte = new Map<string, number>();
  const porDiaMontoParte = new Map<string, number>();
  const primeraFechaPorParte = new Map<string, string>();

  for (const tx of historial) {
    const cat = `${tx.kind}|${tx.category}`;
    const montos = montosPorCategoria.get(cat);
    if (montos) montos.push(tx.amountCop);
    else montosPorCategoria.set(cat, [tx.amountCop]);

    const parte = claveDeParte(tx);
    if (!parte) continue;

    const conParte = `${tx.kind}|${parte}`;
    const montosParte = montosPorParte.get(conParte);
    if (montosParte) montosParte.push(tx.amountCop);
    else montosPorParte.set(conParte, [tx.amountCop]);

    const mes = monthKey(tx.occurredOn);
    const meses = mesesVistosPorParte.get(conParte);
    if (meses) meses.add(mes);
    else mesesVistosPorParte.set(conParte, new Set([mes]));

    const mesParte = `${mes}|${conParte}`;
    sumar(totalPorMesYParte, mesParte, tx.amountCop);
    sumar(cuantosPorMesYParte, mesParte, 1);
    sumar(porDiaMontoParte, `${tx.occurredOn}|${tx.amountCop}|${conParte}`, 1);

    const primera = primeraFechaPorParte.get(conParte);
    if (!primera || tx.occurredOn < primera) primeraFechaPorParte.set(conParte, tx.occurredOn);
  }

  const medianaPorCategoria = new Map<string, number>();
  const cuantosPorCategoria = new Map<string, number>();
  for (const [cat, montos] of montosPorCategoria) {
    medianaPorCategoria.set(cat, mediana(montos));
    cuantosPorCategoria.set(cat, montos.length);
  }

  const medianaPorParte = new Map<string, number>();
  for (const [parte, montos] of montosPorParte) medianaPorParte.set(parte, mediana(montos));

  const mesesPorParte = new Map<string, number>();
  for (const [parte, meses] of mesesVistosPorParte) mesesPorParte.set(parte, meses.size);

  return {
    medianaPorCategoria,
    cuantosPorCategoria,
    mesesPorParte,
    medianaPorParte,
    totalPorMesYParte,
    cuantosPorMesYParte,
    porDiaMontoParte,
    primeraFechaPorParte,
    nombreCategoria: (clave) => catalogo.de(clave).nombre,
  };
};

/**
 * Baseline for a category, across the whole record.
 *
 * Median rather than mean on purpose: one rent payment would drag a mean upward
 * far enough that nothing after it ever looks unusual again. And it needs a few
 * samples — calling the second coffee of your life "unusual" is noise, not
 * insight.
 *
 * Taken over the entire history rather than only what came before, which is both
 * cheaper (one median per category instead of one per movement) and arguably
 * truer: "what you typically spend on food" is a property of the record, not of
 * a point in it.
 */
const MUESTRAS_MINIMAS = 5;
const VECES_INUSUAL = 3;

const senalInusual = (tx: Transaction, indice: IndiceSenales): Senal | null => {
  const cat = `${tx.kind}|${tx.category}`;
  if ((indice.cuantosPorCategoria.get(cat) ?? 0) < MUESTRAS_MINIMAS) return null;

  const base = indice.medianaPorCategoria.get(cat) ?? 0;
  if (base <= 0) return null;

  const veces = tx.amountCop / base;
  if (veces < VECES_INUSUAL) return null;

  return {
    tipo: 'inusual',
    titulo: `${veces.toFixed(1)}× tu gasto habitual en ${indice.nombreCategoria(tx.category)}`,
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
const senalRecurrente = (tx: Transaction, indice: IndiceSenales): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const conParte = `${tx.kind}|${clave}`;
  const meses = indice.mesesPorParte.get(conParte) ?? 0;
  if (meses < MESES_RECURRENTE) return null;

  const base = indice.medianaPorParte.get(conParte) ?? 0;
  if (base <= 0) return null;
  if (Math.abs(tx.amountCop - base) / base > TOLERANCIA_MONTO) return null;

  return {
    tipo: 'recurrente',
    titulo: 'Se repite cada mes',
    detalle: `Lleva ${meses} meses por unos ${formatCop(base)}. Si es una suscripción, revisa si aún la usas.`,
    tono: 'aviso',
  };
};

const VECES_HORMIGA = 5;

/**
 * Small, frequent, and large in aggregate — the spending that hides because no
 * single charge is worth noticing.
 */
const senalHormiga = (tx: Transaction, indice: IndiceSenales): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const mesParte = `${monthKey(tx.occurredOn)}|${tx.kind}|${clave}`;
  const cuantos = indice.cuantosPorMesYParte.get(mesParte) ?? 0;
  if (cuantos < VECES_HORMIGA) return null;

  const total = indice.totalPorMesYParte.get(mesParte) ?? 0;

  return {
    tipo: 'hormiga',
    titulo: `${cuantos} veces este mes`,
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
const senalDuplicado = (tx: Transaction, indice: IndiceSenales): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const cuantos =
    indice.porDiaMontoParte.get(`${tx.occurredOn}|${tx.amountCop}|${tx.kind}|${clave}`) ?? 0;
  if (cuantos < 2) return null;

  return {
    tipo: 'duplicado',
    titulo: 'Hay otro idéntico ese día',
    detalle: `${cuantos} cobros iguales de ${formatCop(tx.amountCop)} el mismo día. Puede ser real, o un cobro doble.`,
    tono: 'aviso',
  };
};

const CRECIMIENTO_MINIMO = 0.5;

/** This counterparty is taking noticeably more than it did in recent months. */
const senalCreciendo = (tx: Transaction, indice: IndiceSenales): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const conParte = `${tx.kind}|${clave}`;
  const mes = monthKey(tx.occurredOn);
  const totalDe = (m: string) => indice.totalPorMesYParte.get(`${m}|${conParte}`) ?? 0;

  const anteriores = [1, 2, 3].map((n) => totalDe(shiftMonth(mes, -n))).filter((v) => v > 0);
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
const senalNuevo = (tx: Transaction, indice: IndiceSenales): Senal | null => {
  const clave = claveDeParte(tx);
  if (!clave) return null;

  const primera = indice.primeraFechaPorParte.get(`${tx.kind}|${clave}`);
  if (!primera || primera < tx.occurredOn) return null;

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
export const senalesConIndice = (tx: Transaction, indice: IndiceSenales): Senal[] =>
  [
    senalDuplicado(tx, indice),
    senalInusual(tx, indice),
    senalCreciendo(tx, indice),
    senalHormiga(tx, indice),
    senalRecurrente(tx, indice),
    senalNuevo(tx, indice),
  ]
    .filter((s): s is Senal => s !== null)
    .sort((a, b) => ORDEN[a.tono] - ORDEN[b.tono]);

/**
 * Convenience for a single movement, where building the index costs one pass
 * anyway. Use `crearIndiceSenales` + `senalesConIndice` for a whole list.
 */
export const senalesDeMovimiento = (
  tx: Transaction,
  historial: readonly Transaction[],
  catalogo: Catalogo = CATALOGO_BASE,
): Senal[] => senalesConIndice(tx, crearIndiceSenales(historial, catalogo));
