import type { MovimientoExtraido } from '../../src/features/lukapp/analista/tipos.ts';
import { categorizarDescripcion, exclusionDeDescripcion } from './categorizar.ts';
import type { PeriodoExtraido } from './nequi.ts';

export const pareceNu = (texto: string): boolean => /nu colombia|nu financiera/i.test(texto);

const MESES: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};

/** Latin-style thousands/decimal: `$1.259.783,00` -> 1259783. */
const aNumero = (valor: string): number =>
  Number.parseFloat(valor.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'));

// "04 jun Recibiste de X +$61.000,00" / "04 jun Pagaste tu tarjeta -$60.890,00"
const LINEA_CON_FECHA =
  /^(\d{1,2}) (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) (.+?) ([+-]\$[\d.]+,\d{2})$/i;
// "Impuesto del 4x1000 -$243,56" — a fee tied to the movement just above it,
// with no date of its own on this bank's export.
const LINEA_SIN_FECHA = /^(.+?) ([+-]\$[\d.]+,\d{2})$/;

const PERIODO = /(\d{2})\s*-\s*(\d{2})\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+(\d{4})/;

export const periodoNu = (texto: string): PeriodoExtraido | null => {
  const m = texto.match(PERIODO);
  if (!m) return null;
  const [, dDesde, dHasta, nombreMes, anio] = m;
  const mes = MESES[nombreMes.slice(0, 3).toLowerCase()];
  if (!mes) return null;
  return {
    desde: `${anio}-${mes}-${dDesde.padStart(2, '0')}`,
    hasta: `${anio}-${mes}-${dHasta.padStart(2, '0')}`,
    etiqueta: `${dDesde}-${dHasta} ${nombreMes} ${anio}`,
  };
};

const categoriaP2P = (descripcion: string): ReturnType<typeof categorizarDescripcion> => {
  const categoria = categorizarDescripcion(descripcion);
  if (categoria !== 'otros') return categoria;
  return /^(recibiste de|enviaste a)/i.test(descripcion) ? 'transferencia' : 'otros';
};

export const parsearNu = (texto: string): MovimientoExtraido[] => {
  const periodo = periodoNu(texto);
  if (!periodo) return [];
  const anio = periodo.desde.slice(0, 4);

  const movimientos: MovimientoExtraido[] = [];
  let fechaActual: string | null = null;

  // Only look inside the "Movimientos" sections — the account-summary block
  // near the top of the statement reuses the same "$X,XX" number shape and
  // would otherwise be misread as transactions.
  const inicioMovimientos = texto.indexOf('Movimientos');
  if (inicioMovimientos === -1) return [];

  for (const linea of texto.slice(inicioMovimientos).split('\n')) {
    const conFecha = linea.match(LINEA_CON_FECHA);
    if (conFecha) {
      const [, dia, nombreMes, descripcion, valor] = conFecha;
      const mes = MESES[nombreMes.slice(0, 3).toLowerCase()];
      if (!mes) continue;
      fechaActual = `${anio}-${mes}-${dia.padStart(2, '0')}`;
      const monto = aNumero(valor);
      if (Number.isNaN(monto)) continue;

      movimientos.push({
        fecha: fechaActual,
        descripcion: descripcion.trim(),
        montoCop: Math.abs(Math.round(monto)),
        tipo: monto < 0 ? 'gasto' : 'ingreso',
        categoria: categoriaP2P(descripcion),
        confianza: 'alta',
        exclusion: exclusionDeDescripcion(descripcion),
      });
      continue;
    }

    if (!fechaActual) continue;
    const sinFecha = linea.match(LINEA_SIN_FECHA);
    if (!sinFecha) continue;
    const [, descripcion, valor] = sinFecha;
    if (!/^impuesto del 4x1000$/i.test(descripcion.trim())) continue;
    const monto = aNumero(valor);
    if (Number.isNaN(monto)) continue;

    movimientos.push({
      fecha: fechaActual,
      descripcion: descripcion.trim(),
      montoCop: Math.abs(Math.round(monto)),
      tipo: monto < 0 ? 'gasto' : 'ingreso',
      categoria: 'otros',
      confianza: 'alta',
      exclusion: null,
    });
  }

  return movimientos;
};
