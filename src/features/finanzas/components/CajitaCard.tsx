import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Trash2 } from 'lucide-react';
import { COPY } from '../copy';
import { iconoDeCajita } from '../cajitaIconos';
import type { CajitaMovKind } from '../data/modelos';
import { CAJITA_MOV_ICON, CAJITA_MOV_LABELS } from '../data/modelos';
import type { ResumenCajita } from '../lib/cajitas';
import { historialDeCajita } from '../lib/cajitas';
import { rendimientoEstimado } from '../lib/rendimiento';
import { bogotaDate } from '../lib/localDate';
import type { CajitaMovimiento } from '../data/modelos';
import { formatCop, formatAmountInput, parseAmountInput, parseSaldoInput, conPuntos } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface CajitaCardProps {
  resumen: ResumenCajita;
  movimientos: readonly CajitaMovimiento[];
  onFijarSaldo: (cajitaId: string, saldo: number) => void;
  onMovimiento: (cajitaId: string, kind: CajitaMovKind, deltaCop: number) => void;
  /** Other balances of the user's own that money can be moved to. */
  destinos?: readonly { id: string; nombre: string }[];
  /** Bank accounts only — where a withdrawal actually lands. */
  cuentasBancarias?: readonly { id: string; nombre: string }[];
  onTransferir?: (datos: { origenId: string; destinoId: string; montoCop: number }) => void;
  onEliminar: (cajitaId: string) => void;
}

type Accion = 'saldo' | 'deposito' | 'retiro' | 'rendimiento' | 'transferir';

/**
 * A bank account gets one action, not four.
 *
 * Deposits and withdrawals into an account are already recorded as income and
 * expenses in Movimientos — offering them here too would build a second,
 * disconnected history of the same money. What an account needs is simply to be
 * told its current balance; the app works out the difference from there.
 *
 * Pockets are different: money moved into a pocket is not income or spending,
 * so those movements have nowhere else to live.
 */
const ACCIONES_CAJITA: ReadonlyArray<{ id: Accion; label: string }> = [
  { id: 'saldo', label: COPY.cajitas.actualizarSaldo },
  { id: 'deposito', label: COPY.cajitas.depositar },
  { id: 'retiro', label: COPY.cajitas.retirar },
  { id: 'rendimiento', label: COPY.cajitas.rendimiento },
  { id: 'transferir', label: 'Transferir' },
];

const ACCIONES_CUENTA: ReadonlyArray<{ id: Accion; label: string }> = [
  { id: 'saldo', label: COPY.cajitas.actualizarSaldo },
  { id: 'transferir', label: 'Transferir' },
];

export const CajitaCard: React.FC<CajitaCardProps> = ({
  resumen,
  movimientos,
  onFijarSaldo,
  onMovimiento,
  destinos = [],
  cuentasBancarias = [],
  onTransferir,
  onEliminar,
}) => {
  const { cajita, saldoCop, pct } = resumen;
  const [accion, setAccion] = useState<Accion | null>(null);
  const otras = destinos.filter((d) => d.id !== cajita.id);
  // A withdrawal lands in a bank account; a transfer can go anywhere of yours.
  const bancos = cuentasBancarias.filter((d) => d.id !== cajita.id);
  const paraElegir = accion === 'retiro' ? bancos : otras;
  const [destinoId, setDestinoId] = useState<string>(otras[0]?.id ?? '');
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const esCuenta = cajita.tipo === 'cuenta';
  const T = esCuenta ? COPY.cuentas : COPY.cajitas;
  const ACCIONES = esCuenta ? ACCIONES_CUENTA : ACCIONES_CAJITA;
  const historial = historialDeCajita(movimientos, cajita.id);
  const rendimiento = esCuenta
    ? null
    : rendimientoEstimado(movimientos, cajita.id, cajita.tasaEaPct, bogotaDate());

  const abrirAccion = (siguiente: Accion) => {
    const misma = accion === siguiente;
    setAccion(misma ? null : siguiente);
    // "Update balance" starts from what the app currently believes, so the user
    // edits a number instead of retyping one they did not change.
    setTexto(misma ? '' : siguiente === 'saldo' ? formatAmountInput(saldoCop) : '');

    // The two actions offer different lists — a withdrawal lands in a bank
    // account, a transfer can go anywhere of yours — so the selection is
    // realigned here. Left alone, opening "Retirar" could carry over a pocket
    // that is not among the options the select is showing.
    if (!misma) {
      const lista = siguiente === 'retiro' ? bancos : otras;
      setDestinoId(lista[0]?.id ?? '');
    }
  };

  // Setting a balance accepts 0 (an emptied pocket); a $0 deposit or withdrawal
  // is not a movement at all.
  const leer = accion === 'saldo' ? parseSaldoInput : parseAmountInput;
  const valorActual = leer(texto);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = leer(texto);
    if (valor === null || accion === null) return;

    if (accion === 'saldo') onFijarSaldo(cajita.id, valor);
    else if (accion === 'transferir') {
      if (destinoId === '' || !onTransferir) return;
      onTransferir({ origenId: cajita.id, destinoId, montoCop: Math.abs(valor) });
    } else if (accion === 'retiro') {
      // Money leaving a pocket does not evaporate — it lands somewhere. Sending
      // it without saying where left the pocket right and every account wrong.
      if (destinoId === '' || !onTransferir) return;
      onTransferir({ origenId: cajita.id, destinoId, montoCop: Math.abs(valor) });
    } else onMovimiento(cajita.id, accion, Math.abs(valor));

    setAccion(null);
    setTexto('');
  };

  return (
    <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-soft)]"
          aria-hidden="true"
        >
          {(() => {
            const Icon = iconoDeCajita(cajita.icon);
            return <Icon className="h-6 w-6 text-[var(--fin-ink-soft)]" strokeWidth={1.5} />;
          })()}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold text-[var(--fin-ink)]">
            {cajita.nombre}
          </h3>
          <p className="text-[28px] font-semibold tabular-nums text-[var(--fin-ink)]">
            {formatCop(saldoCop)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmandoBorrado((v) => !v)}
          aria-label={`${T.eliminar}: ${cajita.nombre}`}
          className="shrink-0 rounded-[var(--fin-r-control)] p-1.5 text-[var(--fin-ink-ghost)] transition-colors hover:bg-[var(--fin-out-bg)] hover:text-[var(--fin-out)]"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Progress toward this pocket's own target */}
      {pct !== null && cajita.metaCop ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
            <div
              className="h-full rounded-[var(--fin-r-pill)] bg-[var(--fin-in)] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)] tabular-nums">
            {pct}% de {formatCop(cajita.metaCop)}
          </p>
        </div>
      ) : null}

      {/* Estimated yield. Derived, never stored: the balance must stay the sum of
 its movements, so inventing interest rows would make these numbers
 disagree with the bank's. */}
      {rendimiento ? (
        <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-in-bg)] px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-[var(--fin-in)]">
              {COPY.cajitas.rendimientoTitulo}
            </span>
            <span className="text-[13px] font-semibold text-[var(--fin-ink-faint)] tabular-nums">
              {cajita.tasaEaPct}% E.A.
            </span>
          </div>

          <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--fin-in)]">
            +{formatCop(rendimiento.acumuladoCop)}
          </p>
          <p className="text-[13px] text-[var(--fin-ink-faint)]">
            {COPY.cajitas.rendimientoAcumulado} {rendimiento.dias} {COPY.cajitas.rendimientoDias}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--fin-ink-soft)] tabular-nums">
            <span>
              <b className="text-[var(--fin-ink)]">{formatCop(rendimiento.diarioCop)}</b>{' '}
              {COPY.cajitas.rendimientoDiario}
            </span>
            <span>
              <b className="text-[var(--fin-ink)]">{formatCop(rendimiento.anualCop)}</b>{' '}
              {COPY.cajitas.rendimientoAnual}
            </span>
          </div>
        </div>
      ) : null}

      {confirmandoBorrado ? (
        <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] p-3">
          <p className="text-[13px] leading-relaxed text-[var(--fin-out-ink)]">
            {T.confirmarEliminar}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => onEliminar(cajita.id)}
              className="rounded-[var(--fin-r-pill)] bg-[var(--fin-out)] px-4 py-2 text-[15px] font-semibold text-white"
            >
              {T.eliminar}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
              className="rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] px-4 py-2 text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              {COPY.confirm.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ACCIONES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => abrirAccion(item.id)}
            aria-pressed={accion === item.id}
            className={`rounded-[var(--fin-r-pill)] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              accion === item.id
                ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {accion ? (
          <motion.form
            onSubmit={enviar}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-3">
              {accion === 'saldo' ? (
                <>
                  <p className="text-[15px] font-semibold text-[var(--fin-ink)]">
                    {T.cuantoTienes}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
                    {T.cuantoTienesHint}
                  </p>
                </>
              ) : null}

              <div className="mt-2 flex items-center gap-2 rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5">
                <span className="text-[20px] font-semibold text-[var(--fin-ink-faint)]">$</span>
                <input
                  value={texto}
                  onChange={(e) => setTexto(conPuntos(e.target.value))}
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
                  aria-label={ACCIONES.find((a) => a.id === accion)?.label}
                  className="w-full bg-transparent text-[20px] font-semibold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
                />
              </div>

              {accion === 'transferir' || accion === 'retiro' ? (
                <div className="mt-2.5">
                  <label
                    htmlFor={`destino-${cajita.id}`}
                    className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]"
                  >
                    {accion === 'retiro' ? '¿A qué cuenta la envías?' : '¿A cuál la pasas?'}
                  </label>
                  {paraElegir.length === 0 ? (
                    <p className="mt-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                      {accion === 'retiro'
                        ? 'Primero crea una cuenta bancaria. La plata que sale de aquí tiene que llegar a algún lado.'
                        : 'Necesitas otra cuenta o cajita para poder transferir.'}
                    </p>
                  ) : (
                    <select
                      id={`destino-${cajita.id}`}
                      value={destinoId}
                      onChange={(e) => setDestinoId(e.target.value)}
                      className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
                    >
                      {paraElegir.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  valorActual === null ||
                  ((accion === 'transferir' || accion === 'retiro') && destinoId === '')
                }
                className="mt-2.5 w-full rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-30"
              >
                {COPY.confirm.save}
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {/* History */}
      {historial.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="mt-3 flex w-full items-center justify-between rounded-[var(--fin-r-control)] px-1 py-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
          >
            {T.historial} ({historial.length})
            <ChevronDown
              className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
              strokeWidth={3}
            />
          </button>

          {abierto ? (
            <ul className="flex flex-col gap-1.5">
              {historial.map(({ movimiento, saldoDespues }) => (
                <li
                  key={movimiento.id}
                  className="flex items-center gap-2.5 rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] px-3 py-2"
                >
                  <span className="shrink-0" aria-hidden="true">
                    {(() => {
                      const Icon = CAJITA_MOV_ICON[movimiento.kind];
                      return <Icon className="h-4 w-4 text-[var(--fin-ink-faint)]" />;
                    })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--fin-ink)]">
                      {CAJITA_MOV_LABELS[movimiento.kind]}
                    </p>
                    <p className="text-[13px] text-[var(--fin-ink-faint)]">
                      {dayLabel(movimiento.occurredOn)} · saldo {formatCop(saldoDespues)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[13px] font-semibold tabular-nums"
                    style={{ color: movimiento.deltaCop >= 0 ? 'var(--fin-in)' : 'var(--fin-out)' }}
                  >
                    {movimiento.deltaCop >= 0 ? '+' : '−'}
                    {formatCop(Math.abs(movimiento.deltaCop))}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-3 px-1 text-[13px] text-[var(--fin-ink-faint)]">{T.sinMovimientos}</p>
      )}
    </section>
  );
};
