import React from 'react';
import { motion } from 'framer-motion';
import { tint } from '../types';
import type { CategorySlice } from '../lib/aggregate';
import { formatCop } from '../lib/formatCop';
import { useCatalogo } from '../catalogoContexto';

interface CategoryBreakdownProps {
  slices: readonly CategorySlice[];
  title: string;
}

/**
 * Horizontal bars, largest first. Hand-rolled on purpose: a chart library is
 * ~100 kB for what a sorted list of width-percentage divs does in a few lines,
 * and its default theme would fight the rest of the app.
 */
export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ slices, title }) => {
  const catalogo = useCatalogo();
  if (slices.length === 0) return null;

  const largest = slices[0].total;

  return (
    <section
      className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5"
      aria-label={title}
    >
      <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">{title}</h2>

      <ul className="mt-4 flex flex-col gap-3.5">
        {slices.map((slice, idx) => {
          const entrada = catalogo.de(slice.category);
          const color = entrada.color;
          // Bars scale against the largest slice, not against 100%, so the
          // smallest category is still legible instead of a hairline.
          const width = Math.max((slice.total / largest) * 100, 4);

          const Icon = entrada.Icono;
          
          return (
            <li key={slice.category}>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: tint(color, 0.14), color: color }}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-[var(--fin-ink)]">
                      {entrada.nombre}
                    </span>
                    <span className="shrink-0 text-[13px] font-extrabold text-[var(--fin-ink)] tabular-nums">
                      {formatCop(slice.total)}
                    </span>
                  </div>

                  {/* The percentage is written out, so the bar length is never
                      the only way to read the value. */}
                  <div className="mt-1.5 flex flex-nowrap items-center gap-2">
                    <div className="h-2 flex-1 min-w-0 overflow-hidden rounded-full bg-[var(--fin-soft)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.05, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-[var(--fin-ink-faint)] tabular-nums">
                      {slice.pct}%
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
