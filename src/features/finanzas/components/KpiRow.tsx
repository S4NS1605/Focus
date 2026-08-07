import React from 'react';
import { motion } from 'framer-motion';
import {
  CircleDashed,
  Smile,
  Frown,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertTriangle,
  MinusCircle,
  CheckCircle2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MonthTotals } from '../lib/aggregate';
import { formatCop } from '../lib/formatCop';

interface KpiRowProps {
  totals: MonthTotals;
}

interface Kpi {
  Icono: LucideIcon;
  label: string;
  value: string;
  hint: string;
  bg: string;
  ink: string;
}

/**
 * Bands for the savings-rate tile. The icon SHAPE differs per band, not just its
 * colour — colour alone would leave the tile meaningless in greyscale or to a
 * colour-blind reader, and the wording carries it a third time.
 */
const savingsBand = (rate: number | null): { Icono: LucideIcon; hint: string; bg: string; ink: string } => {
  if (rate === null) return { Icono: CircleDashed, hint: 'sin ingresos aún', bg: 'var(--fin-soft)', ink: 'var(--fin-ink-soft)' };
  if (rate < 0) return { Icono: AlertTriangle, hint: 'gastaste más de lo que entró', bg: 'var(--fin-out-bg)', ink: 'var(--fin-out)' };
  if (rate < 10) return { Icono: MinusCircle, hint: 'muy justo', bg: 'var(--fin-media-bg)', ink: 'var(--fin-media-ink)' };
  if (rate < 20) return { Icono: TrendingDown, hint: 'aceptable', bg: 'var(--fin-baja-bg)', ink: 'var(--fin-baja-ink)' };
  return { Icono: CheckCircle2, hint: 'buen colchón', bg: 'var(--fin-in-bg)', ink: 'var(--fin-in)' };
};

export const KpiRow: React.FC<KpiRowProps> = ({ totals }) => {
  const band = savingsBand(totals.tasaAhorro);
  const positivo = totals.balance >= 0;

  const kpis: Kpi[] = [
    {
      Icono: positivo ? Smile : Frown,
      label: 'Balance',
      value: formatCop(totals.balance),
      hint: positivo ? 'te sobró' : 'te faltó',
      bg: positivo ? 'var(--fin-in-bg)' : 'var(--fin-out-bg)',
      ink: positivo ? 'var(--fin-in)' : 'var(--fin-out)',
    },
    {
      Icono: Wallet,
      label: 'Ingresos',
      value: formatCop(totals.ingresos),
      hint: 'entró este mes',
      bg: 'var(--fin-in-bg)',
      ink: 'var(--fin-in)',
    },
    {
      Icono: TrendingUp,
      label: 'Gastos',
      value: formatCop(totals.gastos),
      hint: 'salió este mes',
      bg: 'var(--fin-out-bg)',
      ink: 'var(--fin-out)',
    },
    {
      Icono: band.Icono,
      label: 'Tasa de ahorro',
      // The null case must not read as 0%: "saved nothing" and "no income
      // recorded" are different facts.
      value: totals.tasaAhorro === null ? '—' : `${totals.tasaAhorro}%`,
      hint: band.hint,
      bg: band.bg,
      ink: band.ink,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {kpis.map((kpi, idx) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.05, ease: 'easeOut' }}
          className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: kpi.bg, color: kpi.ink }}
              aria-hidden="true"
            >
              <kpi.Icono className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="truncate text-[11px] font-bold text-[var(--fin-ink-soft)]">{kpi.label}</span>
          </div>

          <p
            className="mt-2.5 truncate text-xl font-extrabold tabular-nums"
            style={{ color: kpi.ink }}
          >
            {kpi.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--fin-ink-faint)]">{kpi.hint}</p>
        </motion.div>
      ))}
    </div>
  );
};
