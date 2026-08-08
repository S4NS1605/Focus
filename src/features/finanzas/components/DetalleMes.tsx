import React from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Users } from 'lucide-react';
import type { Transaction, TxKind } from '../types';
import { CATEGORY_COLOR, CATEGORY_ICON, CATEGORY_LABELS } from '../types';
import { mayoresMovimientos, porDiaDelMes, resumenDelMes, topContrapartes } from '../lib/detalle';
import { formatCop } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface DetalleMesProps {
  /** Already filtered to the month on display. */
  delMes: readonly Transaction[];
  /** Full ledger, needed to place the month on the calendar. */
  transacciones: readonly Transaction[];
  mes: string;
}

const Contrapartes: React.FC<{ delMes: readonly Transaction[]; kind: TxKind }> = ({
  delMes,
  kind,
}) => {
  const filas = topContrapartes(delMes, kind);
  if (filas.length === 0) return null;

  const mayor = filas[0].totalCop;
  const gasto = kind === 'gasto';

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <Users className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {gasto ? 'A quién le mandaste' : 'Quién te mandó'}
      </h2>

      <ul className="mt-3 flex flex-col gap-2.5">
        {filas.map((fila) => (
          <li key={fila.nombre}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-bold text-[var(--fin-ink)]">{fila.nombre}</span>
              <span
                className="shrink-0 text-xs font-extrabold tabular-nums"
                style={{ color: gasto ? 'var(--fin-out)' : 'var(--fin-in)' }}
              >
                {formatCop(fila.totalCop)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--fin-soft)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(fila.totalCop / mayor) * 100}%`,
                    backgroundColor: gasto ? 'var(--fin-out)' : 'var(--fin-in)',
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] text-[var(--fin-ink-faint)] tabular-nums">
                {fila.veces}×
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

const Mayores: React.FC<{ delMes: readonly Transaction[] }> = ({ delMes }) => {
  const gastos = mayoresMovimientos(delMes, 'gasto');
  if (gastos.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        Tus gastos más grandes
      </h2>

      <ul className="mt-3 flex flex-col gap-2">
        {gastos.map((tx) => {
          const color = CATEGORY_COLOR[tx.category];
          const Icono = CATEGORY_ICON[tx.category];
          return (
            <li
              key={tx.id}
              className="flex items-center gap-3 rounded-2xl bg-[var(--fin-bg)] px-3 py-2.5"
            >
              <Icono className="h-4 w-4 shrink-0" style={{ color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[var(--fin-ink)]">{tx.description}</p>
                <p className="text-[10px] text-[var(--fin-ink-faint)]">
                  {dayLabel(tx.occurredOn)} · {CATEGORY_LABELS[tx.category]}
                </p>
              </div>
              <span className="shrink-0 text-xs font-extrabold tabular-nums text-[var(--fin-out)]">
                {formatCop(tx.amountCop)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const PorDia: React.FC<{ transacciones: readonly Transaction[]; mes: string }> = ({
  transacciones,
  mes,
}) => {
  const dias = porDiaDelMes(transacciones, mes);
  const resumen = resumenDelMes(transacciones, mes);
  if (resumen.diasConGasto === 0) return null;

  // Scaled to the heaviest day so the tallest bar always fills the track and the
  // rest stay honestly proportional to it.
  const techo = Math.max(...dias.map((d) => d.gastoCop), 1);

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        En qué días se fue
      </h2>

      {/* One column per day, empty ones included: the gaps are what show that
          spending was a few heavy days rather than a steady drip. */}
      <div className="mt-4 flex h-24 items-end gap-[2px]">
        {dias.map((d) => (
          <div
            key={d.fecha}
            className="group relative flex-1 rounded-t-sm bg-[var(--fin-out)] transition-opacity hover:opacity-100"
            style={{
              height: `${Math.max(d.gastoCop > 0 ? 4 : 1, (d.gastoCop / techo) * 100)}%`,
              opacity: d.gastoCop > 0 ? 0.85 : 0.18,
            }}
            title={`${d.dia}: ${formatCop(d.gastoCop)}`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--fin-ink-faint)] tabular-nums">
        <span>1</span>
        <span>{Math.ceil(dias.length / 2)}</span>
        <span>{dias.length}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--fin-soft)] pt-3">
        <div>
          <p className="text-[10px] font-bold text-[var(--fin-ink-faint)]">Días con gasto</p>
          <p className="font-display text-base font-extrabold tabular-nums text-[var(--fin-ink)]">
            {resumen.diasConGasto}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--fin-ink-faint)]">Promedio por día</p>
          <p className="font-display text-base font-extrabold tabular-nums text-[var(--fin-ink)]">
            {formatCop(resumen.promedioPorDiaActivoCop)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--fin-ink-faint)]">Día más caro</p>
          <p className="font-display text-base font-extrabold tabular-nums text-[var(--fin-ink)]">
            {resumen.diaMasCaro ? formatCop(resumen.diaMasCaro.gastoCop) : '—'}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-[var(--fin-ink-faint)]">
        El promedio cuenta solo los días en que gastaste, no los {dias.length} del mes.
      </p>
    </section>
  );
};

const Entradas: React.FC<{ delMes: readonly Transaction[] }> = ({ delMes }) => {
  const ingresos = mayoresMovimientos(delMes, 'ingreso', 3);
  if (ingresos.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        Tus mayores entradas
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {ingresos.map((tx) => (
          <li
            key={tx.id}
            className="flex items-center gap-3 rounded-2xl bg-[var(--fin-bg)] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--fin-ink)]">{tx.description}</p>
              <p className="text-[10px] text-[var(--fin-ink-faint)]">{dayLabel(tx.occurredOn)}</p>
            </div>
            <span className="shrink-0 text-xs font-extrabold tabular-nums text-[var(--fin-in)]">
              {formatCop(tx.amountCop)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * The detail a category breakdown cannot give.
 *
 * "Transferencia: $2.000.000" is no more useful than the "Otros" it replaced —
 * on a wallet-heavy account most of the month is transfers, so the question
 * worth answering is who, when, and which ones were big.
 */
export const DetalleMes: React.FC<DetalleMesProps> = ({ delMes, transacciones, mes }) => (
  <div className="flex flex-col gap-5">
    <PorDia transacciones={transacciones} mes={mes} />
    <Mayores delMes={delMes} />
    <Contrapartes delMes={delMes} kind="gasto" />
    <Contrapartes delMes={delMes} kind="ingreso" />
    <Entradas delMes={delMes} />
  </div>
);
