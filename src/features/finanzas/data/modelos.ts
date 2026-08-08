// Domain objects that live alongside transactions: Nu-style savings pockets and
// the goals tracked on top of them. Transactions themselves stay in ../types.ts.

/** A savings pocket ("cajita" in Nu). Tracked by hand — nothing talks to a bank. */
export interface Cajita {
  id: string;
  nombre: string;
  icon: string;
  /** Optional target for this pocket alone, independent of any Meta. */
  metaCop: number | null;
  /**
   * Annual effective rate the pocket earns, as a percentage (13.5 for 13.5% E.A.).
   *
   * Stored as E.A. rather than a daily rate because that is the only figure
   * Colombian banks publish, so it is the number the user can actually read off
   * their app and type in without converting anything.
   */
  tasaEaPct: number | null;
  createdAt: string;
  /** Set when retired. Archived pockets keep their history but leave the totals. */
  archivedAt: string | null;
}

/**
 * Why a pocket's balance changed.
 *
 * `ajuste` exists because of how this app is actually used: the requirement is
 * "I just tell it how much I have". Setting a balance to X is recorded as the
 * delta needed to reach X, so a correction never silently rewrites history and
 * the balance stays the sum of its movements.
 */
export type CajitaMovKind = 'deposito' | 'retiro' | 'rendimiento' | 'ajuste';

export interface CajitaMovimiento {
  id: string;
  cajitaId: string;
  kind: CajitaMovKind;
  /** Signed COP delta: positive adds to the pocket, negative takes out. */
  deltaCop: number;
  /** Bogota calendar day, 'YYYY-MM-DD'. */
  occurredOn: string;
  nota: string;
  createdAt: string;
}

export const CAJITA_MOV_LABELS: Record<CajitaMovKind, string> = {
  deposito: 'Depósito',
  retiro: 'Retiro',
  rendimiento: 'Rendimiento',
  ajuste: 'Ajuste de saldo',
};

import { ArrowUp, ArrowDown, Sparkles, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const CAJITA_MOV_ICON: Record<CajitaMovKind, LucideIcon> = {
  deposito: ArrowUp,
  retiro: ArrowDown,
  rendimiento: Sparkles,
  ajuste: Pencil,
};

/** Pocket icon offered when creating one. Nu's own pockets are named freely. */
export const CAJITA_ICONS = [
  'PiggyBank',
  'Tent',
  'Car',
  'Home',
  'GraduationCap',
  'Laptop',
  'Gift',
  'LifeBuoy',
  'Gem',
  'Plane'
] as const;

/**
 * A savings target. Progress comes from a linked pocket when there is one, so
 * the number can never drift from the pocket it claims to describe; otherwise
 * the user maintains it by hand.
 */
export interface Meta {
  id: string;
  nombre: string;
  icon: string;
  objetivoCop: number;
  /** 'YYYY-MM-DD', or null for an open-ended goal. */
  fechaObjetivo: string | null;
  /** When set, progress is read from this pocket's balance. */
  cajitaId: string | null;
  /** Only consulted when `cajitaId` is null. */
  ahorradoCop: number;
  createdAt: string;
  completedAt: string | null;
}
