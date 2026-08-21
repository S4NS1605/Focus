import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { tint } from '../types';
import type { Transaction } from '../types';
import { formatSigned } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';
import { useCatalogo } from '../catalogoContexto';
import { useBloqueoScroll } from '../data/useBloqueoScroll';

interface DetalleMovimientoProps {
  tx: Transaction;
  /** El nombre de la cuenta por la que se movió, si se indicó alguna. */
  nombreCuenta?: string | null;
  onCerrar: () => void;
  onEditar: (tx: Transaction) => void;
  onAnalizar: (tx: Transaction) => void;
  onBorrar: (id: string) => void;
}

/**
 * Lo que sale al tocar un movimiento de la lista.
 *
 * Existe por una razón muy concreta: analizar, editar y borrar estaban antes
 * como tres botoncitos dentro de CADA fila, siempre visibles. Eso hacía dos
 * daños a la vez: se comían el ancho que necesitaba la descripción, y ponía un
 * botón de borrar permanentemente a un toque de distancia en la pantalla que
 * más se abre.
 *
 * Aquí las tres acciones tienen sitio de sobra, se leen con su nombre completo
 * en vez de con un icono que hay que adivinar, y borrar deja de estar al lado
 * del dedo por accidente.
 */
export const DetalleMovimiento: React.FC<DetalleMovimientoProps> = ({
  tx,
  nombreCuenta,
  onCerrar,
  onEditar,
  onAnalizar,
  onBorrar,
}) => {
  const catalogo = useCatalogo();
  const entrada = catalogo.de(tx.category);
  const Icono = entrada.Icono;
  const esIngreso = tx.kind === 'ingreso';
  useBloqueoScroll(true);

  const acciones = [
    { icono: Sparkles, texto: 'Analizar', alTocar: () => onAnalizar(tx) },
    { icono: Pencil, texto: 'Editar', alTocar: () => onEditar(tx) },
    { icono: Trash2, texto: 'Borrar', alTocar: () => onBorrar(tx.id), peligro: true },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--fin-scrim)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${tx.description}`}
      onClick={onCerrar}
    >
      <motion.div
        initial={{ y: 24 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="fin-glass w-full max-w-md rounded-t-[var(--fin-r-sheet)] bg-[var(--fin-card)] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col items-center pb-2 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-[var(--fin-r-pill)]"
            style={{ backgroundColor: tint(entrada.color, 0.16), color: entrada.color }}
            aria-hidden="true"
          >
            <Icono className="h-7 w-7" />
          </span>

          <p
            className="mt-4 tabular-nums"
            style={{
              font: 'var(--fin-t-cifra)',
              letterSpacing: 'var(--fin-track-cifra)',
              color: esIngreso ? 'var(--fin-in)' : 'var(--fin-out)',
            }}
          >
            {formatSigned(tx.amountCop, tx.kind)}
          </p>

          <p className="mt-2 text-[20px] font-semibold text-[var(--fin-ink)]">{tx.description}</p>

          <p className="mt-1 text-[15px] capitalize text-[var(--fin-ink-soft)]">
            {entrada.nombre} · {dayLabel(tx.occurredOn)}
            {nombreCuenta ? ` · ${nombreCuenta}` : ''}
          </p>

          {/* Lo que se escuchó, solo si se dictó y dice algo distinto de la
 descripción. Sirve para entender por qué quedó así si el motor de
 texto se equivocó. */}
          {tx.rawTranscript && tx.rawTranscript.trim() !== tx.description.trim() ? (
            <p className="mt-3 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-[13px] italic text-[var(--fin-ink-soft)]">
              Dijiste: «{tx.rawTranscript.trim()}»
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {acciones.map((accion) => (
            <button
              key={accion.texto}
              type="button"
              onClick={accion.alTocar}
              className="flex flex-col items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] py-3.5 text-[13px] font-semibold transition-colors"
              style={{ color: accion.peligro ? 'var(--fin-out)' : 'var(--fin-ink)' }}
            >
              <accion.icono className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              {accion.texto}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
