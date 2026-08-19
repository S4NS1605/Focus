import React from 'react';
import { Search, X } from 'lucide-react';
import { useCatalogo } from '../catalogoContexto';
import { formatCop } from '../lib/formatCop';
import { FILTRO_VACIO, filtroActivo, resumirFiltrado } from '../lib/filtros';
import type { Filtro } from '../lib/filtros';
import type { Transaction } from '../types';

interface BuscadorMovimientosProps {
  filtro: Filtro;
  onCambiar: (filtro: Filtro) => void;
  /** The rows the current filter produced, for the running total. */
  resultados: readonly Transaction[];
  cuentas: readonly { id: string; nombre: string }[];
}

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

export const BuscadorMovimientos: React.FC<BuscadorMovimientosProps> = ({
  filtro,
  onCambiar,
  resultados,
  cuentas,
}) => {
  const catalogo = useCatalogo();
  const activo = filtroActivo(filtro);
  const resumen = resumirFiltrado(resultados);

  const cambiar = (parcial: Partial<Filtro>) => onCambiar({ ...filtro, ...parcial });

  return (
    <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fin-ink-faint)]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <input
          value={filtro.texto}
          onChange={(e) => cambiar({ texto: e.target.value })}
          placeholder="Buscar por quién, en qué, o cuánto"
          aria-label="Buscar movimientos"
          type="search"
          className={`${CAMPO} pl-9`}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={filtro.kind ?? ''}
          onChange={(e) => cambiar({ kind: (e.target.value || null) as Filtro['kind'] })}
          aria-label="Tipo"
          className={`${CAMPO} w-auto flex-1`}
        >
          <option value="">Todo</option>
          <option value="gasto">Solo gastos</option>
          <option value="ingreso">Solo ingresos</option>
        </select>

        <select
          value={filtro.categoria ?? ''}
          onChange={(e) => cambiar({ categoria: e.target.value || null })}
          aria-label="Categoría"
          className={`${CAMPO} w-auto flex-1`}
        >
          <option value="">Toda categoría</option>
          {catalogo.lista.map((c) => (
            <option key={c.clave} value={c.clave}>
              {c.nombre}
            </option>
          ))}
        </select>

        {cuentas.length > 0 ? (
          <select
            value={filtro.cuentaId ?? ''}
            onChange={(e) => cambiar({ cuentaId: e.target.value || null })}
            aria-label="Cuenta"
            className={`${CAMPO} w-auto flex-1`}
          >
            <option value="">Toda cuenta</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Only once something is being filtered. Said plainly, because the list
 below has quietly stopped being "this month" and is now the whole
 ledger — a search that only looked at the visible month would mean
 stepping back through the calendar to find anything. */}
      {activo ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] px-3.5 py-2.5">
          <p className="text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            <b className="text-[var(--fin-ink)]">
              {resumen.cuantos} movimiento{resumen.cuantos === 1 ? '' : 's'}
            </b>{' '}
            en todo tu historial
            {resumen.gastoCop > 0 ? (
              <>
                {' '}
                · sale <b className="text-[var(--fin-out)]">{formatCop(resumen.gastoCop)}</b>
              </>
            ) : null}
            {resumen.ingresoCop > 0 ? (
              <>
                {' '}
                · entra <b className="text-[var(--fin-in)]">{formatCop(resumen.ingresoCop)}</b>
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => onCambiar(FILTRO_VACIO)}
            className="flex shrink-0 items-center gap-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            Limpiar
          </button>
        </div>
      ) : null}
    </section>
  );
};
