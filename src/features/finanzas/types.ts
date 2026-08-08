// `erasableSyntaxOnly` is on in tsconfig.app.json, so TS enums are unavailable.
// `as const` + indexed access gives the same closed set with zero runtime cost.
export const CATEGORIES = [
  'mercado',
  'comida',
  'transporte',
  'servicios',
  'salud',
  'hogar',
  'entretenimiento',
  'ropa',
  'educacion',
  'transferencia',
  'ahorro',
  'ingreso',
  'otros',
] as const;

export type Category = typeof CATEGORIES[number];

export type TxKind = 'gasto' | 'ingreso';

export const CATEGORY_LABELS: Record<Category, string> = {
  mercado: 'Mercado',
  comida: 'Comida',
  transporte: 'Transporte',
  servicios: 'Servicios',
  salud: 'Salud',
  hogar: 'Hogar',
  entretenimiento: 'Entretenimiento',
  ropa: 'Ropa',
  educacion: 'Educación',
  transferencia: 'Transferencia',
  ahorro: 'Ahorro',
  ingreso: 'Ingreso',
  otros: 'Otros',
};

import {
  ShoppingCart,
  Utensils,
  Bus,
  Lightbulb,
  Pill,
  Home,
  Film,
  Shirt,
  Book,
  RefreshCw,
  PiggyBank,
  DollarSign,
  Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * One icon per category. This is not decoration: colour must never be the only
 * channel carrying meaning, and the icon is the second channel — it survives
 * greyscale, colour-blindness, and a glance too quick to read the label.
 */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  mercado: ShoppingCart,
  comida: Utensils,
  transporte: Bus,
  servicios: Lightbulb,
  salud: Pill,
  hogar: Home,
  entretenimiento: Film,
  ropa: Shirt,
  educacion: Book,
  transferencia: RefreshCw,
  ahorro: PiggyBank,
  ingreso: DollarSign,
  otros: Package,
};

/**
 * A distinct hue per category, chosen so adjacent bars in a sorted breakdown
 * never read as the same colour. Used at full strength for bars and at low
 * opacity for chip backgrounds — text always stays near-black on top, so no
 * hue here needs to pass contrast as a text colour.
 *
 * Categories are dynamic, so these cannot be Tailwind classes (v4 only emits
 * utilities it can see statically). They are applied as inline styles.
 */
export const CATEGORY_COLOR: Record<Category, string> = {
  mercado: '#F59E0B',
  comida: '#F97316',
  transporte: '#38BDF8',
  servicios: '#A78BFA',
  salud: '#EC4899',
  hogar: '#14B8A6',
  entretenimiento: '#C084FC',
  ropa: '#6366F1',
  educacion: '#3B82F6',
  transferencia: '#94A3B8',
  ahorro: '#10B981',
  ingreso: '#22C55E',
  otros: '#A8A29E',
};

/** `#RRGGBB` + alpha -> `rgb(r g b / a)`, for chip tints off the same hue. */
export const tint = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

export interface Transaction {
  id: string;
  kind: TxKind;
  amountCop: number;
  category: Category;
  description: string;
  /** Bogota-local calendar day, 'YYYY-MM-DD'. Never a UTC timestamp. */
  occurredOn: string;
  /**
   * Which account or pocket the money actually moved through, when known.
   *
   * Optional on purpose: dictating "gasté 20 mil" must stay a one-tap action,
   * and forcing an account choice on every entry would tax the fast path to
   * serve the slow one. Unattributed movements still count in the month's
   * totals — they simply do not move any balance.
   */
  cuentaId: string | null;
  /** The untouched dictation, kept so a mis-parse can always be reconstructed. */
  rawTranscript: string;
  createdAt: string;
}
