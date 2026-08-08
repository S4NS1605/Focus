import type { Transaction } from '../types';
import { normalizeWord } from '../lib/numerals';
import type { MovimientoExtraido } from './tipos';

export interface PlanDeImportacion {
  /** Ready to write. */
  nuevos: Transaction[];
  /** Already in the ledger — same day, amount, direction and description. */
  duplicados: MovimientoExtraido[];
  /** Flagged as not real movements; never imported automatically. */
  excluidos: MovimientoExtraido[];
}

/**
 * Identity of a movement for duplicate detection: the day, the direction, the
 * exact amount, and the normalized description. Deliberately NOT the raw
 * description — "MERCADO EXITO" and "Mercado Éxito" are the same line.
 */
export const claveDeMovimiento = (
  fecha: string,
  tipo: string,
  montoCop: number,
  descripcion: string,
): string =>
  [fecha, tipo, montoCop, normalizeWord(descripcion).replace(/\s+/g, ' ').trim()].join('|');

const claveDeTransaccion = (tx: Transaction): string =>
  claveDeMovimiento(tx.occurredOn, tx.kind, tx.amountCop, tx.description);

/**
 * Works out what to import, given what is already stored.
 *
 * Duplicates are counted, not merely detected. A key that simply had to be
 * absent would collapse two genuinely separate identical purchases — two $5.000
 * coffees on the same day are two movements, and a statement that lists them
 * twice is telling the truth. So the rule is: import the number of occurrences
 * the incoming statement has BEYOND what the ledger already holds for that key.
 *
 * That makes re-uploading the same statement a no-op, uploading an overlapping
 * statement import only the new lines, and two identical coffees survive as two.
 */
export const planearImportacion = (
  movimientos: readonly MovimientoExtraido[],
  existentes: readonly Transaction[],
  hacerId: () => string,
  ahora: () => string = () => new Date().toISOString(),
): PlanDeImportacion => {
  const yaTengo = new Map<string, number>();
  for (const tx of existentes) {
    const clave = claveDeTransaccion(tx);
    yaTengo.set(clave, (yaTengo.get(clave) ?? 0) + 1);
  }

  const nuevos: Transaction[] = [];
  const duplicados: MovimientoExtraido[] = [];
  const excluidos: MovimientoExtraido[] = [];

  for (const mov of movimientos) {
    if (mov.exclusion) {
      excluidos.push(mov);
      continue;
    }

    // A movement of nothing is not a movement. Statements do carry such rows —
    // sub-peso interest that rounds to zero, informational lines — and the
    // schema rejects them outright (`check (amount_cop > 0)`), which surfaced
    // to the user as a raw Postgres constraint name. Dropping them here keeps
    // one bad row from failing the entire import.
    if (!Number.isFinite(mov.montoCop) || Math.round(mov.montoCop) <= 0) {
      continue;
    }

    const clave = claveDeMovimiento(mov.fecha, mov.tipo, mov.montoCop, mov.descripcion);
    const restantes = yaTengo.get(clave) ?? 0;

    if (restantes > 0) {
      // Consume one slot: a second identical incoming row will not match again.
      yaTengo.set(clave, restantes - 1);
      duplicados.push(mov);
      continue;
    }

    nuevos.push({
      id: hacerId(),
      kind: mov.tipo,
      amountCop: mov.montoCop,
      category: mov.categoria,
      description: mov.descripcion,
      occurredOn: mov.fecha,
      // Provenance, so a row imported from a statement is always distinguishable
      // from one that was dictated.
      rawTranscript: `extracto: ${mov.descripcion}`,
      createdAt: ahora(),
    });
  }

  return { nuevos, duplicados, excluidos };
};
