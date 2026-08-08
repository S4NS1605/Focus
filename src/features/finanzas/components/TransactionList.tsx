import React from 'react';
import { motion } from 'framer-motion';
import { Hand, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { CATEGORY_COLOR, CATEGORY_ICON, CATEGORY_LABELS, tint } from '../types';
import type { Transaction } from '../types';
import { COPY } from '../copy';
import { formatCop, formatSigned } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

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
  onAnalizar?: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  /** Optional so read-only listings (summaries) can omit the control entirely. */
  onEdit?: (tx: Transaction) => void;
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
      net: items.reduce((sum, tx) => sum + (tx.kind === 'ingreso' ? tx.amountCop : -tx.amountCop), 0),
    }));
};

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  conSenal,
  onAnalizar,
  onDelete,
  onEdit,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center">
        <span className="block text-[var(--fin-ink-ghost)] mb-2 flex justify-center" aria-hidden="true">
          <Hand className="h-10 w-10" strokeWidth={1.5} />
        </span>
        <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">{COPY.list.empty}</p>
        <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">{COPY.list.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(transactions).map((group) => (
        <section key={group.date} aria-label={dayLabel(group.date)}>
          {/* Day header with its own subtotal */}
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-xs font-bold text-[var(--fin-ink-soft)] capitalize">{dayLabel(group.date)}</h3>
            <span className="text-[11px] font-semibold text-[var(--fin-ink-faint)] tabular-nums">
              {formatCop(group.net)}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {group.items.map((tx, idx) => {
              const color = CATEGORY_COLOR[tx.category];
              const esIngreso = tx.kind === 'ingreso';

                const Icon = CATEGORY_ICON[tx.category];

              return (
                <motion.li
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.15) }}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-3"
                >
                  {/* Category identity: icon on its own hue. Two channels, not one. */}
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: tint(color, 0.14), color: color }}
                    aria-hidden="true"
                  >
                    <Icon className="h-6 w-6" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-[var(--fin-ink)]">
                      <span className="truncate">{tx.description}</span>
                      {/* A quiet dot, not a badge: most movements are ordinary,
                          and marking everything would mark nothing. */}
                      {conSenal?.has(tx.id) ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fin-warn)]"
                          aria-label="Tiene algo que revisar"
                        />
                      ) : null}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color }}>
                      {CATEGORY_LABELS[tx.category]}
                    </p>
                  </div>

                  <span
                    className="shrink-0 text-sm font-extrabold tabular-nums"
                    style={{ color: esIngreso ? 'var(--fin-in)' : 'var(--fin-out)' }}
                  >
                    {formatSigned(tx.amountCop, tx.kind)}
                  </span>

                  {onAnalizar ? (
                    <button
                      type="button"
                      onClick={() => onAnalizar(tx)}
                      aria-label={`Analizar: ${tx.description}`}
                      className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-ghost)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                    >
                      <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  ) : null}

                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(tx)}
                      aria-label={`${COPY.list.edit}: ${tx.description}`}
                      className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-ghost)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onDelete(tx.id)}
                    aria-label={`${COPY.list.delete}: ${tx.description}`}
                    className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-ghost)] transition-colors hover:bg-[var(--fin-out-bg)] hover:text-[var(--fin-out)]"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
