import { CATEGORY_LABELS } from '../types';
import type { CategoriaClave, Category, TxKind } from '../types';
import type { CategoriaPersonal } from '../categorias';
import { frasesDeCategorias } from './vocabularioUsuario';
import { LEXICO_VACIO } from './aprendizaje';
import type { LexicoAprendido } from './aprendizaje';
import { detectarRecurrencia } from './senalesAvanzadas';
import { buscarSimilar, calcularConfianzaGranular, type ConfianzaGranular } from './inteligenciaAvanzada';
import { normalizeNumericToken, normalizeWord, readNumberAt } from './numerals';
import {
  AMOUNT_CUES,
  CATEGORY_KEYWORDS,
  COUNT_NOUNS,
  INCOME_IMPLIED,
  KIND_PHRASES,
  MERCHANTS,
  MERCHANT_DISPLAY,
  PAYMENT_METHODS,
} from './vocabulary';

export type AmountSource = 'digits' | 'digits+scale' | 'words' | 'slang' | 'none';
export type KindSource = 'keyword' | 'morphology' | 'category-implied' | 'default';

/**
 * How the account was decided. `preposicion` is the strong case — "a
 * Bancolombia", "desde Nequi" — where the sentence says the word is a
 * destination or an origin rather than merely mentioning it.
 */
export type CuentaSource = 'preposicion' | 'nombre' | 'ninguna';

/** An account the text may refer to by name. */
export interface CuentaConocida {
  id: string;
  nombre: string;
}
export type CategorySource = 'usuario' | 'merchant' | 'aprendida' | 'keyword' | 'default';
export type PaymentMethod =
  | 'tarjeta_credito' | 'tarjeta_debito' | 'billetera_digital'
  | 'transferencia_bancaria' | 'efectivo' | 'cheque' | 'cripto' | 'desconocido';

export interface ParsedTransaction {
  kind: TxKind;
  amount: number | null;
  /**
   * The parser itself only ever produces a built-in — it matches vocabulary, it
   * does not invent keys. The type is wider because this same shape is the edit
   * buffer for an existing movement, which may well be filed under a category
   * the user created, and narrowing here would silently drop it on every edit.
   */
  category: CategoriaClave;
  /** Which balance the text named, when it named one. */
  cuentaId: string | null;
  description: string;
  /** The untouched input, always. A mis-parse must stay reconstructable. */
  raw: string;
  confidence: number;
  confianzaGranular: ConfianzaGranular;
  needsReview: boolean;
  signals: {
    amountSource: AmountSource;
    kindSource: KindSource;
    categorySource: CategorySource;
    cuentaSource: CuentaSource;
    paymentMethod: PaymentMethod;
    recurringPattern: 'diario' | 'semanal' | 'mensual' | 'anual' | 'ninguno';
    /** More than one viable amount was found. */
    ambiguousAmount: boolean;
    destinatario: string | null;
    ubicacion: string | null;
    tags: string[];
  };
  suggestedCategories: CategoriaClave[];
}

interface Token {
  raw: string;
  norm: string;
}

interface Candidate {
  value: number;
  start: number;
  end: number;
  score: number;
  hasScale: boolean;
  usedDigits: boolean;
  usedWords: boolean;
  usedSlang: boolean;
}

const WEIGHTS = {
  amount: 0.5,
  kindKeyword: 0.3,
  kindImplied: 0.15,
  // Una categoría que el usuario nombró expresamente vale como una marca: es una
  // señal explícita suya, no una adivinanza de una lista genérica.
  userCategory: 0.2,
  merchant: 0.2,
  // Lo aprendido del historial pesa más que la lista genérica —es lo que TÚ
  // haces— pero menos que una señal explícita del momento.
  learned: 0.16,
  categoryKeyword: 0.12,
  ambiguityPenalty: 0.1,
};

const REVIEW_THRESHOLD = 0.7;

/**
 * Splits on whitespace and strips surrounding punctuation, then normalizes each
 * token individually. Per-token normalization is deliberate: de-accenting changes
 * string length, so any offset computed against a whole-string normalized copy
 * would drift for everything after the first accented character.
 */
const tokenize = (input: string): Token[] => {
  const out: Token[] = [];

  for (const piece of input.split(/\s+/)) {
    if (!piece) continue;

    const trimmed = piece
      .replace(/^[^\p{L}\p{N}$]+/u, '')
      .replace(/[^\p{L}\p{N}]+$/u, '');
    if (!trimmed) continue;

    for (const norm of normalizeNumericToken(normalizeWord(trimmed))) {
      if (norm) out.push({ raw: trimmed, norm });
    }
  }

  return out;
};

/** Every maximal numeral in the input, with the token span it occupies. */
const findAmountCandidates = (tokens: readonly Token[]): Candidate[] => {
  const norms = tokens.map((t) => t.norm);
  const out: Candidate[] = [];

  let i = 0;
  while (i < norms.length) {
    const match = readNumberAt(norms, i);
    if (!match) {
      i += 1;
      continue;
    }

    const before = i > 0 ? norms[i - 1] : undefined;
    const after = norms[match.next];

    let score = 0;
    if (match.hasScale) score += 3;
    if (match.value >= 1000) score += 2;
    if (before && AMOUNT_CUES.has(before)) score += 1;
    // "compré 2 pizzas por 30 mil" — the 2 is a quantity, not the amount.
    if (after && COUNT_NOUNS.has(after)) score -= 2;

    out.push({
      value: match.value,
      start: i,
      end: match.next,
      score,
      hasScale: match.hasScale,
      usedDigits: match.usedDigits,
      usedWords: match.usedWords,
      usedSlang: match.usedSlang,
    });

    i = match.next;
  }

  return out;
};

const pickBest = (candidates: readonly Candidate[]): Candidate | null => {
  if (candidates.length === 0) return null;

  return candidates.reduce((best, c) => {
    if (c.score !== best.score) return c.score > best.score ? c : best;
    if (c.hasScale !== best.hasScale) return c.hasScale ? c : best;
    if (c.value !== best.value) return c.value > best.value ? c : best;
    return best;
  });
};

const classifyAmountSource = (c: Candidate): AmountSource => {
  if (c.usedSlang) return 'slang';
  if (c.usedDigits && c.hasScale) return 'digits+scale';
  if (c.usedWords && !c.usedDigits) return 'words';
  return 'digits';
};

/** Strips a plural suffix so `clases` finds the `clase` keyword. Kept
 *  conservative: only long tokens, and only after an exact lookup failed. */
const lookupWithStem = <T,>(table: Record<string, T>, norm: string): T | undefined => {
  const exact = table[norm];
  if (exact !== undefined) return exact;
  if (norm.length <= 4) return undefined;
  if (norm.endsWith('es')) {
    const stem = table[norm.slice(0, -2)];
    if (stem !== undefined) return stem;
  }
  if (norm.endsWith('s')) return table[norm.slice(0, -1)];
  return undefined;
};

const MORPHOLOGICAL_INCOME = /(aron|eron|ieron)$/;

/**
 * Words that turn a mention into a direction.
 *
 * "me transfirieron 20 mil A BANCOLOMBIA" says where the money landed; a bare
 * "Bancolombia" might just be part of a description. Both are accepted, but a
 * prepositional match wins when the sentence offers more than one.
 */
const PREPOSICIONES_DE_CUENTA = new Set([
  'a', 'al', 'de', 'del', 'en', 'desde', 'con', 'hacia', 'para', 'hasta', 'por',
]);

interface CuentaHallada {
  id: string;
  start: number;
  end: number;
  source: CuentaSource;
}

/**
 * Finds an account named in the text.
 *
 * Longest name first, so "Banco de Bogotá" is never resolved as a stray "Banco"
 * when both exist. Matching is on normalized tokens — the same normalization the
 * rest of the parser uses — so accents and casing are already handled, and it is
 * whole-token equality rather than substring: "NU" must not match inside
 * "nunca".
 */
const buscarCuenta = (
  tokens: readonly Token[],
  consumed: readonly boolean[],
  cuentas: readonly CuentaConocida[],
): CuentaHallada | null => {
  const candidatas = cuentas
    .map((c) => ({
      id: c.id,
      seq: c.nombre.split(/\s+/).map(normalizeWord).filter(Boolean),
    }))
    .filter((c) => c.seq.length > 0)
    .sort((a, b) => b.seq.length - a.seq.length);

  const hallazgos: CuentaHallada[] = [];

  for (const candidata of candidatas) {
    const span = candidata.seq.length;
    for (let i = 0; i + span <= tokens.length; i += 1) {
      let calza = true;
      for (let k = 0; k < span; k += 1) {
        if (consumed[i + k] || tokens[i + k].norm !== candidata.seq[k]) {
          calza = false;
          break;
        }
      }
      if (!calza) continue;

      // Overlapping a longer name already found means this is a fragment of it.
      if (hallazgos.some((h) => i < h.end && i + span > h.start)) continue;

      const anterior = i > 0 && !consumed[i - 1] ? tokens[i - 1].norm : null;
      const conPreposicion = anterior !== null && PREPOSICIONES_DE_CUENTA.has(anterior);
      hallazgos.push({
        id: candidata.id,
        start: conPreposicion ? i - 1 : i,
        end: i + span,
        source: conPreposicion ? 'preposicion' : 'nombre',
      });
    }
  }

  if (hallazgos.length === 0) return null;
  return hallazgos.find((h) => h.source === 'preposicion') ?? hallazgos[0];
};

const detectAndConsumePaymentMethod = (tokens: readonly Token[], consumed: boolean[]): PaymentMethod => {
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const method = PAYMENT_METHODS[tokens[i].norm];
    if (method) {
      consumed[i] = true;
      if (i > 0 && !consumed[i - 1] && (tokens[i - 1].norm === 'con' || tokens[i - 1].norm === 'en')) {
        consumed[i - 1] = true;
      }
      return method as PaymentMethod;
    }
  }
  return 'desconocido';
};

export const parseTransaction = (
  raw: string,
  /**
   * Optional so every caller that does not care about attribution keeps working
   * — and so the parser stays a pure function of its inputs rather than reaching
   * for app state.
   */
  cuentas: readonly CuentaConocida[] = [],
  /**
   * Las categorías que el usuario creó. Se reconocen por su nombre y ganan sobre
   * las adivinanzas de fábrica: es su taxonomía, dicha explícitamente.
   */
  categorias: readonly CategoriaPersonal[] = [],
  /**
   * Lo aprendido del historial: qué categoría suele tener cada palabra para este
   * usuario. Gana sobre la lista genérica de fábrica, pero no sobre lo que dijo
   * explícitamente (una categoría nombrada o una marca conocida).
   */
  lexico: LexicoAprendido = LEXICO_VACIO,
): ParsedTransaction => {
  const tokens = tokenize(raw);
  const consumed = new Array<boolean>(tokens.length).fill(false);

  // 1 — Amount. Extracted FIRST, and its tokens are removed from everything
  // downstream, so the category matcher can never see `mil` and the description
  // never repeats the number.
  const candidates = findAmountCandidates(tokens);
  const best = pickBest(candidates);
  const amount = best ? best.value : null;
  if (best) {
    for (let i = best.start; i < best.end; i += 1) consumed[i] = true;
  }

  const available = () =>
    tokens
      .map((t, index) => ({ ...t, index }))
      .filter((t) => !consumed[t.index]);

  // 2 — Direction. Longest phrase first, so "me costó" (expense) is never
  // mistaken for the income sense of a leading "me".
  let kind: TxKind = 'gasto';
  let kindSource: KindSource = 'default';

  const forKind = available();
  outer: for (const phrase of KIND_PHRASES) {
    const span = phrase.seq.length;
    for (let i = 0; i + span <= forKind.length; i += 1) {
      if (phrase.seq.every((s, k) => forKind[i + k].norm === s)) {
        kind = phrase.kind;
        kindSource = 'keyword';
        for (let k = 0; k < span; k += 1) consumed[forKind[i + k].index] = true;
        break outer;
      }
    }
  }

  if (kindSource === 'default') {
    // Generalizes past the phrase table: dictation produces conjugations nobody
    // enumerated. Only the income direction is inferred — a `-é`/`-í` rule for
    // expenses would add nothing over the default and would misfire on ordinary
    // nouns ending in those letters ("carne", "taxi"). The expense verbs that
    // DO end in -aron ("me cobraron", "me descontaron") are listed explicitly in
    // KIND_PHRASES precisely so they are caught before reaching this rule.
    const list = available();
    for (let i = 0; i < list.length - 1; i += 1) {
      if (list[i].norm === 'me' && MORPHOLOGICAL_INCOME.test(list[i + 1].norm)) {
        kind = 'ingreso';
        kindSource = 'morphology';
        consumed[list[i].index] = true;
        consumed[list[i + 1].index] = true;
        break;
      }
    }
  }

  if (kindSource === 'default') {
    // "el salario de este mes" needs no direction verb to be understood.
    if (available().some((t) => INCOME_IMPLIED.has(t.norm))) {
      kind = 'ingreso';
      kindSource = 'category-implied';
    }
  }

  // 3 — Category. Token equality only, never substring: `ara` is inside "para",
  // `mil` inside "familia", `d1` inside "d10", `uno` inside "desayuno".
  let category: CategoriaClave = 'otros';
  let categorySource: CategorySource = 'default';
  const categoryCandidates: Map<string, { source: CategorySource; score: number }> = new Map();

  const addCategoryScore = (cat: string, source: CategorySource, score: number) => {
    const existing = categoryCandidates.get(cat);
    if (!existing || existing.score < score) {
      categoryCandidates.set(cat, { source, score });
    }
  };

  // 3a — Las categorías del usuario, por su nombre. Van PRIMERO: si nombró una
  // categoría suya, esa gana sobre la marca o la palabra genérica que pudiera
  // caer en otra cosa. Sus tokens no se consumen, igual que las keywords: para
  // una categoría "Mascotas", "mascotas" es justo lo que la fila debe decir.
  const frasesCat = frasesDeCategorias(categorias);
  const dispon = available();
  
  for (const frase of frasesCat) {
    const span = frase.seq.length;
    for (let i = 0; i + span <= dispon.length; i += 1) {
      if (frase.seq.every((s, k) => dispon[i + k].norm === s)) {
        addCategoryScore(frase.id, 'usuario', 100);
      }
    }
  }

  for (const token of dispon) {
    const merchant = MERCHANTS[token.norm];
    if (merchant) {
      addCategoryScore(merchant, 'merchant', 80);
    }
    if (token.norm.length > 4) {
      const similar = buscarSimilar(token.norm, Object.keys(MERCHANTS), 2);
      if (similar && similar.length > 3) {
        addCategoryScore(MERCHANTS[similar], 'merchant', 70);
      }
    }

    const aprendida = lexico.categoriaDe(token.norm);
    if (aprendida) {
      addCategoryScore(aprendida, 'aprendida', 60);
    }

    const keyword = lookupWithStem(CATEGORY_KEYWORDS, token.norm);
    if (keyword) {
      addCategoryScore(keyword, 'keyword', 50);
    }
    if (token.norm.length > 4) {
      const similar = buscarSimilar(token.norm, Object.keys(CATEGORY_KEYWORDS), 2);
      if (similar && similar.length > 3) {
        const keywordSimilar = lookupWithStem(CATEGORY_KEYWORDS, similar);
        if (keywordSimilar) {
          addCategoryScore(keywordSimilar, 'keyword', 40);
        }
      }
    }
  }

  const sortedCandidates = Array.from(categoryCandidates.entries()).sort((a, b) => b[1].score - a[1].score);
  
  if (sortedCandidates.length > 0) {
    category = sortedCandidates[0][0];
    categorySource = sortedCandidates[0][1].source;
  }

  if (categorySource === 'default' && kind === 'ingreso') {
    category = 'ingreso';
    addCategoryScore('ingreso', 'default', 10);
  }

  // 4 — Account. Its tokens ARE consumed, unlike category keywords: once the
  // bank is a structured field on the movement, repeating it in the description
  // says the same thing twice.
  const hallada = buscarCuenta(tokens, consumed, cuentas);
  if (hallada) {
    for (let i = hallada.start; i < hallada.end; i += 1) consumed[i] = true;
  }
  const cuentaId = hallada ? hallada.id : null;
  const cuentaSource: CuentaSource = hallada ? hallada.source : 'ninguna';

  // 5 — Payment method. Consumed so 'en efectivo' or 'con tarjeta' doesn't leak into description.
  const paymentMethod = detectAndConsumePaymentMethod(tokens, consumed);

  // 6 — Semantic Chunker for Destinatario, Ubicacion, and Motivo
  let destinatario: string | null = null;
  let ubicacion: string | null = null;
  const tags: string[] = [];

  let currentChunk: 'motivo' | 'destinatario' | 'ubicacion' | 'ignore' = 'motivo';
  const chunks: Record<'motivo' | 'destinatario' | 'ubicacion' | 'ignore', Token[]> = {
    motivo: [],
    destinatario: [],
    ubicacion: [],
    ignore: []
  };

  const avail = available();
  for (let i = 0; i < avail.length; i++) {
    const t = avail[i];
    const n = t.norm;
    const nextToken = i + 1 < avail.length ? avail[i + 1].norm : '';

    if (n === 'a' || n === 'hacia') {
      currentChunk = 'destinatario';
      continue;
    }
    if (n === 'para') {
      if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(nextToken)) {
        currentChunk = 'motivo';
      } else {
        currentChunk = 'destinatario';
      }
      continue;
    }
    if (n === 'en' || n === 'desde') {
      currentChunk = 'ubicacion';
      continue;
    }
    if (n === 'por' || n === 'concepto') {
      currentChunk = 'motivo';
      continue;
    }
    if (n === 'con') {
      currentChunk = 'ignore';
      continue;
    }

    if (['viaje', 'regalo', 'emergencia', 'salud', 'vacaciones', 'fiesta', 'prestamo', 'comida', 'transporte', 'suscripcion'].includes(n)) {
      if (!tags.includes(t.raw)) tags.push(t.raw);
    }

    chunks[currentChunk].push(t);
  }

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  if (chunks.destinatario.length > 0) {
    destinatario = capitalize(chunks.destinatario.map(t => t.raw).join(' '));
  }
  if (chunks.ubicacion.length > 0) {
    ubicacion = capitalize(chunks.ubicacion.map(t => t.raw).join(' '));
  }

  // 6 — Description (Full conversational phrasing)
  const words = avail
    .filter(t => !chunks.ignore.includes(t)) // Don't include payment methods or their prepositions
    .map((t) => MERCHANT_DISPLAY[t.norm] ?? t.raw);

  let description = words.join(' ').trim();
  if (description === '') {
    description = CATEGORY_LABELS[category as Category] ?? category;
  } else {
    description = capitalize(description);
  }

  const timeMatch = raw.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
  if (timeMatch && !description.includes(timeMatch[0])) {
    description += ` (${timeMatch[0]})`;
  }

  // 6 — Confidence. Drives PRESENTATION only: the confirm sheet always opens,
  // and this decides which field gets highlighted and focused.
  let confidence = 0;
  if (amount !== null) confidence += WEIGHTS.amount;
  if (kindSource === 'keyword' || kindSource === 'morphology') confidence += WEIGHTS.kindKeyword;
  else if (kindSource === 'category-implied') confidence += WEIGHTS.kindImplied;
  if (categorySource === 'usuario') confidence += WEIGHTS.userCategory;
  else if (categorySource === 'merchant') confidence += WEIGHTS.merchant;
  else if (categorySource === 'aprendida') confidence += WEIGHTS.learned;
  else if (categorySource === 'keyword') confidence += WEIGHTS.categoryKeyword;

  const ambiguousAmount = candidates.length > 1;
  if (ambiguousAmount) confidence -= WEIGHTS.ambiguityPenalty;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  const confianzaGranular = calcularConfianzaGranular(
    amount,
    kindSource !== 'default',
    categorySource,
    cuentaId !== null,
    paymentMethod !== 'desconocido',
  );

  const suggestedCategories = [
    category,
    ...sortedCandidates.filter(c => c[0] !== category).map(c => c[0]),
    'otros', 'comida', 'transporte'
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);

  return {
    kind,
    amount,
    category,
    suggestedCategories,
    cuentaId,
    description,
    raw,
    confidence,
    confianzaGranular,
    needsReview: amount === null || kindSource === 'default' || confidence < REVIEW_THRESHOLD,
    signals: {
      amountSource: best ? classifyAmountSource(best) : 'none',
      kindSource,
      categorySource,
      cuentaSource,
      paymentMethod,
      recurringPattern: detectarRecurrencia(raw).patrón,
      ambiguousAmount,
      destinatario,
      ubicacion,
      tags,
    },
  };
};

/**
 * An empty movement, for filling in by hand.
 *
 * Same shape the parser returns, so the confirm sheet needs no notion of "was
 * this dictated or typed" — it opens on a blank form, with the amount field
 * focused because `amountSource: 'none'` is exactly what it means here: nothing
 * was understood, because nothing was said.
 */
export const movimientoEnBlanco = (): ParsedTransaction => ({
  kind: 'gasto',
  amount: null,
  category: 'otros',
  cuentaId: null,
  description: '',
  raw: '',
  confidence: 0,
  confianzaGranular: { monto: 0, tipo: 0, categoria: 0, cuenta: 0, metodo: 0 },
  needsReview: true,
  signals: {
    amountSource: 'none',
    kindSource: 'default',
    categorySource: 'default',
    cuentaSource: 'ninguna',
    paymentMethod: 'desconocido',
    recurringPattern: 'ninguno',
    ambiguousAmount: false,
    destinatario: null,
    ubicacion: null,
    tags: [],
  },
  suggestedCategories: ['otros', 'comida', 'transporte'],
});
