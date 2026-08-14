import React from 'react';
import { Banknote, Landmark, PiggyBank, Plus, Wallet } from 'lucide-react';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import { ID_EFECTIVO, ID_EFECTIVO_VIEJO } from '../data/modelos';
import { patrimonio, saldoDeCajita } from '../lib/cajitas';
import { formatCop } from '../lib/formatCop';

interface PatrimonioCardProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  /** Jumps to where accounts are added, so the empty state is not a dead end. */
  onAgregar?: () => void;
  /**
   * Whether savings count here.
   *
   * When off they leave the headline as well as the tile. Hiding only the tile
   * would leave a total that silently includes a figure the user cannot see —
   * the parts would stop adding up to the whole, which is exactly the kind of
   * quiet disagreement this app is built to avoid.
   */
  mostrarAhorro?: boolean;
}

/**
 * What the user has right now, as opposed to what moved this month.
 *
 * Kept apart from the month's balance on purpose: a month can close in the red
 * while the accounts are perfectly healthy, and showing one number for both is
 * how a summary ends up alarming for no reason.
 */
export const PatrimonioCard: React.FC<PatrimonioCardProps> = ({
  cajitas,
  movimientos,
  transacciones,
  onAgregar,
  mostrarAhorro = true,
}) => {
  const total = patrimonio(cajitas, movimientos, transacciones);
  const encabezado = mostrarAhorro ? total.totalCop : total.cuentasCop;

  // Cuánto de lo que hay en cuentas es plata en la mano y cuánto está en el
  // banco. Se suma también el id viejo de Efectivo por si algún dato quedó sin
  // migrar; en un proyecto ya migrado ese sumando es cero.
  const efectivoCop =
    saldoDeCajita(movimientos, ID_EFECTIVO, transacciones) +
    saldoDeCajita(movimientos, ID_EFECTIVO_VIEJO, transacciones);
  const cuentasBancariasCop = total.cuentasCop - efectivoCop;
  // El desglose solo aparece cuando hay efectivo que distinguir. Sin él, separar
  // "Efectivo $0" y repetir el resto sería ruido, no información.
  const hayEfectivo = efectivoCop !== 0;

  const recuadros = [
    ...(hayEfectivo
      ? [
          { label: 'Efectivo', valor: efectivoCop, Icono: Banknote },
          { label: 'En cuentas', valor: cuentasBancariasCop, Icono: Landmark },
        ]
      : [{ label: 'En cuentas', valor: total.cuentasCop, Icono: Landmark }]),
    ...(mostrarAhorro ? [{ label: 'En cajitas', valor: total.cajitasCop, Icono: PiggyBank }] : []),
  ];

  // Se muestra cuando cuenta los ahorros (como siempre) o cuando hay un desglose
  // de efectivo que enseñar. Sin ahorros y sin efectivo, el titular YA es lo que
  // hay en cuentas y repetirlo debajo se leería como dos datos cuando hay uno.
  const mostrarRecuadros = mostrarAhorro || hayEfectivo;

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
        {/* The heading changes with the number rather than staying put above a
            narrower figure. "Lo que tienes ahora" over an accounts-only total
            is a promise the number does not keep — and for someone whose money
            is all in cajitas it reads as "you have $0". */}
        {mostrarAhorro ? 'Lo que tienes ahora' : 'Lo que tienes en cuentas'}
      </h2>

      <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[var(--fin-ink)]">
        {formatCop(encabezado)}
      </p>

      {/* Only when something is actually being left out. Announcing hidden
          savings to someone who has none invents money that does not exist. */}
      {!mostrarAhorro && total.cajitasCop !== 0 ? (
        <p className="mt-1 text-[11px] font-bold text-[var(--fin-ink-faint)]">
          Sin contar {formatCop(total.cajitasCop)} en ahorros
        </p>
      ) : null}

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

      {/* Efectivo aparte de las cuentas del banco, y las cajitas cuando cuentan.
          El desglose reparte el titular en sus partes reales, así que no lo
          repite: dice de qué está hecho. */}
      {/* Siempre dos columnas: tres casillas caben como 2+1 (efectivo y cuentas
          arriba, cajitas abajo). Tres en fila apretaban los montos de siete
          cifras en un teléfono hasta cortarlos. */}
      {mostrarRecuadros ? (
      <div className="mt-4 grid grid-cols-2 gap-3">
        {recuadros.map((fila) => (
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
      ) : null}
    </section>
  );
};
