import React, { useState } from 'react';
import { ChevronDown, Check, Pencil, Send, Trash2, X } from 'lucide-react';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import { TIPO_LABELS } from '../data/modelos';
import type { Transaction } from '../types';
import { formatAmountInput, conPuntos, formatCop, parseAmountInput, parseSaldoInput } from '../lib/formatCop';
import { saldoDeCajita } from '../lib/cajitas';
import { iconoDeCajita } from '../cajitaIconos';

interface DetalleCajitaProps {
  cajita: Cajita;
  movimientos: readonly CajitaMovimiento[];
  transacciones: readonly Transaction[];
  onFijarSaldo: (cajitaId: string, saldo: number) => void;
  onEliminar: (id: string) => void;
  onTransferir?: (origenId: string, destinoId: string, montoCop: number) => void;
  destinos?: readonly { id: string; nombre: string }[];
}

/**
 * Detalle de una sola cuenta/cajita (no una lista).
 * Se abre cuando haces click en una cuenta desde "Dinero".
 * Permite: ver saldo, actualizar, transferir, eliminar.
 *
 * El saldo se cambia tocando la cifra, no un botón aparte. La cifra ES el dato
 * que se quiere cambiar, así que tocarla es el gesto que la gente intenta
 * primero; un botón "Actualizar saldo" debajo obligaba a leer para encontrar
 * algo que ya se estaba mirando.
 *
 * En modo edición los botones ✓/✗ van en su PROPIA fila debajo del input,
 * nunca al lado. Con un texto de 32–40px el campo solo ya ocupa casi todo el
 * ancho de la pantalla en un iPhone; si además los botones van en la misma
 * fila se salen del viewport y quedan cortados fuera de pantalla a la derecha.
 */
export const DetalleCajita: React.FC<DetalleCajitaProps> = ({
  cajita,
  movimientos,
  transacciones,
  onFijarSaldo,
  onEliminar,
  onTransferir,
  destinos = [],
}) => {
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [nuevoSaldoTexto, setNuevoSaldoTexto] = useState('');
  const [mostrarAjustes, setMostrarAjustes] = useState(false);
  const [transfiriendo, setTransfiriendo] = useState(false);
  const [destinoId, setDestinoId] = useState('');
  const [montoTexto, setMontoTexto] = useState('');
  const [errorTransferencia, setErrorTransferencia] = useState<string | null>(null);

  const saldo = saldoDeCajita(movimientos, cajita.id, transacciones);
  const Icono = iconoDeCajita(cajita.icon);
  const propios = movimientos.filter((m) => m.cajitaId === cajita.id);
  // Transferirse a sí misma no es una operación, es un no-op con dos apuntes.
  const destinosPosibles = destinos.filter((d) => d.id !== cajita.id);

  const abrirEditarSaldo = () => {
    setNuevoSaldoTexto(formatAmountInput(saldo));
    setEditandoSaldo(true);
  };

  const guardarSaldo = () => {
    const nuevo = parseSaldoInput(nuevoSaldoTexto);
    if (nuevo === null) return;
    onFijarSaldo(cajita.id, nuevo);
    setEditandoSaldo(false);
    setNuevoSaldoTexto('');
  };

  const abrirTransferir = () => {
    setDestinoId(destinosPosibles[0]?.id ?? '');
    setMontoTexto('');
    setTransfiriendo(true);
  };

  const confirmarTransferir = async () => {
    const monto = parseAmountInput(montoTexto);
    if (!onTransferir || destinoId === '' || monto === null) {
      const razon = !onTransferir ? 'sin callback' : destinoId === '' ? 'sin destino' : 'monto inválido';
      setErrorTransferencia('Error: ' + razon);
      return;
    }
    try {
      await onTransferir(cajita.id, destinoId, monto);
      setTransfiriendo(false);
      setMontoTexto('');
      setDestinoId('');
      setErrorTransferencia(null);
    } catch (err) {
      setErrorTransferencia('Error en la transferencia. Intenta de nuevo.');
    }
  };

  const confirmarEliminar = () => {
    if (confirm(`¿Eliminar ${cajita.nombre}? Esta acción no se puede deshacer.`)) {
      onEliminar(cajita.id);
    }
  };

  const puedeTransferir = onTransferir !== undefined && destinosPosibles.length > 0;
  const montoValido = parseAmountInput(montoTexto) !== null && destinoId !== '';

  const claseCampo =
    'mt-3 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-bg)] px-4 py-3 text-[17px] tabular-nums text-[var(--fin-ink)]';

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera con icono y nombre */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-soft)]">
          <Icono className="h-7 w-7 text-[var(--fin-ink-soft)]" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-[22px] font-semibold leading-tight text-[var(--fin-ink)]">{cajita.nombre}</h1>
          <p className="mt-0.5 text-[13px] text-[var(--fin-ink-faint)]">
            {TIPO_LABELS[cajita.tipo]}
          </p>
        </div>
      </div>

      {/* Saldo actual. La cifra entera es el botón de editar. */}
      <section
        className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5"
        style={{ backdropFilter: 'var(--fin-glass-filter)', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.6)' }}
      >
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--fin-ink-faint)]">Saldo actual</p>

        {!editandoSaldo ? (
          <>
            <button
              type="button"
              onClick={abrirEditarSaldo}
              aria-label={`Cambiar el saldo de ${cajita.nombre}`}
              className="mt-3 flex w-full items-baseline gap-3 rounded-[var(--fin-r-card)] text-left transition-opacity active:opacity-60"
            >
              <span
                className="text-[44px] font-bold tabular-nums leading-none text-[var(--fin-ink)]"
                style={{ letterSpacing: 'var(--fin-track-cifra)' }}
              >
                {formatCop(saldo)}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[var(--fin-soft)] px-2.5 py-1 text-[12px] font-medium text-[var(--fin-ink-soft)]">
                <Pencil className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                Editar
              </span>
            </button>
            <p className="mt-2 text-[12px] text-[var(--fin-ink-faint)]">Toca la cifra para actualizarla</p>
          </>
        ) : (
          /* En modo edición, el input ocupa toda la fila y los botones van en
             su propia fila debajo. Antes el flex horizontal (input + dos botones
             de 48×48) se desbordaba fuera del viewport en pantallas estrechas
             y los botones quedaban cortados a la derecha. */
          <div className="mt-3 flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={nuevoSaldoTexto}
              onChange={(e) => setNuevoSaldoTexto(conPuntos(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardarSaldo();
                if (e.key === 'Escape') setEditandoSaldo(false);
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              autoFocus
              className="w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-accent)] bg-[var(--fin-bg)] px-4 py-3.5 text-[32px] font-bold tabular-nums text-[var(--fin-ink)] focus:outline-none"
              style={{ letterSpacing: 'var(--fin-track-cifra)' }}
            />
            {/* Botones en fila propia — nunca al lado del input grande */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditandoSaldo(false)}
                aria-label="Cancelar"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] py-3 text-[14px] font-semibold text-[var(--fin-ink-soft)] transition-opacity hover:opacity-80"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarSaldo}
                disabled={parseSaldoInput(nuevoSaldoTexto) === null}
                aria-label="Guardar saldo"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] py-3 text-[14px] font-semibold text-[var(--fin-on-accent)] transition-opacity disabled:opacity-40"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Guardar
              </button>
            </div>
          </div>
        )}

        {cajita.metaCop && cajita.metaCop > 0 ? (
          <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
              <div
                className="h-full rounded-[var(--fin-r-pill)] bg-[var(--fin-in)] transition-all"
                style={{ width: `${Math.min(100, (saldo / cajita.metaCop) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-[var(--fin-ink-faint)]">
              {Math.round((saldo / cajita.metaCop) * 100)}% de {formatCop(cajita.metaCop)}
            </p>
          </>
        ) : null}
      </section>

      {puedeTransferir ? (
        <button
          type="button"
          onClick={abrirTransferir}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-ink)] px-4 py-3.5 text-[15px] font-semibold text-[var(--fin-bg)] transition-opacity hover:opacity-80 active:opacity-70"
        >
          <Send className="h-4 w-4" strokeWidth={2.5} />
          Enviar dinero a otra cuenta
        </button>
      ) : (
        <div className="rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] px-4 py-3.5 text-center">
          <p className="text-[13px] text-[var(--fin-ink-faint)]">
            Necesitas al menos 2 cuentas para transferir
          </p>
        </div>
      )}

      {/* Ajustes avanzados */}
      <section>
        <button
          type="button"
          onClick={() => setMostrarAjustes(!mostrarAjustes)}
          className="flex w-full items-center justify-between rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-4 py-3.5 text-[14px] font-medium text-[var(--fin-ink)]"
        >
          <span>Historial de ajustes</span>
          <span className="flex items-center gap-2 text-[var(--fin-ink-faint)]">
            <span className="rounded-full bg-[var(--fin-line)] px-2 py-0.5 text-[12px] font-semibold">
              {propios.length}
            </span>
            <ChevronDown
              className="h-4 w-4 transition-transform"
              style={{ transform: mostrarAjustes ? 'rotate(180deg)' : undefined }}
            />
          </span>
        </button>

        {mostrarAjustes ? (
          <div className="mt-2 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
            <p className="text-[13px] text-[var(--fin-ink-faint)]">
              {propios.length} ajuste{propios.length !== 1 ? 's' : ''} registrado{propios.length !== 1 ? 's' : ''}
            </p>
          </div>
        ) : null}
      </section>

      {/* Eliminar — zona de peligro separada visualmente */}
      <div className="pt-1">
        <button
          type="button"
          onClick={confirmarEliminar}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-600 transition-opacity hover:opacity-80 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar cuenta
        </button>
      </div>


      {/* Modal de transferir — sheet desde abajo en móvil, modal centrado en escritorio */}
      {transfiriendo ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center">
          <div
            className="w-full max-w-sm rounded-t-[28px] bg-[var(--fin-card)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[var(--fin-r-card)]"
            style={{ boxShadow: '0 -4px 32px rgb(0 0 0 / 0.12)' }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">
                Enviar desde {cajita.nombre}
              </h2>
              <button
                type="button"
                onClick={() => { setTransfiriendo(false); setDestinoId(''); setMontoTexto(''); }}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            <label className="block text-[12px] font-medium uppercase tracking-wider text-[var(--fin-ink-faint)]" htmlFor="destino">
              Hacia
            </label>
            <select
              id="destino"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="mt-2 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-bg)] px-4 py-3 text-[16px] text-[var(--fin-ink)] focus:border-[var(--fin-accent)] focus:outline-none"
            >
              <option value="">— Elige la cuenta destino —</option>
              {destinosPosibles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>

            <label className="mt-5 block text-[12px] font-medium uppercase tracking-wider text-[var(--fin-ink-faint)]" htmlFor="monto">
              Cuánto
            </label>
            <input
              id="monto"
              type="text"
              inputMode="numeric"
              value={montoTexto}
              onChange={(e) => setMontoTexto(conPuntos(e.target.value))}
              placeholder="0"
              autoFocus
              className={claseCampo}
            />

            {errorTransferencia && (
              <p className="mt-2 text-[13px] font-semibold text-[var(--fin-warn)]">
                {errorTransferencia}
              </p>
            )}

            {!destinoId && destinosPosibles.length > 0 && !errorTransferencia && (
              <p className="mt-2 text-[13px] text-[var(--fin-ink-faint)]">
                Elige una cuenta de destino
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTransfiriendo(false);
                  setDestinoId('');
                  setMontoTexto('');
                }}
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-3.5 text-[15px] font-semibold text-[var(--fin-ink)] transition-opacity hover:opacity-80"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarTransferir}
                disabled={!montoValido}
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-in)] px-4 py-3.5 text-[15px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
