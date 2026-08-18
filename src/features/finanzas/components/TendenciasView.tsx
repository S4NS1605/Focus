import React from 'react';
import { COPY } from '../copy';
import { TrendingUp, BarChart2, Scale, Search } from 'lucide-react';
import type { Transaction } from '../types';
import { compararCategorias, promedioMensual, serieMensual, ultimosMeses } from '../lib/tendencias';
import { formatCop } from '../lib/formatCop';
import { monthKeyLabel, shiftMonth } from '../lib/localDate';
import { useCatalogo } from '../catalogoContexto';

interface TendenciasViewProps {
  transacciones: readonly Transaction[];
  /** 'YYYY-MM' the view is anchored to — the month the rest of the app shows. */
  mes: string;
}

const MESES_VENTANA = 6;

export const TendenciasView: React.FC<TendenciasViewProps> = ({ transacciones, mes }) => {
  const catalogo = useCatalogo();
  const meses = ultimosMeses(mes, MESES_VENTANA);
  const serie = serieMensual(transacciones, meses);
  const promedio = promedioMensual(serie);
  const mesAnterior = shiftMonth(mes, -1);
  const cambios = compararCategorias(transacciones, mes, mesAnterior);

  // Bars are scaled against the largest single figure in the window so the tallest
  // bar always fills the track and the rest stay honestly proportional to it.
  const techo = Math.max(1, ...serie.map((p) => Math.max(p.ingresos, p.gastos)));

  const mesesConDatos = serie.filter((p) => p.ingresos > 0 || p.gastos > 0).length;

  if (mesesConDatos === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center">
        <span className="block text-[var(--fin-ink-ghost)] mb-2 flex justify-center" aria-hidden="true">
          <TrendingUp className="h-10 w-10" strokeWidth={1.5} />
        </span>
        <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">{COPY.tendencias.sinDatos}</p>
        <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">{COPY.tendencias.sinDatosHint}</p>
      </div>
    );
  }

  return (
    // Tres tarjetas cortas apiladas en una sola columna angosta se veían bien
    // en el celular, donde el ancho ya es el límite -- pero en un monitor de
    // escritorio dejaban dos tercios de la pantalla en negro. La barra de
    // meses (la más alta) ocupa su propia columna; las otras dos, más cortas,
    // se apilan en la segunda -- así el ancho se usa de verdad en vez de
    // solo estirar tarjetas pequeñas para que se vean más anchas.
    <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {/* Six-month bars */}
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">
          <BarChart2 className="mr-1.5 inline h-4 w-4 mb-0.5" aria-hidden="true" />
          {COPY.tendencias.ultimosMeses}
        </h2>

        <ul className="mt-4 flex flex-col gap-3">
          {serie.map((punto) => (
            <li key={punto.month}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold capitalize text-[var(--fin-ink-soft)]">
                  {monthKeyLabel(punto.month)}
                </span>
                <span
                  className="text-[11px] font-extrabold tabular-nums"
                  style={{ color: punto.balance >= 0 ? 'var(--fin-in)' : 'var(--fin-out)' }}
                >
                  {formatCop(punto.balance)}
                </span>
              </div>

              {/* Income above, spending below — two tracks, never one net bar,
                  because a net bar hides a month that earned and spent a lot. */}
              <div className="mt-1.5 flex flex-col gap-1">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--fin-soft)]">
                  <div
                    className="h-full rounded-full bg-[var(--fin-in)]"
                    style={{ width: `${(punto.ingresos / techo) * 100}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--fin-soft)]">
                  <div
                    className="h-full rounded-full bg-[var(--fin-out)]"
                    style={{ width: `${(punto.gastos / techo) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex gap-4 border-t border-[var(--fin-soft)] pt-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--fin-ink-soft)]">
            <span className="h-2 w-4 rounded-full bg-[var(--fin-in)]" aria-hidden="true" />
            {COPY.balance.ingresos}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--fin-ink-soft)]">
            <span className="h-2 w-4 rounded-full bg-[var(--fin-out)]" aria-hidden="true" />
            {COPY.balance.gastos}
          </span>
        </div>
      </section>

      {/* Segunda columna en escritorio: las dos tarjetas cortas juntas, para
          que no queden cada una sola estirada a lo ancho de media pantalla. */}
      <div className="flex flex-col gap-5">
      {/* Averages */}
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">
          <Scale className="mr-1.5 inline h-4 w-4 mb-0.5" aria-hidden="true" />
          {COPY.tendencias.promedio}
        </h2>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: COPY.balance.ingresos, valor: promedio.ingresos, color: 'var(--fin-in)' },
            { label: COPY.balance.gastos, valor: promedio.gastos, color: 'var(--fin-out)' },
            {
              label: COPY.balance.balance,
              valor: promedio.balance,
              color: promedio.balance >= 0 ? 'var(--fin-in)' : 'var(--fin-out)',
            },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-bold text-[var(--fin-ink-faint)]">{item.label}</p>
              <p
                className="font-display text-base font-extrabold tabular-nums"
                style={{ color: item.color }}
              >
                {formatCop(item.valor)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-[var(--fin-ink-faint)]">
          {COPY.tendencias.promedioNota} ({promedio.meses})
        </p>
      </section>

      {/* Month-over-month by category */}
      {cambios.length > 0 ? (
        <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">
            <Search className="mr-1.5 inline h-4 w-4 mb-0.5" aria-hidden="true" />
            {COPY.tendencias.comparativo}
          </h2>
          <p className="mt-0.5 text-[10px] capitalize text-[var(--fin-ink-faint)]">
            {monthKeyLabel(mes)} vs {monthKeyLabel(mesAnterior)}
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {cambios.map((cambio) => {
              const entrada = catalogo.de(cambio.category);
              const color = entrada.color;
              const subio = cambio.deltaCop > 0;
              const nuevo = cambio.deltaPct === null && cambio.anteriorCop === 0;
              const desaparecio = cambio.actualCop === 0 && cambio.anteriorCop > 0;

              return (
                <li
                  key={cambio.category}
                  className="flex items-center gap-3 rounded-2xl bg-[var(--fin-bg)] px-3 py-2.5"
                >
                  <span className="shrink-0" aria-hidden="true">
                    {(() => {
                      const Icon = entrada.Icono;
                      return <Icon className="h-4 w-4" style={{ color }} />;
                    })()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold" style={{ color }}>
                      {entrada.nombre}
                    </p>
                    <p className="text-[10px] text-[var(--fin-ink-faint)] tabular-nums">
                      {formatCop(cambio.anteriorCop)} → {formatCop(cambio.actualCop)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className="text-xs font-extrabold tabular-nums"
                      style={{ color: subio ? 'var(--fin-out)' : 'var(--fin-in)' }}
                    >
                      {subio ? '+' : '−'}
                      {formatCop(Math.abs(cambio.deltaCop))}
                    </p>
                    <p className="text-[10px] font-semibold text-[var(--fin-ink-faint)]">
                      {nuevo
                        ? COPY.tendencias.nuevo
                        : desaparecio
                          ? COPY.tendencias.desaparecio
                          : cambio.deltaPct !== null
                            ? `${subio ? COPY.tendencias.subio : COPY.tendencias.bajo} ${Math.abs(cambio.deltaPct)}%`
                            : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      </div>
    </div>
  );
};
