import React from 'react';
import { motion } from 'framer-motion';
import { Hand } from 'lucide-react';
import { tint } from '../types';
import type { Transaction } from '../types';
import { COPY } from '../copy';
import { formatCop, formatSigned } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';
import { useCatalogo } from '../catalogoContexto';

interface TransactionListProps {
  transactions: readonly Transaction[];
  /**
   * Ids worth a second look, precomputed by the parent.
   *
   * Passed in rather than derived here because the comparisons need the whole
   * ledger, and recomputing them per row on every render would scan it once per
   * visible movement.
   */
  conSenal?: ReadonlySet<string>;
  /**
   * Abre el detalle del movimiento. Ahí adentro están analizar, editar y borrar.
   * Opcional para los listados que solo se leen.
   */
  onAbrir?: (tx: Transaction) => void;
}

interface DayGroup {
  date: string;
  items: Transaction[];
  net: number;
}

const groupByDay = (transactions: readonly Transaction[]): DayGroup[] => {
  const byDate = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const bucket = byDate.get(tx.occurredOn);
    if (bucket) bucket.push(tx);
    else byDate.set(tx.occurredOn, [tx]);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      net: items.reduce(
        (sum, tx) => sum + (tx.kind === 'ingreso' ? tx.amountCop : -tx.amountCop),
        0,
      ),
    }));
};

/**
 * La lista de movimientos. Ahora es EL cuerpo de la pantalla de inicio, no una
 * tarjeta de cinco filas metida entre otras once tarjetas.
 *
 * El cambio que más se nota: cada fila tenía tres botones a la derecha
 * (analizar, editar, borrar). Con la cuenta hecha en un celular de 375px de
 * ancho, esos tres botones se comían 120px y a la descripción le quedaban 41 —
 * o sea tres o cuatro letras. Por eso la lista decía "I.", "A.", "C.", "Tra…"
 * en vez de "Internet" o "Almuerzo": el contenido se estaba sacrificando por
 * unos controles que casi nunca se usan.
 *
 * Ahora se toca la fila y las tres acciones salen en su detalle. La descripción
 * recupera esos 120px y caben unas 20 letras, que es casi cualquier movimiento
 * entero.
 *
 * También se fue el borde de cada fila: doce filas eran doce rectángulos
 * dibujados. Ahora es una sola tarjeta con líneas finas por dentro, como la
 * lista de Ajustes de iOS.
 */
export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  conSenal,
  onAbrir,
}) => {
  const catalogo = useCatalogo();

  if (transactions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] px-6 py-12 text-center"
      >
        <motion.span
          className="mb-2 flex justify-center text-[var(--fin-ink-ghost)]"
          aria-hidden="true"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Hand className="h-9 w-9" strokeWidth={1.5} />
        </motion.span>
        <p className="mt-3 text-[17px] font-semibold text-[var(--fin-ink)]">{COPY.list.empty}</p>
        <p className="mt-1 text-[15px] text-[var(--fin-ink-faint)]">{COPY.list.emptyHint}</p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByDay(transactions).map((group) => (
        <section key={group.date} aria-label={dayLabel(group.date)}>
          {/* El día, y a la derecha cuánto se movió ese día. */}
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <h3 className="text-[13px] capitalize text-[var(--fin-ink-faint)]">
              {dayLabel(group.date)}
            </h3>
            <span className="text-[13px] tabular-nums text-[var(--fin-ink-faint)]">
              {formatCop(group.net)}
            </span>
          </div>

          <ul className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
            {group.items.map((tx, idx) => {
              const entrada = catalogo.de(tx.category);
              const color = entrada.color;
              const esIngreso = tx.kind === 'ingreso';
              const Icon = entrada.Icono;
              const ultima = idx === group.items.length - 1;

              return (
                <li key={tx.id}>
                  <motion.button
                    type="button"
                    onClick={onAbrir ? () => onAbrir(tx) : undefined}
                    // Sin onAbrir la fila no es pulsable: los listados de solo
                    // lectura no deben parecer que llevan a alguna parte.
                    disabled={!onAbrir}
                    aria-label={onAbrir ? `Ver ${tx.description}` : undefined}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx, 8) * 0.02, ease: 'easeOut' }}
                    whileTap={onAbrir ? { scale: 0.98, backgroundColor: 'var(--fin-soft)' } : undefined}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors enabled:hover:bg-[var(--fin-soft)]"
                    style={{ boxShadow: ultima ? undefined : 'inset 0 -1px 0 0 var(--fin-line)' }}
                  >
                    {/* El icono lleva el color de la categoría. El texto no: una
 lista de veinte movimientos con veinte colores distintos
 de letra no se puede leer. */}
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)]"
                      style={{ backgroundColor: tint(color, 0.14), color }}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[17px] font-semibold text-[var(--fin-ink)]">
                          {tx.description}
                        </span>
                        {/* Un punto discreto, no una etiqueta: casi todos los
 movimientos son normales, y marcarlos todos sería
 como no marcar ninguno. */}
                        {conSenal?.has(tx.id) ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-warn)]"
                            aria-label="Tiene algo que revisar"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate text-[15px] text-[var(--fin-ink-soft)]">
                        {entrada.nombre}
                      </span>
                    </span>

                    <span
                      className="shrink-0 text-[17px] font-semibold tabular-nums"
                      style={{ color: esIngreso ? 'var(--fin-in)' : 'var(--fin-out)' }}
                    >
                      {formatSigned(tx.amountCop, tx.kind)}
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
