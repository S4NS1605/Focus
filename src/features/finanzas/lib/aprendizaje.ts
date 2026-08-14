import type { Transaction } from '../types';
import { NUMERAL_WORDS, normalizeWord } from './numerals';
import { KIND_WORDS, STOPWORDS } from './vocabulary';

/**
 * Lo que el parser aprende de tu propio libro.
 *
 * Cada movimiento guarda el texto que dictaste y la categoría que confirmaste.
 * De ese par sale, sin escribir listas a mano, qué categoría suele terminar
 * teniendo cada palabra PARA TI: dices "croquetas" y siempre lo archivas en
 * Mascotas, así que la próxima vez ya lo propone solo. Es lo que hace que sea
 * más preciso cada día, y es completamente local — sale de datos que ya tienes,
 * no se guarda nada nuevo ni sale a ningún lado.
 */
export interface LexicoAprendido {
  /** La categoría que esta palabra suele tener para ti, o null si no hay señal. */
  categoriaDe: (norm: string) => string | null;
  /** Cuántas palabras alcanzaron evidencia suficiente. Para inspección. */
  readonly tamano: number;
}

/** Palabras demasiado cortas no distinguen nada; se ignoran. */
const LARGO_MIN = 3;
/** En cuántos movimientos distintos hay que haber visto la palabra para fiarse. */
const MIN_EVIDENCIA = 2;
/**
 * Qué tan dominante debe ser una categoría sobre las demás para la palabra.
 * A 0.6, un empate (0.5) nunca gana: hace falta que de verdad predomine.
 */
const CUOTA_DOMINANTE = 0.6;

/**
 * Las palabras con contenido de una frase: fuera el monto, las palabras de
 * dirección ("gasté", "me pagaron"), los conectores y los numerales. Lo que
 * queda es lo que de verdad dice de qué fue el movimiento.
 */
const palabrasContenido = (raw: string): string[] => {
  const out: string[] = [];

  for (const piece of raw.split(/\s+/)) {
    const trimmed = piece
      .replace(/^[^\p{L}\p{N}$]+/u, '')
      .replace(/[^\p{L}\p{N}]+$/u, '');
    if (!trimmed) continue;

    const norm = normalizeWord(trimmed);
    if (norm.length < LARGO_MIN) continue;
    if (STOPWORDS.has(norm) || KIND_WORDS.has(norm) || NUMERAL_WORDS.has(norm)) continue;
    if (/^\d+$/.test(norm)) continue;

    out.push(norm);
  }

  return out;
};

/**
 * Arma el léxico a partir del historial.
 *
 * Se cuenta en cuántos MOVIMIENTOS aparece cada palabra por categoría, no cuántas
 * veces se dijo: repetir "café café café" en una frase no debe pesar como tres
 * días distintos. Una palabra solo entra al léxico si se vio lo suficiente y una
 * categoría predomina, para que un movimiento suelto y raro no reescriba lo que
 * sueles hacer.
 */
export const aprenderDe = (transacciones: readonly Transaction[]): LexicoAprendido => {
  const conteo = new Map<string, Map<string, number>>();

  for (const tx of transacciones) {
    if (!tx.rawTranscript) continue;
    for (const palabra of new Set(palabrasContenido(tx.rawTranscript))) {
      const porCat = conteo.get(palabra) ?? new Map<string, number>();
      porCat.set(tx.category, (porCat.get(tx.category) ?? 0) + 1);
      conteo.set(palabra, porCat);
    }
  }

  const resuelto = new Map<string, string>();
  for (const [palabra, porCat] of conteo) {
    let total = 0;
    let mejor = '';
    let mejorN = 0;
    for (const [cat, n] of porCat) {
      total += n;
      if (n > mejorN) {
        mejorN = n;
        mejor = cat;
      }
    }
    if (mejorN >= MIN_EVIDENCIA && mejorN / total >= CUOTA_DOMINANTE) {
      resuelto.set(palabra, mejor);
    }
  }

  return {
    categoriaDe: (norm) => resuelto.get(norm) ?? null,
    tamano: resuelto.size,
  };
};

/** Un léxico vacío, para cuando todavía no hay historia de la cual aprender. */
export const LEXICO_VACIO: LexicoAprendido = {
  categoriaDe: () => null,
  tamano: 0,
};
