import React, { useState } from 'react';
import { CheckCircle2, TrendingDown, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Transaction } from '../types';
import type { MonthTotals } from '../lib/aggregate';
import { byCategory } from '../lib/aggregate';
import { colorDeCategoria, COLOR_OTROS } from '../lib/paletaViz';
import { useEsOscuro } from '../data/useEsOscuro';
import { formatCop } from '../lib/formatCop';
import { useCatalogo } from '../catalogoContexto';

interface EstadoDelMesProps {
  totals: MonthTotals;
  delMes: readonly Transaction[];
}

/**
 * Status, with an icon and words — never colour alone.
 *
 * Status hues are reserved and never reused as a series colour, which is why
 * these come from the app's semantic tokens rather than the chart palette.
 */
const estado = (
  totals: MonthTotals,
): { Icono: LucideIcon; titulo: string; tono: string } => {
  if (totals.ingresos === 0 && totals.gastos === 0) {
    return { Icono: CheckCircle2, titulo: 'Sin movimientos este mes', tono: 'var(--fin-ink-soft)' };
  }
  if (totals.balance < 0) {
    return { Icono: TriangleAlert, titulo: 'Gastaste más de lo que entró', tono: 'var(--fin-out)' };
  }
  if (totals.tasaAhorro !== null && totals.tasaAhorro < 10) {
    return { Icono: TrendingDown, titulo: 'Vas justo este mes', tono: 'var(--fin-warn-ink)' };
  }
  return { Icono: CheckCircle2, titulo: 'Vas bien este mes', tono: 'var(--fin-in)' };
};

const MAX_SEGMENTOS = 5;

/**
 * The month at a glance: one hero figure, one meter, one part-to-whole bar.
 *
 * A meter rather than a two-slice donut, because the question is a single ratio
 * against a limit — how much of what came in is already gone. A horizontal
 * stacked bar rather than a pie of thirteen categories, because past about six
 * segments adjacent classes blur no matter which hues are chosen; the tail folds
 * into "Otros" and the full list below is the table that carries the detail.
 */
export const EstadoDelMes: React.FC<EstadoDelMesProps> = ({ totals, delMes }) => {
  const catalogo = useCatalogo();
  const oscuro = useEsOscuro();
  const [activo, setActivo] = useState<string | null>(null);
  const { Icono, titulo, tono } = estado(totals);

  const gastos = byCategory(delMes, 'gasto');
  const visibles = gastos.slice(0, MAX_SEGMENTOS);
  const resto = gastos.slice(MAX_SEGMENTOS);
  const restoTotal = resto.reduce((t, s) => t + s.total, 0);

  const segmentos = [
    ...visibles.map((s) => ({
      clave: s.category as string,
      etiqueta: catalogo.de(s.category).nombre,
      total: s.total,
      color: colorDeCategoria(s.category, oscuro),
    })),
    ...(restoTotal > 0
      ? [
          {
            clave: 'otros-agrupados',
            etiqueta: `Otras ${resto.length}`,
            total: restoTotal,
            color: oscuro ? COLOR_OTROS.oscuro : COLOR_OTROS.claro,
          },
        ]
      : []),
  ];

  const totalGasto = segmentos.reduce((t, s) => t + s.total, 0);
  // Capped at 100: spending more than came in is a real state, and a bar running
  // past its own track would say nothing the number above it does not.
  const consumido =
    totals.ingresos > 0 ? Math.min(100, (totals.gastos / totals.ingresos) * 100) : 0;

  const detalle = activo ? segmentos.find((s) => s.clave === activo) : null;

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <div className="flex items-center gap-2">
        <Icono className="h-4 w-4 shrink-0" style={{ color: tono }} strokeWidth={2.5} aria-hidden="true" />
        <h2 className="text-xs font-bold" style={{ color: tono }}>
          {titulo}
        </h2>
      </div>

      {/* Hero figure: the one number the screen leads with. */}
      <p
        className="mt-1 font-display text-[2.75rem] font-extrabold leading-none tabular-nums"
        style={{ color: totals.balance >= 0 ? 'var(--fin-in)' : 'var(--fin-out)' }}
      >
        {formatCop(totals.balance)}
      </p>
      <p className="mt-1 text-[11px] text-[var(--fin-ink-faint)]">
        {totals.balance >= 0 ? 'te sobró' : 'te faltó'} · entró {formatCop(totals.ingresos)}, salió{' '}
        {formatCop(totals.gastos)}
      </p>

      {/* Meter: a single ratio against a limit, on one track. */}
      {totals.ingresos > 0 ? (
        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--fin-soft)]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${consumido}%`,
                backgroundColor: consumido >= 100 ? 'var(--fin-out)' : 'var(--fin-in)',
              }}
              role="meter"
              aria-valuenow={Math.round(consumido)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Parte de tus ingresos ya gastada"
            />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-[var(--fin-ink-soft)] tabular-nums">
            Llevas gastado el {Math.round(consumido)}% de lo que entró
          </p>
        </div>
      ) : null}

      {/* Part-to-whole, at most six segments. */}
      {segmentos.length > 0 ? (
        <div className="mt-5">
          <div className="flex h-8 items-center justify-between">
            {detalle ? (
              <>
                <span className="truncate text-[11px] font-bold text-[var(--fin-ink)]">
                  {detalle.etiqueta}
                </span>
                <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-[var(--fin-ink)]">
                  {formatCop(detalle.total)} · {Math.round((detalle.total / totalGasto) * 100)}%
                </span>
              </>
            ) : (
              <span className="text-[11px] text-[var(--fin-ink-faint)]">En qué se fue</span>
            )}
          </div>

          {/* 2px surface gaps between segments, per the mark spec. */}
          <div
            className="flex h-3 w-full gap-[2px] overflow-hidden"
            onMouseLeave={() => setActivo(null)}
          >
            {segmentos.map((s, i) => (
              <button
                key={s.clave}
                type="button"
                onMouseEnter={() => setActivo(s.clave)}
                onFocus={() => setActivo(s.clave)}
                onClick={() => setActivo(activo === s.clave ? null : s.clave)}
                aria-label={`${s.etiqueta}: ${formatCop(s.total)}`}
                className="h-full min-w-[3px] transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fin-ink)]"
                style={{
                  width: `${(s.total / totalGasto) * 100}%`,
                  backgroundColor: s.color,
                  opacity: activo && activo !== s.clave ? 0.35 : 1,
                  borderRadius:
                    i === 0
                      ? '4px 0 0 4px'
                      : i === segmentos.length - 1
                        ? '0 4px 4px 0'
                        : undefined,
                }}
              />
            ))}
          </div>

          {/* Legend: identity is never colour alone. Three of the light steps sit
              below 3:1 on the surface, so the labels are the required relief. */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {segmentos.map((s) => (
              <li key={s.clave} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-semibold text-[var(--fin-ink-soft)]">
                  {s.etiqueta}
                </span>
                <span className="text-[10px] tabular-nums text-[var(--fin-ink-faint)]">
                  {Math.round((s.total / totalGasto) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
