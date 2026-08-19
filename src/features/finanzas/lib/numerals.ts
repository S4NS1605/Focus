// Spanish (Colombian) numeral reader. Digits and words go through ONE state
// machine, so `20 mil`, `veinte mil`, `20mil` and `20 lucas` all take the same
// path — there is no second code path to keep in sync.

const UNITS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const TENS: Record<string, number> = {
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
};

// Colombian money slang folds in as just another scale word: a "luca" is a
// thousand pesos, a "palo"/"melón" a million.
const THOUSAND_WORDS = [
  'mil',
  'miles',
  'luca',
  'lucas',
  'luquita',
  'luquitas',
  'barra',
  'barras',
  'k',
] as const;
const MILLION_WORDS = ['millon', 'millones', 'palo', 'palos', 'melon', 'melones'] as const;
const SLANG_WORDS: ReadonlySet<string> = new Set([
  'luca',
  'lucas',
  'luquita',
  'luquitas',
  'barra',
  'barras',
  'palo',
  'palos',
  'melon',
  'melones',
]);

const SCALES: Record<string, number> = {};
for (const w of THOUSAND_WORDS) SCALES[w] = 1_000;
for (const w of MILLION_WORDS) SCALES[w] = 1_000_000;

const HALVES: Record<string, number> = { medio: 0.5, media: 0.5 };

const CONNECTOR = 'y';

/** Anything the numeral reader can consume. Category/kind keywords must never
 *  collide with this set — `vocabulary.test.ts` asserts that invariant. */
export const NUMERAL_WORDS: ReadonlySet<string> = new Set([
  ...Object.keys(UNITS),
  ...Object.keys(TENS),
  ...Object.keys(HUNDREDS),
  ...Object.keys(SCALES),
  ...Object.keys(HALVES),
  CONNECTOR,
]);

const AMOUNT_CAP = 1_000_000_000_000;

const DIGIT_RE = /^\d+(?:\.\d+)?$/;

export const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Lowercase + de-accent. Applied per token so offsets never drift. */
export const normalizeWord = (value: string): string => stripAccents(value.toLowerCase());

/**
 * Rewrites es-CO numeric notation inside a single already-lowercased,
 * accent-stripped token. May split into two tokens (`20mil` -> `20`, `mil`).
 *
 * The dot is genuinely ambiguous in Colombian input: `45.000` is forty-five
 * thousand but `45.5` is a decimal. Rule: dot followed by EXACTLY three digits
 * in a grouped run is a thousands separator; anything else is a decimal.
 */
export const normalizeNumericToken = (token: string): string[] => {
  if (token === '$') return ['$'];
  let t = token.replace(/\$/g, '').replace(/^cop$/, '');
  if (t === '') return [];

  // 1'200.000 -> 1200000 (apostrophe is the Colombian millions separator)
  t = t.replace(
    /(\d+)'(\d{3})(?:\.(\d{3}))?/g,
    (_m, mill, thou, units) => `${mill}${thou}${units ?? ''}`,
  );

  // 45.000 -> 45000, 1.250.000 -> 1250000
  t = t.replace(/\d{1,3}(?:\.\d{3})+(?!\d)/g, (m) => m.replace(/\./g, ''));

  // 45,5 -> 45.5 (comma is the decimal separator in es-CO)
  t = t.replace(/(\d),(\d)/g, '$1.$2');

  // 20mil -> 20 mil, 45k -> 45 k
  const split = t.match(
    /^(\d+(?:\.\d+)?)(mil|miles|millon|millones|lucas?|luquitas?|palos?|melones?|barras?|k)$/,
  );
  if (split) return [split[1], split[2]];

  return [t];
};

export interface NumberMatch {
  value: number;
  /** Index one past the last numeric token consumed. */
  next: number;
  hasScale: boolean;
  usedDigits: boolean;
  usedWords: boolean;
  usedSlang: boolean;
}

/**
 * Reads the longest numeral starting at `start`, or null if there isn't one.
 *
 * Three registers are required. Two cannot represent `un millón doscientos mil`,
 * because the thousands group has to be finalized separately before the million
 * scale is applied:
 *
 *   result     — millions and above, already finalized
 *   groupTotal — thousands finalized within the current million group
 *   current    — the group being built (0..999, or a digit literal)
 */
export const readNumberAt = (tokens: readonly string[], start: number): NumberMatch | null => {
  let result = 0;
  let groupTotal = 0;
  let current = 0;

  let hasScale = false;
  let usedDigits = false;
  let usedWords = false;
  let usedSlang = false;
  let sawAny = false;
  let consumedUpTo = start;
  // The most recent scale applied, so a trailing "y medio" knows what it halves.
  let lastScale = 0;
  // Where the group now in `current` started, so it can be handed back to the
  // next numeral if it turns out not to belong to this one. -1 = nothing pending.
  let currentStart = -1;

  for (let i = start; i < tokens.length; i += 1) {
    const t = tokens[i];

    if (t === CONNECTOR) {
      // Only meaningful between numerals ("treinta y cinco"). Deliberately does
      // not advance consumedUpTo, so a trailing "y" stays in the description.
      if (!sawAny) break;
      continue;
    }

    if (t in HALVES) {
      if (current === 0 && lastScale > 0) {
        // "dos millones y medio" — halves the scale that was just applied.
        const half = HALVES[t] * lastScale;
        if (lastScale >= 1_000_000) result += half;
        else groupTotal += half;
      } else {
        // "medio millón" — waits in `current` for a scale to multiply it.
        if (current === 0) currentStart = i;
        current += HALVES[t];
      }
      usedWords = true;
      sawAny = true;
      consumedUpTo = i + 1;
      continue;
    }

    if (DIGIT_RE.test(t)) {
      // Two literals in a row means a new numeral began ("20 30").
      if (current !== 0) break;
      currentStart = i;
      current = parseFloat(t);
      usedDigits = true;
      sawAny = true;
      consumedUpTo = i + 1;
      continue;
    }

    const word = UNITS[t] ?? TENS[t] ?? HUNDREDS[t];
    if (word !== undefined) {
      if (current === 0) currentStart = i;
      current += word;
      usedWords = true;
      sawAny = true;
      consumedUpTo = i + 1;
      continue;
    }

    const scale = SCALES[t];
    if (scale !== undefined) {
      // Spanish applies each scale at most once per group, in descending order.
      // A repeat means a new numeral began ("20 mil 30 mil"), so stop — and hand
      // back the pending group, because those digits belong to that new numeral
      // rather than to this one. Without the rollback, "20 mil 30 mil" would
      // read as 20030.
      const repeated = scale === 1_000 ? groupTotal !== 0 : result !== 0;
      if (repeated) {
        if (currentStart >= 0) {
          consumedUpTo = currentStart;
          current = 0;
        }
        break;
      }

      if (scale === 1_000) groupTotal += (current || 1) * 1_000;
      else {
        result += (groupTotal + current || 1) * 1_000_000;
        groupTotal = 0;
      }

      lastScale = scale;
      current = 0;
      currentStart = -1;
      hasScale = true;
      if (SLANG_WORDS.has(t)) usedSlang = true;
      sawAny = true;
      consumedUpTo = i + 1;
      continue;
    }

    break;
  }

  if (!sawAny) return null;

  const total = result + groupTotal + current;
  // Rejects a bare "medio" (0.5) while keeping "medio millón".
  if (!hasScale && total < 1) return null;

  const value = Math.round(total);
  if (value < 1 || value > AMOUNT_CAP) return null;

  return { value, next: consumedUpTo, hasScale, usedDigits, usedWords, usedSlang };
};

/** Convenience wrapper: reads an amount out of a free-text fragment. */
export const parseAmount = (text: string): number | null => {
  const tokens = text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((piece) => normalizeNumericToken(normalizeWord(piece)));

  for (let i = 0; i < tokens.length; i += 1) {
    const match = readNumberAt(tokens, i);
    if (match) return match.value;
  }
  return null;
};
