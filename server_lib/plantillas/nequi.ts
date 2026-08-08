import type { MovimientoExtraido } from '../../src/features/finanzas/analista/tipos.ts';
import { categorizarDescripcion, exclusionDeDescripcion } from './categorizar.ts';

export const pareceNequi = (texto: string): boolean =>
  /dep[oó]sito de bajo monto/i.test(texto) && /nequi/i.test(texto);

/** `DD/MM/YYYY` -> `YYYY-MM-DD`. */
const aIso = (fecha: string): string => {
  const [d, m, y] = fecha.split('/');
  return `${y}-${m}-${d}`;
};

/** US-style thousands/decimal: `$-50,000.00` -> -50000. */
const aNumero = (valor: string): number => Number.parseFloat(valor.replace(/,/g, ''));

// One transaction per line: date, free-text description, signed value, running
// balance — all four columns land on the same line for this bank's export.
const LINEA_MOVIMIENTO = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+\$(-?[\d,]+\.\d{2})\s+\$-?[\d,]+\.\d{2}\s*$/;

const PERIODO = /per[ií]odo de:\s*(\d{4})\/(\d{2})\/(\d{2})\s*a\s*(\d{4})\/(\d{2})\/(\d{2})/i;

export interface PeriodoExtraido {
  desde: string;
  hasta: string;
  etiqueta: string;
}

export const periodoNequi = (texto: string): PeriodoExtraido | null => {
  const m = texto.match(PERIODO);
  if (!m) return null;
  const [, ay, am, ad, by, bm, bd] = m;
  return {
    desde: `${ay}-${am}-${ad}`,
    hasta: `${by}-${bm}-${bd}`,
    etiqueta: `${ad}/${am}/${ay} — ${bd}/${bm}/${by}`,
  };
};

/**
 * Account holder, printed on the statement's first lines.
 *
 * Worth extracting because it is the only reliable way to tell a transfer to
 * oneself from a transfer to someone else — the wallet shows only a first name
 * as the counterparty, and without this the two are indistinguishable.
 */
const TITULAR = /dep[oó]sito de bajo monto de:\s*\n\s*(.+)/i;

export const titularNequi = (texto: string): string | null =>
  texto.match(TITULAR)?.[1]?.trim() || null;

export const parsearNequi = (texto: string): MovimientoExtraido[] => {
  const movimientos: MovimientoExtraido[] = [];
  const titular = titularNequi(texto) ?? undefined;

  for (const linea of texto.split('\n')) {
    const m = linea.match(LINEA_MOVIMIENTO);
    if (!m) continue;
    const [, fecha, descripcion, valor] = m;
    const monto = aNumero(valor);
    if (Number.isNaN(monto)) continue;

    movimientos.push({
      fecha: aIso(fecha),
      descripcion: descripcion.trim(),
      montoCop: Math.abs(Math.round(monto)),
      tipo: monto < 0 ? 'gasto' : 'ingreso',
      categoria: categorizarDescripcion(descripcion),
      confianza: 'alta',
      exclusion: exclusionDeDescripcion(descripcion, titular),
    });
  }

  return movimientos;
};
