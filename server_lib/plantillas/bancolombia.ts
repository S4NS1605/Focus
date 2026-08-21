import type { MovimientoExtraido } from '../../src/features/lukapp/analista/tipos.ts';
import { categorizarDescripcion, exclusionDeDescripcion } from './categorizar.ts';
import type { PeriodoExtraido } from './nequi.ts';

export const pareceBancolombia = (texto: string): boolean =>
  /bancolombia/i.test(texto) && /estado de cuenta/i.test(texto);

// Optional grouped integer part (may be entirely absent, e.g. bank-paid
// interest of ".03" pesos) followed by a mandatory 2-decimal tail.
const NUM = String.raw`-?(?:[\d,]*\d)?\.\d{2}`;
const RE_NUM_SOLO = new RegExp(`^${NUM}$`);
const RE_FECHA_SOLA = /^\d{1,2}\/\d{1,2}$/;
// "4/04 TRANSFERENCIA DESDE NEQUI 10,000.00 10,000.46" — date, free text,
// signed value, running balance, all on one line.
const LINEA_ROW = new RegExp(`^(\\d{1,2}\\/\\d{1,2})\\s+(.+?)\\s+(${NUM})\\s+${NUM}\\s*$`);

const PERIODO = /DESDE:\s*(\d{4})\/(\d{2})\/(\d{2})\s*HASTA:\s*(\d{4})\/(\d{2})\/(\d{2})/;

export const periodoBancolombia = (texto: string): PeriodoExtraido | null => {
  const m = texto.match(PERIODO);
  if (!m) return null;
  const [, ay, am, ad, by, bm, bd] = m;
  return {
    desde: `${ay}-${am}-${ad}`,
    hasta: `${by}-${bm}-${bd}`,
    etiqueta: `${ad}/${am}/${ay} — ${bd}/${bm}/${by}`,
  };
};

/** Every (año, mes) the statement period touches, in order — usually one
 *  entry per calendar month between `desde` and `hasta`. Transaction rows
 *  only carry a day/month, so the year has to be recovered from this list. */
const mesesDelPeriodo = (periodo: PeriodoExtraido): { anio: string; mes: string }[] => {
  const [ay, am] = periodo.desde.split('-');
  const [by, bm] = periodo.hasta.split('-');
  const meses: { anio: string; mes: string }[] = [];
  let anio = Number(ay);
  let mes = Number(am);
  const finAnio = Number(by);
  const finMes = Number(bm);
  // A generous cap, not a real constraint — statements here are at most a few
  // months, this just guarantees the loop terminates on malformed input.
  for (let i = 0; i < 36; i += 1) {
    meses.push({ anio: String(anio), mes: String(mes).padStart(2, '0') });
    if (anio === finAnio && mes === finMes) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
};

const anioParaMes = (mes: string, meses: { anio: string; mes: string }[]): string =>
  meses.find((m) => m.mes === mes)?.anio ?? meses[meses.length - 1].anio;

const aIso = (fechaCorta: string, meses: { anio: string; mes: string }[]): string => {
  const [d, m] = fechaCorta.split('/');
  const mes = m.padStart(2, '0');
  return `${anioParaMes(mes, meses)}-${mes}-${d.padStart(2, '0')}`;
};

const aNumero = (valor: string): number => Number.parseFloat(valor.replace(/,/g, ''));

const construirMovimiento = (
  fechaCorta: string,
  descripcion: string,
  valor: string,
  meses: { anio: string; mes: string }[],
): MovimientoExtraido | null => {
  const monto = aNumero(valor);
  if (Number.isNaN(monto)) return null;
  return {
    fecha: aIso(fechaCorta, meses),
    descripcion: descripcion.trim(),
    montoCop: Math.abs(Math.round(monto)),
    tipo: monto < 0 ? 'gasto' : 'ingreso',
    categoria: categorizarDescripcion(descripcion),
    confianza: 'alta',
    exclusion: exclusionDeDescripcion(descripcion),
  };
};

/**
 * Some pages of this bank's PDF export lay the transaction table out with
 * every row on its own line (date, description and both amounts together);
 * others — observed on continuation pages once a table fills the page
 * without a page break interrupting it — get emitted by the PDF's own text
 * stream column-by-column: every date, then every description, then every
 * value, then every running balance, as four equal-length blocks in the
 * original row order. This reconstructs the row-major reading for that case.
 */
const analizarBloqueColumnar = (
  lineas: readonly string[],
): { fecha: string; descripcion: string; valor: string }[] => {
  const fechas: string[] = [];
  const descripciones: string[] = [];
  const numeros: string[] = [];
  let fase: 'fechas' | 'descripciones' | 'numeros' = 'fechas';

  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (!linea) continue;

    if (fase === 'fechas') {
      if (RE_FECHA_SOLA.test(linea)) {
        fechas.push(linea);
        continue;
      }
      fase = 'descripciones';
    }
    if (fase === 'descripciones') {
      if (RE_NUM_SOLO.test(linea)) {
        fase = 'numeros';
      } else {
        descripciones.push(linea);
        continue;
      }
    }
    if (RE_NUM_SOLO.test(linea)) numeros.push(linea);
  }

  const n = fechas.length;
  if (n === 0 || descripciones.length !== n || numeros.length !== 2 * n) return [];

  return fechas.map((fecha, i) => ({ fecha, descripcion: descripciones[i], valor: numeros[i] }));
};

export const parsearBancolombia = (texto: string): MovimientoExtraido[] => {
  const periodo = periodoBancolombia(texto);
  if (!periodo) return [];
  const meses = mesesDelPeriodo(periodo);

  const movimientos: MovimientoExtraido[] = [];

  for (const pagina of texto.split(/-- \d+ of \d+ --/i)) {
    const lineas = pagina.split('\n');

    const filasDirectas: { fecha: string; descripcion: string; valor: string }[] = [];
    for (const linea of lineas) {
      const m = linea.match(LINEA_ROW);
      if (m) filasDirectas.push({ fecha: m[1], descripcion: m[2], valor: m[3] });
    }

    const inicioTabla = lineas.findIndex((l) => /FECHA\s+DESCRIPCI[OÓ]N/i.test(l));
    const filas =
      filasDirectas.length > 0
        ? filasDirectas
        : inicioTabla === -1
          ? []
          : analizarBloqueColumnar(lineas.slice(inicioTabla + 1));

    for (const fila of filas) {
      const mov = construirMovimiento(fila.fecha, fila.descripcion, fila.valor, meses);
      if (mov) movimientos.push(mov);
    }
  }

  return movimientos;
};
