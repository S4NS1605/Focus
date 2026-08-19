import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction } from '../types';
import type { CategorySlice, MonthTotals } from '../lib/aggregate';
import { formatCop } from '../lib/formatCop';
import { monthKeyLabel } from '../lib/localDate';
import { CategoryBreakdown } from './CategoryBreakdown';
import { DetalleMes } from './DetalleMes';
import { TendenciasView } from './TendenciasView';

interface MesViewProps {
  month: string;
  maxMonth: string;
  onCambiarMes: (mes: string) => void;
  shift: (mes: string, pasos: number) => string;
  totals: MonthTotals;
  gastos: readonly CategorySlice[];
  ingresos: readonly CategorySlice[];
  delMes: readonly Transaction[];
  transacciones: readonly Transaction[];
  /** Los topes de gasto, que se editan desde Ajustes pero se leen aquí. */
  topes?: React.ReactNode;
}

/**
 * "Mes": todo lo que la app calcula a partir de tus movimientos.
 *
 * Esta es la pantalla que puede medir 3.000 píxeles, y está bien que los mida:
 * aquí uno entra a estudiar cómo le fue, no a mirar de pasada. El problema
 * antes era que TODO esto vivía en la pantalla de inicio, o sea en la que se
 * abre veinte veces al día para anotar un almuerzo. Mezclar las dos cosas
 * obligaba a bajar cinco pantallas para llegar a lo que se usa a diario.
 *
 * Aquí sí tiene sentido el balance del mes como número grande: es la respuesta
 * a la pregunta que uno viene a hacer. En Inicio no lo tenía, porque allá la
 * pregunta es otra ("cuánto tengo") y dos números gigantes juntos no dejan ver
 * ninguno de los dos.
 */
export const MesView: React.FC<MesViewProps> = ({
  month,
  maxMonth,
  onCambiarMes,
  shift,
  totals,
  gastos,
  ingresos,
  delMes,
  transacciones,
  topes,
}) => {
  const positivo = totals.balance >= 0;
  const anterior = shift(month, -1);
  const siguiente = shift(month, 1);
  // No se puede navegar al futuro: no hay nada que mirar allá.
  const haySiguiente = siguiente <= maxMonth;

  return (
    <div className="flex flex-col gap-8">
      {/* El selector de mes, que aquí sí merece su fila: es el control principal
 de la pantalla, porque todo lo de abajo depende de él. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onCambiarMes(anterior)}
          aria-label="Mes anterior"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <h1
          className="capitalize text-[var(--fin-ink)]"
          style={{ font: 'var(--fin-t-titulo)', letterSpacing: 'var(--fin-track-titulo)' }}
        >
          {monthKeyLabel(month)}
        </h1>
        <button
          type="button"
          onClick={() => haySiguiente && onCambiarMes(siguiente)}
          disabled={!haySiguiente}
          aria-label="Mes siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div>
        <p className="text-center text-[13px] text-[var(--fin-ink-faint)]">
          {positivo ? 'Te sobró' : 'Te faltó'}
        </p>
        <p
          className="mt-1 text-center tabular-nums"
          style={{
            font: 'var(--fin-t-cifra)',
            letterSpacing: 'var(--fin-track-cifra)',
            color: positivo ? 'var(--fin-in)' : 'var(--fin-out)',
          }}
        >
          {formatCop(totals.balance)}
        </p>
        <p className="mt-2 text-center text-[15px] text-[var(--fin-ink-soft)] tabular-nums">
          Entró {formatCop(totals.ingresos)} · Salió {formatCop(totals.gastos)}
        </p>
      </div>

      {topes}

      {/* Un solo dibujo por dato. Antes el reparto por categoría se pintaba dos
 veces en la misma pantalla —una barra apilada arriba y estas barras
 horizontales abajo— y encima con distinta precisión: la misma categoría
 podía leerse 23% en un sitio y 22,6% en el otro. */}
      <CategoryBreakdown title="En qué se te va" slices={gastos} />
      <CategoryBreakdown title="De dónde entra" slices={ingresos} />

      <DetalleMes delMes={delMes} transacciones={transacciones} mes={month} />

      <TendenciasView transacciones={transacciones} mes={month} />
    </div>
  );
};
