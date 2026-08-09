import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Copy,
  Info,
  Repeat,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { useCatalogo } from '../catalogoContexto';
import type { LucideIcon } from 'lucide-react';
import type { Transaction } from '../types';
import type { Senal, Tono, TipoSenal } from '../lib/senales';
import { senalesDeMovimiento } from '../lib/senales';
import { formatCop, formatSigned } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface AnalisisMovimientoProps {
  tx: Transaction;
  /** The whole ledger: the comparisons worth reading only exist across months. */
  historial: readonly Transaction[];
  onCerrar: () => void;
}

const ICONO: Record<TipoSenal, LucideIcon> = {
  inusual: Zap,
  recurrente: Repeat,
  hormiga: Copy,
  duplicado: AlertTriangle,
  creciendo: TrendingUp,
  nuevo: Sparkles,
};

const COLOR: Record<Tono, { fondo: string; tinta: string }> = {
  alerta: { fondo: 'var(--fin-out-bg)', tinta: 'var(--fin-out)' },
  aviso: { fondo: 'var(--fin-warn-bg)', tinta: 'var(--fin-warn-ink)' },
  neutro: { fondo: 'var(--fin-soft)', tinta: 'var(--fin-ink-soft)' },
};

const FilaSenal: React.FC<{ senal: Senal }> = ({ senal }) => {
  const Icono = ICONO[senal.tipo];
  const { fondo, tinta } = COLOR[senal.tono];

  return (
    <li className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: fondo }}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tinta }} strokeWidth={2.5} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-bold" style={{ color: tinta }}>
          {senal.titulo}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fin-ink-soft)]">
          {senal.detalle}
        </p>
      </div>
    </li>
  );
};

/**
 * What the app has to say about one movement.
 *
 * Every verdict here is a comparison against the user's OWN history, never a
 * judgement about the spending itself: "4× what you usually spend on food" is a
 * fact about them and can be acted on, while "this was a bad purchase" is an
 * opinion the app has no standing to hold.
 *
 * Silence is a valid answer. An ordinary movement gets no signals at all,
 * because a badge on everything is a badge on nothing.
 */
export const AnalisisMovimiento: React.FC<AnalisisMovimientoProps> = ({
  tx,
  historial,
  onCerrar,
}) => {
  useBloqueoScroll(true);
  const catalogo = useCatalogo();
  const senales = senalesDeMovimiento(tx, historial);
  const cat = catalogo.de(tx.category);
  const color = cat.color;
  const Icono = cat.Icono;
  const esIngreso = tx.kind === 'ingreso';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--fin-scrim)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Análisis de ${tx.description}`}
      onClick={onCerrar}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[2rem] bg-[var(--fin-bg)] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
              aria-hidden="true"
            >
              <Icono className="h-5 w-5" style={{ color }} strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold tracking-tight text-[var(--fin-ink)]">
                {tx.description}
              </h2>
              <p className="text-[11px] text-[var(--fin-ink-faint)]">
                {dayLabel(tx.occurredOn)} · {cat.nombre}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        <p
          className="mt-4 font-display text-3xl font-extrabold tabular-nums"
          style={{ color: esIngreso ? 'var(--fin-in)' : 'var(--fin-out)' }}
        >
          {formatSigned(tx.amountCop, tx.kind)}
        </p>

        {senales.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-2">
            {senales.map((senal) => (
              <FilaSenal key={senal.tipo} senal={senal} />
            ))}
          </ul>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--fin-soft)] px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-ink-faint)]" strokeWidth={2.5} aria-hidden="true" />
            <p className="text-[12px] leading-relaxed text-[var(--fin-ink-soft)]">
              Nada raro con este movimiento: encaja con lo que sueles gastar en{' '}
              {cat.nombre}.
            </p>
          </div>
        )}

        {tx.rawTranscript.trim() ? (
          <p className="mt-4 rounded-2xl bg-[var(--fin-soft)] px-4 py-3 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
            {tx.rawTranscript.trim()}
          </p>
        ) : null}

        <p className="mt-4 text-center text-[10px] leading-relaxed text-[var(--fin-ink-faint)]">
          Todo esto se calcula en tu dispositivo comparando con tu propio historial.
          Sin inteligencia artificial y sin que tus datos salgan de aquí.
        </p>

        <p className="sr-only">{formatCop(tx.amountCop)}</p>
      </motion.div>
    </motion.div>
  );
};
