import React, { useState } from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import type { Transaction } from '../types';
import { formatAmountInput, conPuntos, formatCop, parseAmountInput, parseSaldoInput } from '../lib/formatCop';
import { saldoDeCajita } from '../lib/cajitas';
import { iconoDeCajita } from '../cajitaIconos';
import { useCatalogo } from '../catalogoContexto';

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
 * Escribe la cifra agrupada de miles mientras se teclea.
 *
 * Se hace sobre los dígitos y no sobre el texto tal cual para que borrar, pegar
 * o teclear en la mitad no rompa la agrupación: siempre se reconstruye entera.
 */
/**
 * Detalle de una sola cuenta/cajita (no una lista).
 * Se abre cuando haces click en una cuenta desde "Dinero".
 * Permite: ver saldo, actualizar, transferir, eliminar.
 *
 * El saldo se cambia tocando la cifra, no un botón aparte. La cifra ES el dato
 * que se quiere cambiar, así que tocarla es el gesto que la gente intenta
 * primero; un botón "Actualizar saldo" debajo obligaba a leer para encontrar
 * algo que ya se estaba mirando.
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
  const catalogo = useCatalogo();
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
    console.log('[transferir] abriendo modal', { puedeTransferir, destinos: destinosPosibles.length, primero: destinosPosibles[0]?.nombre });
    setDestinoId(destinosPosibles[0]?.id ?? '');
    setMontoTexto('');
    setTransfiriendo(true);
  };

  const confirmarTransferir = async () => {
    const monto = parseAmountInput(montoTexto);
    console.log('[transferir]', { onTransferir: !!onTransferir, destinoId, monto });
    if (!onTransferir || destinoId === '' || monto === null) {
      const razon = !onTransferir ? 'sin callback' : destinoId === '' ? 'sin destino' : 'monto inválido';
      console.warn('[transferir] aborto:', { razon });
      setErrorTransferencia('Error: ' + razon);
      return;
    }
    try {
      console.log('[transferir] enviando:', { origen: cajita.id, destino: destinoId, monto });
      await onTransferir(cajita.id, destinoId, monto);
      setTransfiriendo(false);
      setMontoTexto('');
      setDestinoId('');
      setErrorTransferencia(null);
      console.log('[transferir] ✓ completada');
    } catch (err) {
      console.error('[transferir] error:', err);
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
    <div className="flex flex-col gap-6">
      {/* Cabecera con icono y nombre */}
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
          <Icono className="h-6 w-6 text-[var(--fin-ink-soft)]" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[24px] font-semibold text-[var(--fin-ink)]">{cajita.nombre}</h1>
          <p className="text-[13px] text-[var(--fin-ink-faint)]">
            {catalogo.de(cajita.tipo as any).nombre}
          </p>
        </div>
      </div>

      {/* Saldo actual. La cifra entera es el botón de editar. */}
      <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
        <p className="text-[13px] text-[var(--fin-ink-faint)]">Saldo actual</p>

        <button
          type="button"
          onClick={abrirEditarSaldo}
          aria-label={`Cambiar el saldo de ${cajita.nombre}`}
          className="mt-2 flex w-full items-center gap-2 rounded-[var(--fin-r-card)] text-left transition-opacity active:opacity-60"
        >
          <span
            className="text-[40px] font-semibold tabular-nums text-[var(--fin-ink)]"
            style={{ letterSpacing: 'var(--fin-track-cifra)' }}
          >
            {formatCop(saldo)}
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-[var(--fin-ink-faint)]" strokeWidth={2} aria-hidden="true" />
        </button>
        <p className="text-[13px] text-[var(--fin-ink-faint)]">Toca la cifra para cambiarla</p>

        {cajita.metaCop && cajita.metaCop > 0 ? (
          <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
              <div
                className="h-full rounded-[var(--fin-r-pill)] bg-[var(--fin-in)]"
                style={{ width: `${Math.min(100, (saldo / cajita.metaCop) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] text-[var(--fin-ink-faint)]">
              {Math.round((saldo / cajita.metaCop) * 100)}% de {formatCop(cajita.metaCop)}
            </p>
          </>
        ) : null}
      </section>

      {puedeTransferir ? (
        <button
          type="button"
          onClick={abrirTransferir}
          className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
        >
          Enviar dinero a otra cuenta
        </button>
      ) : (
        <div className="rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] bg-[var(--fin-soft)] px-4 py-3 text-center">
          <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
            Necesitas al menos 2 cuentas para transferir
          </p>
        </div>
      )}

      {/* Ajustes avanzados */}
      <section>
        <button
          type="button"
          onClick={() => setMostrarAjustes(!mostrarAjustes)}
          className="flex w-full items-center justify-between rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-ink)]"
        >
          Ajustes de saldo ({propios.length})
          <ChevronDown
            className="h-5 w-5 transition-transform"
            style={{ transform: mostrarAjustes ? 'rotate(180deg)' : undefined }}
          />
        </button>

        {mostrarAjustes ? (
          <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
            <p className="text-[13px] text-[var(--fin-ink-faint)]">{propios.length} ajustes</p>
          </div>
        ) : null}
      </section>

      {/* Eliminar */}
      <button
        type="button"
        onClick={confirmarEliminar}
        className="flex items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-3 text-[15px] font-semibold text-red-500"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar cuenta
      </button>

      {/* Modal de editar saldo */}
      {editandoSaldo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
            <h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">
              Nuevo saldo para {cajita.nombre}
            </h2>
            <input
              type="text"
              inputMode="numeric"
              value={nuevoSaldoTexto}
              onChange={(e) => setNuevoSaldoTexto(conPuntos(e.target.value))}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              autoFocus
              className={claseCampo}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditandoSaldo(false)}
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarSaldo}
                disabled={parseSaldoInput(nuevoSaldoTexto) === null}
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de transferir */}
      {transfiriendo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
            <h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">
              Transferir desde {cajita.nombre}
            </h2>

            <label className="mt-4 block text-[13px] text-[var(--fin-ink-faint)]" htmlFor="destino">
              Hacia
            </label>
            <select
              id="destino"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="mt-1 w-full rounded-[var(--fin-r-card)] border-2 transition-colors border-[var(--fin-line)] bg-[var(--fin-bg)] px-4 py-3 text-[17px] text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
            >
              <option value="">— Elige la cuenta destino —</option>
              {destinosPosibles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-[13px] text-[var(--fin-ink-faint)]" htmlFor="monto">
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
              <p className="mt-2 text-[13px] font-semibold text-[var(--fin-warn)]">
                Elige una cuenta de destino
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTransfiriendo(false);
                  setDestinoId('');
                  setMontoTexto('');
                }}
                className="flex-1 rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarTransferir}
                disabled={!montoValido}
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-in)] px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
