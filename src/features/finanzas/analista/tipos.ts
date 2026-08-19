import type { Category, TxKind } from '../types';

// TYPE-ONLY on purpose. The zod schema that validates these lives in
// netlify/functions/_lib/esquema.ts, so zod never reaches the browser bundle —
// these declarations erase to nothing at build time.

/** Why a line on the statement must not be counted in the month's totals. */
export type MotivoExclusion =
  /** Moving money between the owner's own accounts. Not income, not spending. */
  | 'traslado-propio'
  /** Paying off a credit card. The purchases it covers are the real expense. */
  | 'pago-tarjeta'
  /** A refund or reversal that cancels another line. */
  | 'reverso'
  /** A running-balance or informational row that is not a movement at all. */
  | 'saldo-informativo';

export interface MovimientoExtraido {
  /** Bogota calendar day, 'YYYY-MM-DD'. */
  fecha: string;
  descripcion: string;
  /** Always positive. `tipo` carries the direction. */
  montoCop: number;
  tipo: TxKind;
  categoria: Category;
  /** 'alta' when the statement text was unambiguous. */
  confianza: 'alta' | 'media' | 'baja';
  /**
   * Set when the line must be left out of the totals. Naively summing every row
   * on a statement double-counts: an internal transfer is not income, and a card
   * payment is not a new expense when the purchases it settles are also listed.
   */
  exclusion: MotivoExclusion | null;
}

export interface FilaMetrica {
  etiqueta: string;
  valorCop: number;
  nota: string | null;
}

export interface Alerta {
  severidad: 'alta' | 'media' | 'baja';
  titulo: string;
  detalle: string;
}

export interface Recomendacion {
  titulo: string;
  detalle: string;
  /** Estimated monthly saving in COP, when the model can ground it in a figure. */
  ahorroMensualCop: number | null;
}

export interface AnalisisResultado {
  periodo: { desde: string; hasta: string; etiqueta: string };
  /** The narrative read of the period, in a few sentences. */
  veredicto: string;
  metricas: FilaMetrica[];
  alertas: Alerta[];
  recomendaciones: Recomendacion[];
  movimientos: MovimientoExtraido[];
  /** Anything the model could not read confidently, stated rather than invented. */
  advertencias: string[];
}

/** What `analizar-extracto` returns — a single synchronous response, since
 *  template parsing takes milliseconds and needs no polling. */
export type RespuestaAnalisis =
  { ok: true; resultado: AnalisisResultado } | { ok: false; codigo: CodigoError; mensaje: string };

export type CodigoError =
  | 'sin-autorizacion'
  | 'pdf-invalido'
  | 'pdf-muy-grande'
  | 'banco-no-soportado'
  | 'sin-movimientos'
  | 'fallo-interno';
