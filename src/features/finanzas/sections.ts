// Kept out of FinanzasShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
import {
  BarChart2,
  CreditCard,
  FileText,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  Settings2,
  Target,
  TrendingUp,
} from 'lucide-react';

/**
 * Every section the app has. Pockets and goals share "Ahorro" because a goal's
 * progress is usually just a pocket's balance, and debts share "Deudas" with
 * cards for the same reason: they are one subject read the same way.
 */
export const SECTIONS = [
  { id: 'resumen', icon: BarChart2, label: 'Resumen', color: 'text-sky-500 dark:text-sky-400' },
  { id: 'movimientos', icon: ReceiptText, label: 'Movimientos', color: 'text-amber-500 dark:text-amber-400' },
  { id: 'ahorro', icon: PiggyBank, label: 'Ahorro', color: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'deudas', icon: CreditCard, label: 'Deudas', color: 'text-rose-500 dark:text-rose-400' },
  { id: 'tendencias', icon: TrendingUp, label: 'Tendencias', color: 'text-violet-500 dark:text-violet-400' },
  { id: 'analista', icon: FileText, label: 'Analista', color: 'text-blue-500 dark:text-blue-400' },
  { id: 'configuracion', icon: Settings2, label: 'Configuración', color: 'text-stone-500 dark:text-stone-400' },
] as const;

/**
 * What the phone's bottom bar shows. Five is the ceiling — past that the targets
 * get too narrow to hit and the labels stop being readable — so the rest live
 * behind "Más". The desktop sidebar has room for all of them and shows the lot.
 */
export const SECCIONES_BARRA: readonly SectionId[] = [
  'resumen',
  'movimientos',
  'ahorro',
  'deudas',
];

export const SECCIONES_MAS: readonly SectionId[] = ['tendencias', 'analista', 'configuracion'];

export type SectionId = typeof SECTIONS[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';

/** The two halves of the Ahorro section. */
export const PESTANAS_AHORRO = [
  { id: 'cajitas', icon: PiggyBank, label: 'Cajitas', color: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'metas', icon: Target, label: 'Metas', color: 'text-violet-500 dark:text-violet-400' },
] as const;

export type PestanaAhorro = typeof PESTANAS_AHORRO[number]['id'];


export const ICONO_MAS = MoreHorizontal;
