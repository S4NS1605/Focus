import type { CategoriaClave, Transaction, TxKind } from '../types';
import type { Catalogo } from '../categorias';
import { extraerContraparte } from './contraparte';
import { normalizarNombre } from './contactos';

/**
 * What the user is looking for.
 *
 * Every field is "no opinion" by default, so an untouched filter matches
 * everything and the list behaves exactly as it did before there was one.
 */
export interface Filtro {
  texto: string;
  categoria: CategoriaClave | null;
  cuentaId: string | null;
  kind: TxKind | null;
  /** Inclusive, 'YYYY-MM-DD'. Null means unbounded on that side. */
  desde: string | null;
  hasta: string | null;
}

export const FILTRO_VACIO: Filtro = {
  texto: '',
  categoria: null,
  cuentaId: null,
  kind: null,
  desde: null,
  hasta: null,
};

/**
 * Whether anything is actually being filtered.
 *
 * This is what decides that the search reaches the WHOLE ledger instead of the
 * visible month: searching one month at a time would mean stepping back through
 * the calendar to find something, which is the problem a search box exists to
 * remove. With no filter active the month stays in charge.
 */
export const filtroActivo = (filtro: Filtro): boolean =>
  filtro.texto.trim() !== '' ||
  filtro.categoria !== null ||
  filtro.cuentaId !== null ||
  filtro.kind !== null ||
  filtro.desde !== null ||
  filtro.hasta !== null;

/** Digits only, so "45000", "45.000" and "$45,000" are the same query. */
const soloDigitos = (texto: string): string => texto.replace(/\D/g, '');

/**
 * Text match across everything the row shows.
 *
 * The counterparty is included as its own field rather than relying on the
 * description containing it: a bank writes "Envio con BRE-B a: JUAN PEREZ", and
 * someone searching "juan perez" should find it whichever way the rail spelled
 * the prefix.
 */
const calzaTexto = (tx: Transaction, consulta: string, catalogo: Catalogo | null): boolean => {
  const q = normalizarNombre(consulta);
  if (q === '') return true;

  const campos = [
    normalizarNombre(tx.description),
    normalizarNombre(extraerContraparte(tx.description) ?? ''),
    normalizarNombre(catalogo?.de(tx.category).nombre ?? tx.category),
  ];
  if (campos.some((campo) => campo.includes(q))) return true;

  // Amounts are matched on digits so the thousands separators never get in the
  // way — nobody types "45.000" the same way twice.
  const digitos = soloDigitos(consulta);
  return digitos !== '' && String(tx.amountCop).includes(digitos);
};

export const filtrarMovimientos = (
  transacciones: readonly Transaction[],
  filtro: Filtro,
  catalogo: Catalogo | null = null,
): Transaction[] =>
  transacciones.filter((tx) => {
    if (filtro.kind !== null && tx.kind !== filtro.kind) return false;
    if (filtro.categoria !== null && tx.category !== filtro.categoria) return false;
    if (filtro.cuentaId !== null && tx.cuentaId !== filtro.cuentaId) return false;
    // Dates are 'YYYY-MM-DD', so lexical comparison IS chronological — no Date
    // object, and therefore no timezone to get wrong.
    if (filtro.desde !== null && tx.occurredOn < filtro.desde) return false;
    if (filtro.hasta !== null && tx.occurredOn > filtro.hasta) return false;
    return calzaTexto(tx, filtro.texto, catalogo);
  });

/** What the result adds up to, so a filtered view still answers "how much". */
export interface ResumenFiltro {
  cuantos: number;
  gastoCop: number;
  ingresoCop: number;
}

export const resumirFiltrado = (transacciones: readonly Transaction[]): ResumenFiltro => {
  let gastoCop = 0;
  let ingresoCop = 0;
  for (const tx of transacciones) {
    if (tx.kind === 'ingreso') ingresoCop += tx.amountCop;
    else gastoCop += tx.amountCop;
  }
  return { cuantos: transacciones.length, gastoCop, ingresoCop };
};
