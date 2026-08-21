import { MERCHANTS, CATEGORY_KEYWORDS } from '../../src/features/lukapp/lib/vocabulary.ts';
import { normalizeWord } from '../../src/features/lukapp/lib/numerals.ts';
import { extraerContraparte } from '../../src/features/lukapp/lib/contraparte.ts';
import type { Category } from '../../src/features/lukapp/types.ts';
import type { MotivoExclusion } from '../../src/features/lukapp/analista/tipos.ts';

/**
 * Statement descriptions are bank jargon ("COMPRA EN MAKRO IBAG"), not spoken
 * Spanish, but they are still whitespace-separated Spanish/brand tokens — so the
 * same merchant table and category keywords the voice parser uses apply here
 * too, rather than duplicating that list.
 */
/**
 * Shapes a description can take that no single word reveals.
 *
 * Wallets like Nequi label person-to-person movements as just "De <NAME>" or
 * "Para <NAME>". There is no merchant and no keyword in that — only structure —
 * so a word-by-word lookup files every one of them under "otros". On a real
 * statement that was 80 of 105 rows, which made the whole breakdown useless.
 *
 * Checked AFTER merchants and keywords on purpose: "Para Exito" is a shop, not
 * a friend, and the merchant table has to win.
 */
const PATRONES_CATEGORIA: ReadonlyArray<{ patron: RegExp; categoria: Category }> = [
  // Interest the wallet pays on the balance. Income, not a mystery expense.
  { patron: /^pago de intereses|^intereses|^rendimientos?\b/, categoria: 'ingreso' },
  // "Pago recibido de <BUSINESS>" — a payment collected, e.g. through a gateway.
  { patron: /^pago recibido/, categoria: 'ingreso' },
  // Two or more capitalised-name words after De/Para: a person, not a shop.
  { patron: /^(de|para)\s+[a-z]{2,}(\s+[a-z.]+)+$/, categoria: 'transferencia' },
];

export const categorizarDescripcion = (descripcion: string): Category => {
  const normalizada = normalizeWord(descripcion);
  const palabras = normalizada.split(/\s+/).filter(Boolean);

  for (const palabra of palabras) {
    const categoria = MERCHANTS[palabra];
    if (categoria) return categoria;
  }
  for (const palabra of palabras) {
    const categoria = CATEGORY_KEYWORDS[palabra];
    if (categoria) return categoria;
  }
  for (const { patron, categoria } of PATRONES_CATEGORIA) {
    if (patron.test(normalizada)) return categoria;
  }
  return 'otros';
};

/**
 * Patterns that mark a statement line as something other than real income or
 * spending — moving money between the owner's own products, or settling a
 * credit card whose purchases already appear as their own lines.
 *
 * This is necessarily heuristic without knowing the owner's own name or which
 * other accounts are theirs: it keys off wording Colombian banks use for those
 * specific movements (Nequi/Bancolombia cross-references, BRE-B — the
 * interbank instant-transfer rail typically used to move between one's own
 * wallets — and cash top-ups/withdrawals at a corresponsal). A wrongly
 * classified row is always visible in the exclusions list, never silently
 * dropped — see `totalesDelAnalisis`.
 */
const PATRONES_EXCLUSION: ReadonlyArray<{ patron: RegExp; motivo: MotivoExclusion }> = [
  { patron: /pagaste tu tarjeta|pago tarjeta de credito|pago tc\b/, motivo: 'pago-tarjeta' },
  { patron: /reverso|devolucion|nota credito|anulacion/, motivo: 'reverso' },
  { patron: /saldo anterior|saldo actual|saldo promedio/, motivo: 'saldo-informativo' },
  {
    // Deliberately no longer matches BRE-B on its own — see `esContraparteElTitular`.
    //
    // `bolsillo` is Davivienda's savings pocket inside the same account. Its
    // statement prints BOTH sides of every move: the account section shows the
    // debit and the pocket section shows the matching credit, same document
    // number. Counting them would double the month's figures with money that
    // never left.
    patron:
      /\bnequi\b|\bbancolombia\b|\bbolsillo\b|recarga desde|recarga en corresponsal|retiro en corresponsal|transferencia cta suc virtual/,
    motivo: 'traslado-propio',
  },
];

/**
 * Whether the other side of a movement is the account holder themselves.
 *
 * This replaces treating every BRE-B line as an internal transfer. BRE-B is
 * Colombia's instant payment rail, not an own-accounts feature: it moves money
 * to shops and to other people just as readily. Excluding all of it removed
 * real spending from the totals — on one statement, payments to another person
 * and a QR payment at a restaurant were all filed as "moved between my own
 * accounts", quietly understating what was actually spent.
 *
 * The test is deliberately strict: EVERY word of the counterparty must be one
 * of the holder's own name words. "JULIAN" against "Julian Santiago Gonzalez
 * Reina" is theirs; "LEIDYS" and "ASADOS" are not. Requiring a subset rather
 * than any single shared word keeps a payment to a different Julián from being
 * swallowed — though a namesake remains genuinely ambiguous, which is why these
 * rows stay visible in the exclusions list instead of vanishing.
 */
export const esContraparteElTitular = (descripcion: string, titular: string): boolean => {
  const propias = new Set(
    normalizeWord(titular)
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
  if (propias.size === 0) return false;

  const esSuyo = (texto: string): boolean => {
    const palabras = normalizeWord(texto)
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    return palabras.length > 0 && palabras.every((w) => propias.has(w));
  };

  // One extractor shared with the analysis views, so the categoriser and the
  // "who did I pay" breakdown can never disagree about who a movement was with.
  const contraparte = extraerContraparte(descripcion);
  if (contraparte) return esSuyo(contraparte);

  // No prefix at all — the wallet sometimes prints the counterparty bare, and
  // for movements between the holder's own products that is their own name.
  return esSuyo(descripcion);
};

export const exclusionDeDescripcion = (
  descripcion: string,
  /** Account holder as printed on the statement, when the template found it. */
  titular?: string,
): MotivoExclusion | null => {
  const normalizada = normalizeWord(descripcion);
  for (const { patron, motivo } of PATRONES_EXCLUSION) {
    if (patron.test(normalizada)) return motivo;
  }
  if (titular && esContraparteElTitular(descripcion, titular)) return 'traslado-propio';
  return null;
};
