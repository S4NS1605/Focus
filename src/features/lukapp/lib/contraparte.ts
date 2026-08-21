/**
 * Who the other side of a movement is, pulled out of the bank's description.
 *
 * This lives on the client side of the tree even though the statement templates
 * also use it, matching the direction those templates already import in
 * (server_lib -> src/features/lukapp/lib). The alternative — a copy on each
 * side — would let the analysis and the categoriser disagree about who a
 * movement was with.
 *
 * Why it matters: for a wallet-heavy account, "transferencia" swallows most of
 * the statement, and a breakdown that says "Transferencia: $2.000.000" is no
 * more useful than the "Otros" it replaced. The question worth answering is
 * *who*.
 */

/** Description shapes Colombian wallets and banks use to name a counterparty. */
const PATRONES: readonly RegExp[] = [
  /^envio con bre-?b a:\s*(.+)$/i,
  /^recibi por bre-?b de:\s*(.+)$/i,
  /^pago en qr bre-?b:\s*(.+)$/i,
  /^transferencia (?:a|de)\s+(.+)$/i,
  /^pago recibido de\s+(.+)$/i,
  /^(?:de|para)\s+(.+)$/i,
];

/** Trailing noise banks append: document numbers, office codes, app names. */
const COLA = /\s+(?:\d[\d.,-]*|app\s+\w+|s\.?a\.?s?\.?|ltda\.?)\s*$/i;

const TITULO = (texto: string): string =>
  texto
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p.length > 2 ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');

/**
 * The counterparty as a display name, or null when the description names none.
 *
 * Returns null rather than the raw description on purpose: a movement with no
 * identifiable counterparty ("Compra paquete", "Rendimientos financieros") is
 * not a transfer with an anonymous party, and grouping those together under one
 * bucket would recreate exactly the meaningless lump this exists to avoid.
 */
export const extraerContraparte = (descripcion: string): string | null => {
  const limpia = descripcion.trim();
  if (!limpia) return null;

  for (const patron of PATRONES) {
    const m = limpia.match(patron);
    if (!m) continue;

    const bruto = m[1].replace(COLA, '').trim();
    // A lone word that is not a name (a bank, a product) tells us nothing.
    if (bruto.length < 3) return null;
    return TITULO(bruto);
  }

  return null;
};
