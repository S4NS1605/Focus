import type { Transaction } from '../types';
import { extraerContraparte } from './contraparte';

/**
 * People and businesses on the other side of a movement.
 *
 * The list is not typed in by hand — it is what the statements already said,
 * gathered up. The only thing the app cannot work out on its own is when two
 * spellings are one person, because a Colombian statement names the same
 * contact differently on every rail: "JUAN PEREZ" over BRE-B, "Juan P." on a
 * transfer, "Juan Carlos Perez" on a QR payment. Left alone that splits one
 * person into three rows and makes the counterparty view lie about who you
 * actually move money with.
 */
export interface Contacto {
  id: string;
  /** What to show. Starts as the first spelling seen, and can be renamed. */
  nombre: string;
  /**
   * Every raw counterparty string that resolves here, normalized. The display
   * name is not necessarily one of them — renaming must not orphan movements.
   */
  alias: string[];
  /**
   * Normalized names this contact was explicitly said NOT to be. Without it the
   * same question comes back every time the app reloads, which is the fastest
   * way to make a helpful prompt into an annoyance.
   */
  separadoDe: string[];
  createdAt: string;
  archivedAt: string | null;
}

/** Case, accents and punctuation removed — the form everything compares on. */
export const normalizarNombre = (nombre: string): string =>
  nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Levenshtein, capped: only ever asked whether two short words nearly match. */
const distancia = (a: string, b: string): number => {
  if (a === b) return 0;
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let esquina = previa[0];
    previa[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const anterior = previa[j];
      previa[j] = Math.min(
        previa[j] + 1,
        previa[j - 1] + 1,
        esquina + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      esquina = anterior;
    }
  }

  return previa[b.length];
};

/** Two name-parts that plausibly refer to the same word. */
const mismaPalabra = (a: string, b: string): boolean => {
  if (a === b) return true;
  // An initial standing in for a full name: "Juan P" / "Juan Perez".
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  // One tolerated typo, but only once a word is long enough that a single
  // edit cannot turn it into a genuinely different name ("ana" / "ema").
  return a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1;
};

/**
 * How much two names look like the same party, 0 to 1.
 *
 * Exactly 1 is reserved for names that normalize identically — those need no
 * question, they simply are the same string wearing different accents. Anything
 * short of that is a guess, and is capped below 1 so a guess can never be
 * mistaken for a certainty by a caller comparing against 1.
 */
export const parecido = (a: string, b: string): number => {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (na === '' || nb === '') return 0;
  if (na === nb) return 1;

  const partesA = na.split(' ');
  const partesB = nb.split(' ');

  const disponibles = [...partesB];
  let calzadas = 0;
  for (const parte of partesA) {
    const idx = disponibles.findIndex((otra) => mismaPalabra(parte, otra));
    if (idx !== -1) {
      calzadas += 1;
      disponibles.splice(idx, 1);
    }
  }

  const proporcion = calzadas / Math.max(partesA.length, partesB.length);
  // Capped: a token-based guess is never a certainty.
  return Math.min(0.95, Number(proporcion.toFixed(2)));
};

/**
 * Above this, two names are worth asking about. Below it, they are left alone.
 *
 * Set where "Juan Perez" vs "Juan Carlos Perez" (0.67) still asks but "Rappi"
 * vs "Rappi Pro" (0.5) does not: a false question costs more attention than a
 * missed merge costs accuracy, and the missed one can still be merged by hand.
 */
export const UMBRAL_PREGUNTA = 0.6;

/** One counterparty as it appears across the ledger. */
export interface ParteVista {
  /** Normalized, and the key everything joins on. */
  clave: string;
  /** The spelling seen most often, which is the one worth showing. */
  nombre: string;
  movimientos: number;
  ultimaFecha: string;
}

/** Every counterparty the movements name, most frequent first. */
export const partesDelLibro = (transacciones: readonly Transaction[]): ParteVista[] => {
  const porClave = new Map<string, { grafias: Map<string, number>; n: number; ultima: string }>();

  for (const tx of transacciones) {
    const nombre = extraerContraparte(tx.description);
    if (nombre === null) continue;

    const clave = normalizarNombre(nombre);
    if (clave === '') continue;

    const actual = porClave.get(clave) ?? { grafias: new Map(), n: 0, ultima: '' };
    actual.grafias.set(nombre, (actual.grafias.get(nombre) ?? 0) + 1);
    actual.n += 1;
    if (tx.occurredOn > actual.ultima) actual.ultima = tx.occurredOn;
    porClave.set(clave, actual);
  }

  return [...porClave.entries()]
    .map(([clave, dato]) => ({
      clave,
      // Ties break alphabetically so the shown name cannot flip between reloads.
      nombre: [...dato.grafias.entries()].sort(
        (a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0], 'es')),
      )[0][0],
      movimientos: dato.n,
      ultimaFecha: dato.ultima,
    }))
    .sort((a, b) =>
      b.movimientos !== a.movimientos
        ? b.movimientos - a.movimientos
        : a.nombre.localeCompare(b.nombre, 'es'),
    );
};

/** A pair the app cannot decide on its own. */
export interface Duda {
  /** Stable across reloads, so a dismissal can be remembered. */
  clave: string;
  a: ParteVista;
  b: ParteVista;
  parecido: number;
}

const claveDeDuda = (a: string, b: string): string => [a, b].sort().join('|');

/**
 * The pairs worth asking about, best guess first.
 *
 * Anything already merged, already rejected, or already the same string is
 * excluded here rather than at the point of display — a question the user has
 * settled must never be able to reach the screen a second time.
 */
export const dudasDeUnion = (
  partes: readonly ParteVista[],
  contactos: readonly Contacto[],
): Duda[] => {
  const contactoDe = new Map<string, string>();
  for (const c of contactos) {
    for (const alias of c.alias) contactoDe.set(alias, c.id);
  }

  const rechazado = new Set<string>();
  for (const c of contactos) {
    for (const alias of c.alias) {
      for (const otra of c.separadoDe) rechazado.add(claveDeDuda(alias, otra));
    }
  }

  const dudas: Duda[] = [];

  for (let i = 0; i < partes.length; i += 1) {
    for (let j = i + 1; j < partes.length; j += 1) {
      const a = partes[i];
      const b = partes[j];

      // Already one contact: nothing left to ask.
      const ca = contactoDe.get(a.clave);
      const cb = contactoDe.get(b.clave);
      if (ca !== undefined && ca === cb) continue;

      if (rechazado.has(claveDeDuda(a.clave, b.clave))) continue;

      const puntaje = parecido(a.nombre, b.nombre);
      if (puntaje < UMBRAL_PREGUNTA || puntaje >= 1) continue;

      dudas.push({ clave: claveDeDuda(a.clave, b.clave), a, b, parecido: puntaje });
    }
  }

  return dudas.sort((x, y) =>
    y.parecido !== x.parecido ? y.parecido - x.parecido : x.clave.localeCompare(y.clave),
  );
};

/** Movements belonging to a contact, newest first. */
export const movimientosDeContacto = (
  transacciones: readonly Transaction[],
  contacto: Contacto,
): Transaction[] => {
  const suyos = new Set(contacto.alias);
  return transacciones
    .filter((tx) => {
      const nombre = extraerContraparte(tx.description);
      return nombre !== null && suyos.has(normalizarNombre(nombre));
    })
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
};
