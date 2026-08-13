import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Plus, Tag, X } from 'lucide-react';
import type { Transaction } from '../types';
import { balanceConAlias, movimientosDeAlias } from '../lib/contactos';
import { useCatalogo } from '../catalogoContexto';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { formatCop } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface DetalleContactoProps {
  nombre: string;
  /** Cómo le dices tú. Ausente cuando la fila no es un contacto guardado. */
  apodos?: readonly string[];
  onAgregarApodo?: (apodo: string) => void;
  onQuitarApodo?: (apodo: string) => void;
  /** Las grafías normalizadas que son esta persona. */
  alias: readonly string[];
  transacciones: readonly Transaction[];
  onCerrar: () => void;
}

/**
 * Todo lo que has movido con alguien.
 *
 * La lista de contactos respondía cuántos movimientos, no cuáles — y "3
 * movimientos" no sirve para reconocer a nadie. Aquí sí se ve qué le mandaste,
 * cuándo, y en qué quedó la cuenta entre los dos.
 */
export const DetalleContacto: React.FC<DetalleContactoProps> = ({
  nombre,
  apodos,
  onAgregarApodo,
  onQuitarApodo,
  alias,
  transacciones,
  onCerrar,
}) => {
  useBloqueoScroll(true);
  const [nuevoApodo, setNuevoApodo] = useState('');
  const catalogo = useCatalogo();

  const movimientos = movimientosDeAlias(transacciones, alias);
  const balance = balanceConAlias(transacciones, alias);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--fin-scrim)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Movimientos con ${nombre}`}
      onClick={onCerrar}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[2rem] bg-[var(--fin-bg)] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-extrabold tracking-tight text-[var(--fin-ink)]">
              {nombre}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--fin-ink-faint)]">
              {movimientos.length} movimiento{movimientos.length === 1 ? '' : 's'}
              {alias.length > 1 ? ` · ${alias.length} formas de escribirlo` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        {/* En qué quedó la cuenta entre los dos. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[var(--fin-card)] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--fin-ink-faint)]">
              <ArrowUpCircle className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              Le mandaste
            </p>
            <p className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-[var(--fin-out)]">
              {formatCop(balance.salioCop)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--fin-card)] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--fin-ink-faint)]">
              <ArrowDownCircle className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              Te mandó
            </p>
            <p className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-[var(--fin-in)]">
              {formatCop(balance.entroCop)}
            </p>
          </div>
        </div>

        {balance.netoCop !== 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-soft)]">
            {balance.netoCop > 0 ? (
              <>
                En total te ha entrado{' '}
                <b className="text-[var(--fin-in)]">{formatCop(balance.netoCop)}</b> más de lo que
                le has mandado.
              </>
            ) : (
              <>
                En total le has mandado{' '}
                <b className="text-[var(--fin-out)]">{formatCop(-balance.netoCop)}</b> más de lo
                que te ha entrado.
              </>
            )}
          </p>
        ) : null}

        {/* Cómo le dices tú. Con esto, decir "le mandé 20 mil a mi pa" deja
            escrito quién es en vez de "pa". */}
        {onAgregarApodo ? (
          <div className="mt-4 rounded-2xl bg-[var(--fin-card)] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]">
              <Tag className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              Cómo le dices
            </p>

            {apodos && apodos.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {apodos.map((apodo) => (
                  <li key={apodo}>
                    <button
                      type="button"
                      onClick={() => onQuitarApodo?.(apodo)}
                      aria-label={`Quitar el apodo ${apodo}`}
                      className="flex items-center gap-1 rounded-full bg-[var(--fin-soft)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--fin-ink-soft)] hover:text-[var(--fin-out)]"
                    >
                      {apodo}
                      <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (nuevoApodo.trim() === '') return;
                onAgregarApodo(nuevoApodo);
                setNuevoApodo('');
              }}
              className="mt-2 flex items-center gap-2"
            >
              <input
                value={nuevoApodo}
                onChange={(e) => setNuevoApodo(e.target.value)}
                placeholder="pa, ana riaza, el jefe…"
                aria-label={`Nuevo apodo para ${nombre}`}
                className="w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-base font-medium text-[var(--fin-ink)] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Agregar apodo"
                className="shrink-0 rounded-xl bg-[var(--fin-soft)] p-2.5 text-[var(--fin-ink-soft)]"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </button>
            </form>
          </div>
        ) : null}

        <ul className="mt-4 flex flex-col gap-1.5">
          {movimientos.map((tx) => {
            const entrada = catalogo.de(tx.category);
            const esIngreso = tx.kind === 'ingreso';
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl bg-[var(--fin-card)] px-3.5 py-3"
              >
                <entrada.Icono
                  className="h-4 w-4 shrink-0"
                  style={{ color: entrada.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-[var(--fin-ink)]">
                    {tx.description}
                  </span>
                  <span className="block text-[10px] text-[var(--fin-ink-faint)]">
                    {dayLabel(tx.occurredOn)} · {entrada.nombre}
                  </span>
                </span>
                <span
                  className="shrink-0 text-sm font-extrabold tabular-nums"
                  style={{ color: esIngreso ? 'var(--fin-in)' : 'var(--fin-out)' }}
                >
                  {esIngreso ? '+' : '−'}
                  {formatCop(tx.amountCop)}
                </span>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </motion.div>
  );
};
