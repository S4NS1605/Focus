import type { MovimientoExtraido } from '../../src/features/lukapp/analista/tipos.ts';
import { categorizarDescripcion, exclusionDeDescripcion } from './categorizar.ts';
import type { PeriodoExtraido } from './nequi.ts';

export const pareceDavivienda = (texto: string): boolean =>
  /davivienda/i.test(texto) && /informe del mes/i.test(texto);

/**
 * One movement per line:
 *
 *   30 07 $ 614,139.00+ 8509 Abono En Cuenta Por Pago de Nomina
 *
 * Two details this bank does differently from the others here:
 *
 * - The SIGN IS A SUFFIX on the amount (`614,139.00+`), not a prefix. Reading it
 *   as a leading minus, the way every other template does, silently turns every
 *   withdrawal into a deposit.
 * - The row carries only day and month. The year lives in the header alone.
 */
const LINEA = /^(\d{2})\s+(\d{2})\s+\$\s*([\d,]*\d\.\d{2})([+-])\s+(\S+)\s+(.+?)\s*$/;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const CABECERA = /informe del mes:\s*([a-záéíóúñ]+)\s*\/\s*(\d{4})/i;

/** `JULIO /2026` -> `{ mes: 7, anio: 2026 }`. */
const mesDeCabecera = (texto: string): { mes: number; anio: number } | null => {
  const m = texto.match(CABECERA);
  if (!m) return null;
  const indice = MESES.indexOf(
    m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  );
  if (indice === -1) return null;
  return { mes: indice + 1, anio: Number(m[2]) };
};

export const periodoDavivienda = (texto: string): PeriodoExtraido | null => {
  const cabecera = mesDeCabecera(texto);
  if (!cabecera) return null;

  const { mes, anio } = cabecera;
  const mm = String(mes).padStart(2, '0');
  // Day 0 of the next month is the last day of this one, leap years included.
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}`,
    etiqueta: `${MESES[mes - 1]} ${anio}`,
  };
};

/**
 * The statement states one month, but a row can belong to the previous year:
 * a January statement listing a 31/12 movement would otherwise be filed twelve
 * months into the future.
 */
const anioDeFila = (mesFila: number, cabecera: { mes: number; anio: number }): number =>
  mesFila > cabecera.mes ? cabecera.anio - 1 : cabecera.anio;

const aNumero = (valor: string): number => Number.parseFloat(valor.replace(/,/g, ''));

export const parsearDavivienda = (texto: string): MovimientoExtraido[] => {
  const cabecera = mesDeCabecera(texto);
  if (!cabecera) return [];

  const movimientos: MovimientoExtraido[] = [];

  for (const linea of texto.split('\n')) {
    const m = linea.match(LINEA);
    if (!m) continue;

    const [, dia, mes, valor, signo, , descripcion] = m;
    const monto = aNumero(valor);
    if (!Number.isFinite(monto)) continue;

    const anio = anioDeFila(Number(mes), cabecera);

    movimientos.push({
      fecha: `${anio}-${mes}-${dia}`,
      descripcion: descripcion.trim(),
      montoCop: Math.abs(Math.round(monto)),
      tipo: signo === '-' ? 'gasto' : 'ingreso',
      categoria: categorizarDescripcion(descripcion),
      confianza: 'alta',
      exclusion: exclusionDeDescripcion(descripcion),
    });
  }

  return movimientos;
};
