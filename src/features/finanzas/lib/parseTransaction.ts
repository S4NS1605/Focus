import { CATEGORY_LABELS } from '../types';
import type { CategoriaClave, Category, TxKind } from '../types';
import type { CategoriaPersonal } from '../categorias';
import { frasesDeCategorias } from './vocabularioUsuario';
import { LEXICO_VACIO } from './aprendizaje';
import type { LexicoAprendido } from './aprendizaje';
import type { Transaction } from '../types';
import { detectarRecurrencia } from './senalesAvanzadas';
import {
  buscarSimilar,
  calcularConfianzaGranular,
  type ConfianzaGranular,
} from './inteligenciaAvanzada';
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

const DIAS_SEMANA = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};
const MESES_ANO = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

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
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'billetera_digital'
  | 'transferencia_bancaria'
  | 'efectivo'
  | 'cheque'
  | 'cripto'
  | 'desconocido';

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
  /** Extracted date override in YYYY-MM-DD format, e.g. from 'ayer' or 'anoche'. */
  dateOverride?: string;
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
export const tokenize = (input: string): Token[] => {
  const out: Token[] = [];

  for (const piece of input.split(/\s+/)) {
    if (!piece) continue;

    let trimmed = piece.replace(/^[^\p{L}\p{N}$]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');

    if (!trimmed && piece.includes('$')) {
      trimmed = '$';
    }

    if (!trimmed) continue;

    for (const norm of normalizeNumericToken(normalizeWord(trimmed))) {
      if (norm) out.push({ raw: trimmed, norm });
    }
  }

  return out;
};

/** Every maximal numeral in the input, with the token span it occupies. */
export const findAmountCandidates = (tokens: readonly Token[]): Candidate[] => {
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

    const STRONG_CUES = new Set(['$', 'usd', 'cop', 'cuanto', 'valor']);
    if (before) {
      if (AMOUNT_CUES.has(before)) score += 5;
      if (STRONG_CUES.has(before)) score += 15;
    }

    // If the actual typed token contained a currency symbol, it's almost certainly the amount
    for (let k = i; k < match.next; k++) {
      if (
        tokens[k].raw.includes('$') ||
        tokens[k].raw.toLowerCase().includes('usd') ||
        tokens[k].raw.toLowerCase().includes('cop')
      ) {
        score += 15;
        break;
      }
    }

    // MEGA UPGRADE: Multidivisa Automática
    let finalValue = match.value;
    let endToken = match.next;
    const isUSD = after === 'usd' || after === 'dolares' || after === 'dolar';
    const isEUR =
      after === 'eur' ||
      after === 'euros' ||
      after === 'euro' ||
      tokens[match.next - 1]?.raw.includes('€');
    if (isUSD) {
      finalValue = match.value * 4000;
      score += 15; // Mentioning "dolares" is a huge amount cue
      endToken += 1; // Consume the currency word
    } else if (isEUR) {
      finalValue = match.value * 4400;
      score += 15;
      if (after === 'eur' || after === 'euros' || after === 'euro') endToken += 1;
    }

    // "compré 2 pizzas por 30 mil" — the 2 is a quantity, not the amount.
    if (after && COUNT_NOUNS.has(after)) score -= 2;

    out.push({
      value: finalValue,
      start: i,
      end: endToken,
      score,
      hasScale: match.hasScale,
      usedDigits: match.usedDigits,
      usedWords: match.usedWords,
      usedSlang: match.usedSlang,
    });

    i = endToken;
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
const lookupWithStem = <T>(table: Record<string, T>, norm: string): T | undefined => {
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
  'a',
  'al',
  'de',
  'del',
  'en',
  'desde',
  'con',
  'hacia',
  'para',
  'hasta',
  'por',
]);

const ACCOUNT_DETERMINERS = new Set([
  'mi',
  'tu',
  'su',
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
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

      let start = i;
      let source: CuentaSource = 'nombre';

      if (i > 0 && !consumed[i - 1]) {
        const prev1 = tokens[i - 1].norm;
        if (PREPOSICIONES_DE_CUENTA.has(prev1)) {
          start = i - 1;
          source = 'preposicion';
        } else if (ACCOUNT_DETERMINERS.has(prev1) && i > 1 && !consumed[i - 2]) {
          const prev2 = tokens[i - 2].norm;
          if (PREPOSICIONES_DE_CUENTA.has(prev2)) {
            start = i - 2;
            source = 'preposicion';
          }
        }
      }

      hallazgos.push({
        id: candidata.id,
        start,
        end: i + span,
        source,
      });
    }
  }

  if (hallazgos.length === 0) return null;
  return hallazgos.find((h) => h.source === 'preposicion') ?? hallazgos[0];
};

const detectAndConsumePaymentMethod = (
  tokens: readonly Token[],
  consumed: boolean[],
): PaymentMethod => {
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const method = PAYMENT_METHODS[tokens[i].norm];
    if (method) {
      consumed[i] = true;
      if (
        i > 0 &&
        !consumed[i - 1] &&
        (tokens[i - 1].norm === 'con' || tokens[i - 1].norm === 'en')
      ) {
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
  transacciones: readonly Transaction[] = [],
): ParsedTransaction => {
  const tokens = tokenize(raw);
  const consumed = new Array<boolean>(tokens.length).fill(false);

  // 1 — Amount. Extracted FIRST, and its tokens are removed from everything
  // downstream, so the category matcher can never see `mil` and the description
  // never repeats the number.
  const candidates = findAmountCandidates(tokens);

  // MEGA UPGRADE 6: Fraction Math
  let fractionMultiplier = 1;
  const rawLowerForMath = raw.toLowerCase();
  if (rawLowerForMath.includes('la mitad de') || rawLowerForMath.includes('mitad de'))
    fractionMultiplier = 0.5;
  else if (rawLowerForMath.includes('un tercio de') || rawLowerForMath.includes('tercera parte de'))
    fractionMultiplier = 1 / 3;
  else if (rawLowerForMath.includes('un cuarto de') || rawLowerForMath.includes('cuarta parte de'))
    fractionMultiplier = 0.25;
  else if (rawLowerForMath.includes('el doble de')) fractionMultiplier = 2;
  else if (rawLowerForMath.includes('el triple de')) fractionMultiplier = 3;

  // Upgrade 1: Sumar múltiples montos unidos por conjunciones ("20 mil y 3 mil")
  let amount: number | null = null;
  let best = pickBest(candidates);

  if (best) {
    const valid = candidates.filter((c) => c.score >= 0).sort((a, b) => a.start - b.start);

    // Check if best is part of a conjoined chain
    const CONJUNCTIONS = new Set(['y', 'e', 'mas', 'más', 'con', 'propina', 'de']);

    // We will find chains of conjoined valid amounts
    let bestChainTotal = 0;
    let bestChainIndices: number[] = [];
    let bestChainScore = -Infinity;

    for (let startIdx = 0; startIdx < valid.length; startIdx++) {
      let chainTotal = valid[startIdx].value;
      let chainIndices: number[] = [];
      let chainMaxScore = valid[startIdx].score;
      for (let j = valid[startIdx].start; j < valid[startIdx].end; j++) chainIndices.push(j);

      let curr = valid[startIdx];
      for (let i = startIdx + 1; i < valid.length; i++) {
        const next = valid[i];
        if (next.start - curr.end <= 2) {
          const middle = tokens.slice(curr.end, next.start).map((t) => t.norm);
          if (middle.length === 0 || middle.some((t) => CONJUNCTIONS.has(t))) {
            chainTotal += next.value;
            chainMaxScore = Math.max(chainMaxScore, next.score);
            for (let j = curr.end; j < next.end; j++) chainIndices.push(j);
            curr = next;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (chainTotal > bestChainTotal) {
        bestChainTotal = chainTotal;
        bestChainIndices = chainIndices;
        bestChainScore = chainMaxScore;
      }
    }

    if (bestChainTotal > best.value && bestChainScore >= best.score) {
      amount = Math.round(bestChainTotal * fractionMultiplier);
      for (const idx of bestChainIndices) consumed[idx] = true;
      // Note: we might have consumed the middle tokens too!
      // Actually let's manually consume the middle tokens.
      let curr = valid.find((v) => v.start === bestChainIndices[0])!;
      for (let i = valid.indexOf(curr) + 1; i < valid.length; i++) {
        const next = valid[i];
        if (bestChainIndices.includes(next.start)) {
          for (let j = curr.end; j < next.start; j++) consumed[j] = true;
          curr = next;
        }
      }
    } else {
      amount = Math.round(best.value * fractionMultiplier);
      for (let i = best.start; i < best.end; i += 1) consumed[i] = true;
    }

    // Consume preceding AMOUNT_CUE ("por", "vale", "son")
    const firstStart = bestChainTotal > best.value ? bestChainIndices[0] : best.start;
    if (firstStart > 0 && AMOUNT_CUES.has(tokens[firstStart - 1].norm)) {
      consumed[firstStart - 1] = true;
    }
  }

  const available = () =>
    tokens.map((t, index) => ({ ...t, index })).filter((t) => !consumed[t.index]);

  // 2 — Direction. Longest phrase first, so "me costó" (expense) is never
  // mistaken for the income sense of a leading "me".
  let kind: TxKind = 'gasto';
  let kindSource: KindSource = 'default';

  // Find ALL kind phrase matches to eliminate redundant fillers
  const kindMatches: { kind: TxKind; startIndex: number; endIndex: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    for (const phrase of KIND_PHRASES) {
      const span = phrase.seq.length;
      if (i + span <= tokens.length) {
        if (phrase.seq.every((s, k) => tokens[i + k].norm === s)) {
          kindMatches.push({
            kind: phrase.kind,
            startIndex: i,
            endIndex: i + span,
          });
          // Move `i` forward by the length of the matched phrase
          i += span - 1;
          break; // break the KIND_PHRASES loop, continue outer forKind loop
        }
      }
    }
  }

  if (kindMatches.length > 0) {
    kind = kindMatches[0].kind;
    kindSource = 'keyword';

    // We KEEP the first kind phrase in the description (so it starts naturally: "Me compre..."),
    // but we CONSUME all subsequent redundant kind phrases ("pague", "me costo").
    for (let m = 1; m < kindMatches.length; m++) {
      for (let k = kindMatches[m].startIndex; k < kindMatches[m].endIndex; k++) {
        consumed[k] = true;
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
        // We also DON'T consume the first morphological match, so "Me transfirieron..." reads naturally
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

  // 4 — Account. Its tokens ARE consumed, unlike category keywords: once the
  // bank is a structured field on the movement, repeating it in the description
  // says the same thing twice.
  const hallada = buscarCuenta(tokens, consumed, cuentas);
  if (hallada) {
    for (let i = hallada.start; i < hallada.end; i += 1) consumed[i] = true;
  }
  let cuentaId = hallada ? hallada.id : null;
  let cuentaSource: CuentaSource = hallada ? hallada.source : 'ninguna';

  // 5 — Payment method. Consumed so 'en efectivo' or 'con tarjeta' doesn't leak into description.
  const paymentMethod = detectAndConsumePaymentMethod(tokens, consumed);

  // MEGA UPGRADE 2: Time Machine (Date extraction)
  let dateOverride: string | undefined = undefined;
  const today = new Date();

  // Format Date to YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const norm = tokens[i].norm;
    let d: Date | null = null;
    let consumedIdx: number[] = [];

    // 1. Días relativos simples
    if (norm === 'ayer' || norm === 'anoche') {
      d = new Date(today);
      d.setDate(d.getDate() - 1);
      consumedIdx = [i];
    } else if (norm === 'anteayer' || norm === 'antier') {
      d = new Date(today);
      d.setDate(d.getDate() - 2);
      consumedIdx = [i];
    } else if (norm === 'hoy') {
      d = new Date(today);
      consumedIdx = [i];
    }

    // 2. "hace X dias"
    if (
      !d &&
      norm === 'hace' &&
      i + 2 < tokens.length &&
      (tokens[i + 2].norm === 'dias' ||
        tokens[i + 2].norm === 'dia' ||
        tokens[i + 2].norm === 'dí­as')
    ) {
      const match = readNumberAt(
        tokens.map((t) => t.norm),
        i + 1,
      );
      if (match && match.value > 0) {
        d = new Date(today);
        d.setDate(d.getDate() - match.value);
        consumedIdx = [i, i + 1, match.next]; // match.next is the index of "dias"
      }
    }

    // 3. "el [lunes] pasado"
    if (!d && norm === 'el' && i + 2 < tokens.length && tokens[i + 2].norm === 'pasado') {
      const diaStr = tokens[i + 1].norm;
      if (diaStr in DIAS_SEMANA) {
        const targetDay = DIAS_SEMANA[diaStr as keyof typeof DIAS_SEMANA];
        d = new Date(today);
        d.setDate(d.getDate() - 1); // Empezamos a buscar desde ayer
        while (d.getDay() !== targetDay) {
          d.setDate(d.getDate() - 1);
        }
        consumedIdx = [i, i + 1, i + 2];
      }
    }

    // 4. "el [numero] de [mes]"
    if (!d && norm === 'el' && i + 3 < tokens.length && tokens[i + 2].norm === 'de') {
      const match = readNumberAt(
        tokens.map((t) => t.norm),
        i + 1,
      );
      if (match && match.value >= 1 && match.value <= 31) {
        // match.next is the index of 'de', so month is match.next + 1
        const mesIdx = match.next + 1;
        if (mesIdx < tokens.length) {
          const mesStr = tokens[mesIdx].norm;
          if (mesStr in MESES_ANO) {
            const mesNum = MESES_ANO[mesStr as keyof typeof MESES_ANO];
            d = new Date(today.getFullYear(), mesNum, match.value);
            // Si la fecha es en el futuro, probablemente fue del año pasado
            if (d > today) d.setFullYear(d.getFullYear() - 1);
            consumedIdx = [i, i + 1, match.next, mesIdx];
          }
        }
      }
    }

    if (d !== null) {
      dateOverride = formatDate(d);
      for (const idx of consumedIdx) {
        consumed[idx] = true;
      }
    }
  }

  // MEGA UPGRADE 4: Implicit accounts by payment method
  if (!cuentaId) {
    if (paymentMethod === 'efectivo') {
      const efectivoAcc = cuentas.find(
        (c) =>
          c.nombre.toLowerCase().includes('efectivo') ||
          c.nombre.toLowerCase().includes('billetera'),
      );
      if (efectivoAcc) {
        cuentaId = efectivoAcc.id;
        cuentaSource = 'nombre'; // pretend it matched by name
      }
    } else if (paymentMethod === 'tarjeta_credito' || paymentMethod === 'tarjeta_debito') {
      const tarjetaAcc = cuentas.find(
        (c) =>
          c.nombre.toLowerCase().includes('tarjeta') || c.nombre.toLowerCase().includes('credito'),
      );
      if (tarjetaAcc) {
        cuentaId = tarjetaAcc.id;
        cuentaSource = 'nombre';
      }
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
      if (
        frase.seq.every((s, k) => {
          const t = dispon[i + k].norm;
          return t === s || t + 's' === s || s + 's' === t || t + 'es' === s || s + 'es' === t;
        })
      ) {
        addCategoryScore(frase.id, 'usuario', 100);
      }
    }
  }

  for (let i = 0; i < dispon.length; i++) {
    const token = dispon[i];

    // Check bigrams for merchants (e.g., "cruz verde" -> "cruzverde")
    if (i < dispon.length - 1) {
      const stopWords = new Set(['en', 'el', 'la', 'de', 'del', 'a', 'los', 'las', 'un', 'una']);
      if (!stopWords.has(token.norm) && !stopWords.has(dispon[i + 1].norm)) {
        const bigram = token.norm + dispon[i + 1].norm;
        const bigramMerchant = MERCHANTS[bigram];
        if (bigramMerchant) {
          addCategoryScore(bigramMerchant, 'merchant', 85);
        }
      }
    }

    const merchant = MERCHANTS[token.norm];
    if (merchant) {
      addCategoryScore(merchant, 'merchant', 80);
    } else if (token.norm.length > 5) {
      const similar = buscarSimilar(token.norm, Object.keys(MERCHANTS), 2);
      if (similar && Math.abs(similar.length - token.norm.length) <= 1 && similar.length > 4) {
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
    } else if (token.norm.length > 5) {
      const similar = buscarSimilar(token.norm, Object.keys(CATEGORY_KEYWORDS), 2);
      if (similar && Math.abs(similar.length - token.norm.length) <= 1 && similar.length > 4) {
        const keywordSimilar = lookupWithStem(CATEGORY_KEYWORDS, similar);
        if (keywordSimilar) {
          addCategoryScore(keywordSimilar, 'keyword', 40);
        }
      }
    }
  }

  const sortedCandidates = Array.from(categoryCandidates.entries()).sort(
    (a, b) => b[1].score - a[1].score,
  );

  if (sortedCandidates.length > 0) {
    category = sortedCandidates[0][0];
    categorySource = sortedCandidates[0][1].source;
  }

  if (categorySource === 'default' && kind === 'ingreso') {
    category = 'ingreso';
    addCategoryScore('ingreso', 'default', 10);
  } else if (categorySource === 'default' && kind === 'gasto') {
    // Zero-Shot Heuristic Fallback
    const textNorm = raw.toLowerCase();
    if (
      /\b(burger|pizza|sushi|taco|asadero|restaurante|empanada|panaderia|helado|almuerzo|comida|cena|desayuno|kfc|corrientazo)\b/.test(
        textNorm,
      )
    ) {
      category = 'comida';
      categorySource = 'keyword';
    } else if (
      /\b(uber|taxi|didi|cabify|bus|transmilenio|metro|gasolina|peaje|parqueadero|pasaje)\b/.test(
        textNorm,
      )
    ) {
      category = 'transporte';
      categorySource = 'keyword';
    } else if (
      /\b(discoteca|bar|pub|club|cine|pelicula|concierto|boleta|netflix|spotify|suscripcion)\b/.test(
        textNorm,
      )
    ) {
      category = 'ocio';
      categorySource = 'keyword';
    } else if (
      /\b(medico|pastilla|farmacia|drogueria|hospital|clinica|eps|cita|salud)\b/.test(textNorm)
    ) {
      category = 'salud';
      categorySource = 'keyword';
    } else if (
      /\b(ropa|zapato|camisa|pantalon|chaqueta|zapatilla|falda|vestido|outfit)\b/.test(textNorm)
    ) {
      category = 'compras';
      categorySource = 'keyword';
    } else if (
      /\b(mercado|supermercado|exito|carulla|jumbo|tienda|fruver|carniceria|viveres)\b/.test(
        textNorm,
      )
    ) {
      category = 'mercado';
      categorySource = 'keyword';
    } else if (/\b(luz|agua|gas|internet|celular|plan|factura|recibo|arriendo)\b/.test(textNorm)) {
      category = 'hogar';
      categorySource = 'keyword';
    }
  }
  // 6 — Semantic Chunker for Destinatario, Ubicacion, and Motivo
  let destinatario: string | null = null;
  let ubicacion: string | null = null;
  const tags: string[] = [];

  let currentChunk: 'motivo' | 'destinatario' | 'ubicacion' | 'ignore' = 'motivo';
  const chunks: Record<
    'motivo' | 'destinatario' | 'ubicacion' | 'ignore',
    (Token & { index: number })[]
  > = {
    motivo: [],
    destinatario: [],
    ubicacion: [],
    ignore: [],
  };

  const isOCR = raw.startsWith('[OCR]');

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  if (!isOCR) {
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

      if (
        [
          'viaje',
          'regalo',
          'emergencia',
          'salud',
          'vacaciones',
          'fiesta',
          'prestamo',
          'comida',
          'transporte',
          'suscripcion',
        ].includes(n)
      ) {
        if (!tags.includes(t.raw)) tags.push(t.raw);
      }

      chunks[currentChunk].push(t);
    }

    if (chunks.destinatario.length > 0) {
      destinatario = capitalize(chunks.destinatario.map((t) => t.raw).join(' '));
    }
    if (chunks.ubicacion.length > 0) {
      ubicacion = capitalize(chunks.ubicacion.map((t) => t.raw).join(' '));
    }
  } else {
    // OCR specific destinatario extraction
    const destMatch = raw.match(/(?:para|destino)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i);
    if (destMatch && destMatch[1]) {
      destinatario = destMatch[1].charAt(0).toUpperCase() + destMatch[1].slice(1).toLowerCase();
    }
  }

  // 6 — Description (Full conversational phrasing)
  let description = '';

  if (isOCR) {
    // Look for common receipt message markers and extract the text until the next marker
    const messageMatch = raw.match(
      /(?:mensaje|motivo|concepto|detalle|conversación|conversacion)\s+([\s\S]+?)(?:\s+(?:valor|fecha|costo|referencia|aprobado|hora|desde|hacia|¿cuánto\?|cuanto|numero|número)|$)/i,
    );
    if (messageMatch && messageMatch[1] && messageMatch[1].trim().length > 0) {
      description = messageMatch[1].trim();
    }
  }

  if (!description) {
    const words = tokens
      .filter((t, i) => {
        if (consumed[i]) return false;
        if (chunks.ignore.some((ign) => ign.index === i)) return false;
        if (isOCR && t.norm === 'ocr') return false; // Ignore the [OCR] tag
        return true;
      })
      .map((t) => MERCHANT_DISPLAY[t.norm] ?? t.raw);

    description = words.join(' ').trim();
    if (description === '') {
      description = CATEGORY_LABELS[category as Category] ?? category;
    } else {
      description = capitalize(description);
    }
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

  // MEGA UPGRADE 5: El Oráculo (Contextual Memory for recurring/known expenses)
  if (amount === null && description !== '' && transacciones.length > 0) {
    const descLower = description.toLowerCase();
    // Search newest first
    for (let i = transacciones.length - 1; i >= 0; i--) {
      const t = transacciones[i];
      if (
        t.description.toLowerCase().includes(descLower) ||
        descLower.includes(t.description.toLowerCase())
      ) {
        amount = t.amountCop;
        if (category === 'otros' || categorySource === 'default') {
          category = t.category as CategoriaClave;
          categorySource = 'aprendida';
        }
        if (cuentaId === null) {
          cuentaId = t.cuentaId;
          cuentaSource = 'nombre';
        }
        confidence += 0.4;
        confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
        break;
      }
    }
  }

  // MEGA UPGRADE 7: Auto-tagging based on description/raw context
  const rawLower = raw.toLowerCase();
  if (
    rawLower.includes('viaje') ||
    rawLower.includes('vacaciones') ||
    rawLower.includes('vuelo') ||
    rawLower.includes('hotel')
  )
    tags.push('viaje');
  if (
    rawLower.includes('cumpleaños') ||
    rawLower.includes('regalo') ||
    rawLower.includes('sorpresa')
  )
    tags.push('regalo');
  if (rawLower.includes('fiesta') || rawLower.includes('rumba') || rawLower.includes('salida'))
    tags.push('fiesta');
  if (
    rawLower.includes('multa') ||
    rawLower.includes('infraccion') ||
    rawLower.includes('intereses')
  )
    tags.push('multa');
  if (rawLower.includes('domicilio') || rawLower.includes('delivery') || rawLower.includes('rappi'))
    tags.push('domicilio');

  const suggestedCategories = [
    category,
    ...sortedCandidates.filter((c) => c[0] !== category).map((c) => c[0]),
    'otros',
    'comida',
    'transporte',
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);

  return {
    kind,
    amount,
    category,
    dateOverride,
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
  dateOverride: undefined,
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
