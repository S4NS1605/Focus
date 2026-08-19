import React, { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import type { Transaction } from '../types';
import { formatCop, parseAmountInput } from '../lib/formatCop';
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
 * Detalle de una sola cuenta/cajita (no una lista).
 * Se abre cuando haces click en una cuenta desde "Dinero".
 * Permite: ver saldo, actualizar, transferir, eliminar.
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

  const saldo = saldoDeCajita(movimientos, cajita.id, transacciones);
  const Icono = iconoDeCajita(cajita.icon);

  const guardarSaldo = () => {
    const nuevo = parseAmountInput(nuevoSaldoTexto);
    if (nuevo !== null) {
      onFijarSaldo(cajita.id, nuevo);
      setEditandoSaldo(false);
      setNuevoSaldoTexto('');
    }
  };

  const confirmarEliminar = () => {
    if (confirm(`¿Eliminar ${cajita.nombre}? Esta acción no se puede deshacer.`)) {
      onEliminar(cajita.id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera con icono y nombre */}
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
          <Icono className="h-6 w-6 text-[var(--fin-ink-soft)]" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[24px] font-semibold text-[var(--fin-ink)]">
            {cajita.nombre}
          </h1>
          <p className="text-[13px] text-[var(--fin-ink-faint)]">
            {catalogo.de(cajita.tipo as any).nombre}
          </p>
        </div>
      </div>

      {/* Saldo actual */}
      <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
        <p className="text-[13px] text-[var(--fin-ink-faint)]">Saldo actual</p>
        <p
          className="mt-2 text-[40px] font-semibold tabular-nums text-[var(--fin-ink)]"
          style={{ letterSpacing: 'var(--fin-track-cifra)' }}
        >
          {formatCop(saldo)}
        </p>

        {cajita.metaCop && cajita.metaCop > 0 ? (
          <>
            <div className="mt-4 h-1.5 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
              <div
                className="h-full rounded-[var(--fin-r-pill)] bg-[var(--fin-in)]"
                style={{
                  width: `${Math.min(100, (saldo / cajita.metaCop) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[13px] text-[var(--fin-ink-faint)]">
              {Math.round((saldo / cajita.metaCop) * 100)}% de {formatCop(cajita.metaCop)}
            </p>
          </>
        ) : null}
      </section>

      {/* Acciones principales */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditandoSaldo(true)}
          className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-on-accent)]"
        >
          Actualizar saldo
        </button>

        {onTransferir && destinos.length > 0 ? (
          <button
            type="button"
            onClick={() => {}}
            className="flex-1 rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-ink)]"
          >
            Transferir
          </button>
        ) : null}
      </div>

      {/* Ajustes avanzados */}
      <section>
        <button
          type="button"
          onClick={() => setMostrarAjustes(!mostrarAjustes)}
          className="flex w-full items-center justify-between rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-ink)]"
        >
          Ajustes de saldo ({movimientos.filter((m) => m.cajitaId === cajita.id).length})
          <ChevronDown
            className="h-5 w-5 transition-transform"
            style={{
              transform: mostrarAjustes ? 'rotate(180deg)' : undefined,
            }}
          />
        </button>

        {mostrarAjustes ? (
          <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
            {/* Aquí irían los ajustes de saldo históricos */}
            <p className="text-[13px] text-[var(--fin-ink-faint)]">
              {movimientos.filter((m) => m.cajitaId === cajita.id).length} ajustes
            </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-11/12 max-w-sm rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
            <h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">
              Nuevo saldo para {cajita.nombre}
            </h2>
            <input
              type="text"
              inputMode="decimal"
              value={nuevoSaldoTexto}
              onChange={(e) => setNuevoSaldoTexto(e.target.value)}
              placeholder="0"
              autoFocus
              className="mt-3 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-bg)] px-4 py-3 text-[17px] text-[var(--fin-ink)]"
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
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--fin-on-accent)]"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
