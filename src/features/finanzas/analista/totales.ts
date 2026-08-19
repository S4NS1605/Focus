import type { Category, TxKind } from '../types';
import type { AnalisisResultado, MovimientoExtraido } from './tipos';

export interface TotalesAnalisis {
  ingresos: number;
  gastos: number;
  balance: number;
  /** Rows deliberately left out, and why. Shown to the user, never silent. */
  excluidos: { motivo: string; cuantos: number; montoCop: number }[];
  contados: number;
}

const ETIQUETA_EXCLUSION: Record<string, string> = {
  'traslado-propio': 'Traslados entre tus cuentas',
  'pago-tarjeta': 'Pagos a tarjeta de crédito',
  reverso: 'Reversos y devoluciones',
  'saldo-informativo': 'Filas informativas de saldo',
};

/**
 * Totals from an extracted statement, counting ONLY rows without an exclusion.
 *
 * This is the correctness heart of the analyst. A bank statement is not a ledger
 * of net economic activity: it also lists money moving between the owner's own
 * accounts, credit-card settlements for purchases that appear as their own lines,
 * reversals that cancel earlier rows, and pure balance rows. Summing all of them
 * inflates both sides of the ledger and produces a savings rate that is
 * confidently wrong — worse than no number at all.
 *
 * The exclusions are returned rather than dropped, so the user can see exactly
 * what was left out and disagree with it.
 */
export const totalesDelAnalisis = (movimientos: readonly MovimientoExtraido[]): TotalesAnalisis => {
  let ingresos = 0;
  let gastos = 0;
  let contados = 0;
  const porMotivo = new Map<string, { cuantos: number; montoCop: number }>();

  for (const mov of movimientos) {
    if (mov.exclusion) {
      const actual = porMotivo.get(mov.exclusion) ?? { cuantos: 0, montoCop: 0 };
      porMotivo.set(mov.exclusion, {
        cuantos: actual.cuantos + 1,
        montoCop: actual.montoCop + mov.montoCop,
      });
      continue;
    }
    contados += 1;
    if (mov.tipo === 'ingreso') ingresos += mov.montoCop;
    else gastos += mov.montoCop;
  }

  return {
    ingresos,
    gastos,
    balance: ingresos - gastos,
    contados,
    excluidos: [...porMotivo.entries()]
      .map(([motivo, datos]) => ({
        motivo: ETIQUETA_EXCLUSION[motivo] ?? motivo,
        ...datos,
      }))
      .sort((a, b) => b.montoCop - a.montoCop),
  };
};

export interface RebanadaAnalisis {
  categoria: Category;
  total: number;
  pct: number;
}

/** Per-category totals for one direction, counted rows only, largest first. */
export const rebanadasDelAnalisis = (
  movimientos: readonly MovimientoExtraido[],
  tipo: TxKind,
): RebanadaAnalisis[] => {
  const totales = new Map<Category, number>();

  for (const mov of movimientos) {
    if (mov.exclusion || mov.tipo !== tipo) continue;
    totales.set(mov.categoria, (totales.get(mov.categoria) ?? 0) + mov.montoCop);
  }

  const gran = [...totales.values()].reduce((sum, v) => sum + v, 0);
  if (gran === 0) return [];

  return [...totales.entries()]
    .map(([categoria, total]) => ({
      categoria,
      total,
      pct: Math.round((total / gran) * 1000) / 10,
    }))
    .sort((a, b) =>
      b.total !== a.total ? b.total - a.total : a.categoria.localeCompare(b.categoria),
    );
};

/**
 * True when the model's own metrics table disagrees with the movements it
 * extracted by more than a tolerance. A mismatch means the narrative was written
 * against numbers the movement list does not support, so the movements — which
 * are auditable line by line — are the ones to trust.
 */
export const metricasCoherentes = (resultado: AnalisisResultado, tolerancia = 0.02): boolean => {
  const propios = totalesDelAnalisis(resultado.movimientos);
  const declarado = resultado.metricas.find((m) => /gasto total|total de gastos/i.test(m.etiqueta));
  if (!declarado || propios.gastos === 0) return true;

  const desvio = Math.abs(declarado.valorCop - propios.gastos) / propios.gastos;
  return desvio <= tolerancia;
};
