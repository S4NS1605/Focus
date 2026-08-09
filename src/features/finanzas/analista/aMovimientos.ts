import type { Transaction } from '../types';
import { normalizeWord } from '../lib/numerals';
import type { MovimientoExtraido } from './tipos';

export interface PosibleDuplicado {
  movimiento: MovimientoExtraido;
  /** The entry already in the ledger it might be the same as. */
  yaTengo: Transaction;
  /** Ready to write, for when the user says they are genuinely different. */
  transaccion: Transaction;
}

export interface PlanDeImportacion {
  /** Ready to write. */
  nuevos: Transaction[];
  /** Already in the ledger — same day, amount, direction and description. */
  duplicados: MovimientoExtraido[];
  /**
   * Same day, direction and amount as something already recorded, but worded
   * differently — which is the normal case for anything entered by hand.
   *
   * Neither bucket above is honest for these. Importing them silently doubles
   * what you dictated; dropping them silently loses two genuinely separate
   * $20.000 expenses on the same day. So they are surfaced and the user decides.
   */
  posibles: PosibleDuplicado[];
  /** Flagged as not real movements; never imported automatically. */
  excluidos: MovimientoExtraido[];
}

/** Same day, same direction, same amount — ignoring how it is worded. */
const claveAproximada = (fecha: string, tipo: string, montoCop: number): string =>
  [fecha, tipo, montoCop].join('|');

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
  /** Account the statement belongs to, so imported rows move its balance. */
  cuentaId: string | null = null,
): PlanDeImportacion => {
  const yaTengo = new Map<string, number>();
  const porAproximada = new Map<string, Transaction[]>();
  for (const tx of existentes) {
    const clave = claveDeTransaccion(tx);
    yaTengo.set(clave, (yaTengo.get(clave) ?? 0) + 1);

    const aprox = claveAproximada(tx.occurredOn, tx.kind, tx.amountCop);
    const lista = porAproximada.get(aprox);
    if (lista) lista.push(tx);
    else porAproximada.set(aprox, [tx]);
  }

  /**
   * An entry can only be matched once, by either route.
   *
   * Without this, a row that matched EXACTLY would still sit in the approximate
   * index, so a second identical statement line would claim it again — and two
   * genuinely separate identical purchases would stop importing.
   */
  const reclamados = new Set<string>();

  const reclamarExacto = (clave: string): void => {
    const [fecha, tipo, monto] = clave.split('|');
    const lista = porAproximada.get([fecha, tipo, monto].join('|'));
    const yaVisto = lista?.find(
      (t) => !reclamados.has(t.id) && claveDeTransaccion(t) === clave,
    );
    if (yaVisto) reclamados.add(yaVisto.id);
  };

  const nuevos: Transaction[] = [];
  const duplicados: MovimientoExtraido[] = [];
  const posibles: PosibleDuplicado[] = [];
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
      reclamarExacto(clave);
      duplicados.push(mov);
      continue;
    }

    const construir = (): Transaction => ({
      id: hacerId(),
      kind: mov.tipo,
      amountCop: mov.montoCop,
      category: mov.categoria,
      description: mov.descripcion,
      occurredOn: mov.fecha,
      cuentaId,
      rawTranscript: `extracto: ${mov.descripcion}`,
      createdAt: ahora(),
    });

    // Worded differently, but landing on the same day for the same amount and
    // direction. Claimed one-for-one so a single manual entry cannot absorb
    // three separate statement lines.
    const candidatos = porAproximada.get(claveAproximada(mov.fecha, mov.tipo, mov.montoCop));
    const yaTeniaUno = candidatos?.find((t) => !reclamados.has(t.id));
    if (yaTeniaUno) {
      reclamados.add(yaTeniaUno.id);
      posibles.push({ movimiento: mov, yaTengo: yaTeniaUno, transaccion: construir() });
      continue;
    }

    // Provenance lives in rawTranscript, so a row imported from a statement is
    // always distinguishable from one that was dictated.
    nuevos.push(construir());
  }

  return { nuevos, duplicados, posibles, excluidos };
};
