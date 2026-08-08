import type { AnalisisResultado } from '../../src/features/finanzas/analista/tipos.ts';
import { totalesDelAnalisis, rebanadasDelAnalisis } from '../../src/features/finanzas/analista/totales.ts';
import { formatCop } from '../../src/features/finanzas/lib/formatCop.ts';
import { CATEGORY_LABELS } from '../../src/features/finanzas/types.ts';
import { pareceNequi, parsearNequi, periodoNequi } from './nequi.ts';
import { pareceNu, parsearNu, periodoNu } from './nu.ts';
import { pareceBancolombia, parsearBancolombia, periodoBancolombia } from './bancolombia.ts';
import { pareceDavivienda, parsearDavivienda, periodoDavivienda } from './davivienda.ts';

export type Banco = 'nequi' | 'nu' | 'bancolombia' | 'davivienda';

export const detectarBanco = (texto: string): Banco | null => {
  if (pareceNequi(texto)) return 'nequi';
  if (pareceNu(texto)) return 'nu';
  if (pareceBancolombia(texto)) return 'bancolombia';
  if (pareceDavivienda(texto)) return 'davivienda';
  return null;
};

const NOMBRE_BANCO: Record<Banco, string> = {
  nequi: 'Nequi',
  nu: 'Nu',
  bancolombia: 'Bancolombia',
  davivienda: 'Davivienda',
};

/**
 * Turns extracted statement text into the same report shape the old
 * AI-based analyst produced, but computed entirely with local, per-bank
 * templates — no network call, no third party ever sees the statement.
 *
 * The cost of that: `veredicto` and `recomendaciones` here are plain
 * arithmetic sentences, not a model's read of spending behaviour, and
 * anything the templates could not parse (an unrecognized bank, a line that
 * doesn't match the expected columns) is stated in `advertencias` rather
 * than guessed at.
 */
export const analizarConPlantilla = (texto: string): AnalisisResultado | null => {
  const banco = detectarBanco(texto);
  if (!banco) return null;

  const { movimientos, periodo } =
    banco === 'nequi'
      ? { movimientos: parsearNequi(texto), periodo: periodoNequi(texto) }
      : banco === 'nu'
        ? { movimientos: parsearNu(texto), periodo: periodoNu(texto) }
        : banco === 'bancolombia'
          ? { movimientos: parsearBancolombia(texto), periodo: periodoBancolombia(texto) }
          : { movimientos: parsearDavivienda(texto), periodo: periodoDavivienda(texto) };

  if (movimientos.length === 0) return null;

  const totales = totalesDelAnalisis(movimientos);
  const gastosPorCategoria = rebanadasDelAnalisis(movimientos, 'gasto');

  const veredicto =
    totales.balance >= 0
      ? `Este período te entraron ${formatCop(totales.ingresos)} y gastaste ${formatCop(totales.gastos)}: te quedaron ${formatCop(totales.balance)}.`
      : `Este período gastaste ${formatCop(totales.gastos)} y te entraron ${formatCop(totales.ingresos)}: quedaste ${formatCop(Math.abs(totales.balance))} en negativo.`;

  const advertencias = [
    'Análisis generado localmente con plantillas por banco, sin inteligencia artificial: ningún dato del extracto sale de este servidor.',
    ...(totales.excluidos.length > 0
      ? [
          `Se excluyeron de los totales ${totales.excluidos.reduce((n, e) => n + e.cuantos, 0)} movimientos detectados como traslados propios, pagos de tarjeta u otras filas informativas — revísalos abajo.`,
        ]
      : []),
  ];

  return {
    periodo: periodo ?? { desde: '', hasta: '', etiqueta: NOMBRE_BANCO[banco] },
    veredicto,
    metricas: [
      { etiqueta: 'Total ingresos', valorCop: totales.ingresos, nota: null },
      { etiqueta: 'Total gastos', valorCop: totales.gastos, nota: null },
      { etiqueta: 'Balance del período', valorCop: totales.balance, nota: null },
      ...totales.excluidos.map((e) => ({
        etiqueta: e.motivo,
        valorCop: e.montoCop,
        nota: `${e.cuantos} movimiento${e.cuantos === 1 ? '' : 's'}, no contado en los totales`,
      })),
    ],
    alertas:
      totales.balance < 0
        ? [
            {
              severidad: 'alta' as const,
              titulo: 'Balance negativo',
              detalle: `Gastaste ${formatCop(Math.abs(totales.balance))} más de lo que te entró en este período.`,
            },
          ]
        : [],
    recomendaciones:
      gastosPorCategoria.length > 0
        ? [
            {
              titulo: `Tu mayor categoría de gasto fue ${CATEGORY_LABELS[gastosPorCategoria[0].categoria]}`,
              detalle: `Representó ${formatCop(gastosPorCategoria[0].total)} (${gastosPorCategoria[0].pct}% de tus gastos contados).`,
              ahorroMensualCop: null,
            },
          ]
        : [],
    movimientos,
    advertencias,
  };
};
