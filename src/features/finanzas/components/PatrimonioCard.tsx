import React from 'react';
import { Landmark, PiggyBank, Plus, Wallet } from 'lucide-react';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import { patrimonio } from '../lib/cajitas';
import { formatCop } from '../lib/formatCop';

interface PatrimonioCardProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  /** Jumps to where accounts are added, so the empty state is not a dead end. */
  onAgregar?: () => void;
}

/**
 * What the user has right now, as opposed to what moved this month.
 *
 * Kept apart from the month's balance on purpose: a month can close in the red
 * while the accounts are perfectly healthy, and showing one number for both is
 * how a summary ends up alarming for no reason.
 */
export const PatrimonioCard: React.FC<PatrimonioCardProps> = ({ cajitas, movimientos, transacciones, onAgregar }) => {
  const total = patrimonio(cajitas, movimientos, transacciones);

  if (cajitas.length === 0) {
    return (
      <section className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-8 text-center">
        <Wallet
          className="mx-auto h-8 w-8 text-[var(--fin-ink-ghost)]"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">
          Registra tus cuentas para ver cuánto tienes
        </p>
        <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">
          Agrega tu banco y dile cuánto tienes: la app lleva el resto.
        </p>

        {/* Telling someone where to go and not taking them there is what made
            this feature look absent — the instruction was the dead end. */}
        {onAgregar ? (
          <button
            type="button"
            onClick={onAgregar}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--fin-accent)] px-5 py-2.5 text-xs font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
            Agregar cuenta bancaria
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <Wallet className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        Lo que tienes ahora
      </h2>

      <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[var(--fin-ink)]">
        {formatCop(total.totalCop)}
      </p>

      {onAgregar ? (
        <button
          type="button"
          onClick={onAgregar}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--fin-soft)] px-3.5 py-2 text-[11px] font-bold text-[var(--fin-ink-soft)] transition-colors hover:text-[var(--fin-ink)]"
        >
          <Plus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          Agregar o actualizar cuentas
        </button>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: 'En cuentas', valor: total.cuentasCop, Icono: Landmark },
          { label: 'En cajitas', valor: total.cajitasCop, Icono: PiggyBank },
        ].map((fila) => (
          <div key={fila.label} className="rounded-2xl bg-[var(--fin-bg)] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--fin-ink-faint)]">
              <fila.Icono className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              {fila.label}
            </p>
            <p className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-[var(--fin-ink)]">
              {formatCop(fila.valor)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
