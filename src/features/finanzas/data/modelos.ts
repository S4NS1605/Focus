import type { Category } from '../types';

// Domain objects that live alongside transactions: Nu-style savings pockets and
// the goals tracked on top of them. Transactions themselves stay in ../types.ts.

/**
 * What a balance belongs to.
 *
 * A bank account and a savings pocket are the same thing structurally: a balance
 * the user maintains by hand, with a history of movements behind it. Splitting
 * them into two entities would have duplicated the balance maths, the "just tell
 * me what you have" flow, the history and the yield calculation — so they share
 * one shape and differ only in how they are grouped and totalled.
 */
export type CajitaTipo = 'cuenta' | 'cajita' | 'deuda' | 'tarjeta';

/**
 * Debts and credit cards are the same structure INVERTED: the balance is what
 * you owe rather than what you have, so a purchase raises it and a payment
 * lowers it. Sharing the shape keeps one implementation of the balance, the
 * history and the "just tell me the number" flow; only the wording, the sign of
 * each action and how it is totalled differ.
 */
export const ES_PASIVO: Record<CajitaTipo, boolean> = {
  cuenta: false,
  cajita: false,
  deuda: true,
  tarjeta: true,
};

export const TIPO_LABELS: Record<CajitaTipo, string> = {
  cuenta: 'Cuenta bancaria',
  cajita: 'Cajita de ahorro',
  deuda: 'Deuda',
  tarjeta: 'Tarjeta de crédito',
};

/** A balance tracked by hand — nothing here talks to a bank. */
export interface Cajita {
  id: string;
  nombre: string;
  icon: string;
  /** Defaults to 'cajita' so rows written before accounts existed still load. */
  tipo: CajitaTipo;
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
export type CajitaMovKind =
  | 'deposito'
  | 'retiro'
  | 'rendimiento'
  | 'ajuste'
  /** A purchase on a card, or new money owed. Raises what you owe. */
  | 'compra'
  /** Money paid against a debt or card. Lowers what you owe. */
  | 'abono';

export interface CajitaMovimiento {
  id: string;
  cajitaId: string;
  kind: CajitaMovKind;
  /** Signed COP delta: positive adds to the pocket, negative takes out. */
  deltaCop: number;
  /**
   * What the money was for. Only meaningful on cards and debts, where the whole
   * point is being able to say what each charge was — a balance that only goes
   * up with no explanation is exactly the problem a card statement has.
   */
  categoria: Category | null;
  /** Bogota calendar day, 'YYYY-MM-DD'. */
  occurredOn: string;
  nota: string;
  createdAt: string;
}

export const CAJITA_MOV_LABELS: Record<CajitaMovKind, string> = {
  compra: 'Compra',
  abono: 'Abono',
  deposito: 'Depósito',
  retiro: 'Retiro',
  rendimiento: 'Rendimiento',
  ajuste: 'Ajuste de saldo',
};

import { ArrowDown, ArrowUp, HandCoins, Pencil, ShoppingBag, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const CAJITA_MOV_ICON: Record<CajitaMovKind, LucideIcon> = {
  compra: ShoppingBag,
  abono: HandCoins,
  deposito: ArrowUp,
  retiro: ArrowDown,
  rendimiento: Sparkles,
  ajuste: Pencil,
};

/** Pocket icon offered when creating one. Nu's own pockets are named freely. */
/**
 * The cash account.
 *
 * A fixed id rather than a generated one so seeding is idempotent: the app can
 * check whether it exists — archived or not — and never end up with two. It is
 * an ordinary `cuenta` in every other respect, so it has a balance, shows up in
 * Configuración, and can be renamed or archived like the rest.
 */
export const ID_EFECTIVO = '00000000-0000-4000-8000-0000000000ef';

/**
 * El id que tuvo esta cuenta antes.
 *
 * Era la cadena 'efectivo', legible pero inválida: `cajitas.id` es `uuid` en
 * Postgres, así que la cuenta nunca llegó a guardarse y cualquier movimiento
 * que la nombrara moría con "invalid input syntax for type uuid". Se conserva
 * para poder reescribir los datos que ya quedaron apuntando ahí.
 */
export const ID_EFECTIVO_VIEJO = 'efectivo';

export const cuentaEfectivo = (createdAt: string): Cajita => ({
  id: ID_EFECTIVO,
  nombre: 'Efectivo',
  icon: 'Wallet',
  tipo: 'cuenta',
  metaCop: null,
  tasaEaPct: null,
  createdAt,
  archivedAt: null,
});

export const CAJITA_ICONS = [
  'Wallet',
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
