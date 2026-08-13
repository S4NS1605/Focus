import type { CategoriaClave, Transaction } from '../types';
import { monthKey } from './localDate';

/**
 * Un tope de gasto mensual para una categoría.
 *
 * Es un límite que el usuario se pone, no un dato del banco: sirve para saber
 * cómo va el mes mientras todavía se puede hacer algo, que es lo único que
 * distingue un presupuesto de un informe de fin de mes.
 */
export interface Presupuesto {
  /** La categoría que limita. Una por categoría; el id ES la clave. */
  categoria: CategoriaClave;
  montoCop: number;
  createdAt: string;
}

/**
 * Dónde va una categoría contra su tope.
 *
 * `proyectadoCop` es lo que se gastaría al ritmo actual si el mes siguiera
 * igual. Se muestra aparte del gasto real y nunca en su lugar: es una
 * suposición, y presentarla como un hecho haría que alguien tomara una decisión
 * sobre plata que todavía no ha salido.
 */
export interface EstadoPresupuesto {
  categoria: CategoriaClave;
  topeCop: number;
  gastadoCop: number;
  disponibleCop: number;
  pctUsado: number;
  proyectadoCop: number;
  /** True cuando el ritmo actual termina el mes por encima del tope. */
  vaARebasar: boolean;
  excedidoCop: number;
}

/** Cuántos días tiene un mes 'YYYY-MM'. */
const diasDelMes = (mes: string): number => {
  const [anio, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
};

/**
 * Qué día del mes es hoy, si `hoy` cae dentro de `mes`.
 *
 * Para un mes ya cerrado devuelve el mes entero: proyectar sobre agosto cuando
 * estamos en octubre no tiene sentido, lo que se gastó ya se gastó.
 */
const diaTranscurrido = (mes: string, hoy: string): number => {
  const total = diasDelMes(mes);
  if (monthKey(hoy) !== mes) return hoy > mes ? total : 0;
  return Number(hoy.slice(8, 10));
};

export const gastadoEnCategoria = (
  transacciones: readonly Transaction[],
  mes: string,
  categoria: CategoriaClave,
): number => {
  let total = 0;
  for (const tx of transacciones) {
    if (tx.kind !== 'gasto') continue;
    if (tx.category !== categoria) continue;
    if (monthKey(tx.occurredOn) !== mes) continue;
    total += tx.amountCop;
  }
  return total;
};

export const estadoDePresupuesto = (
  presupuesto: Presupuesto,
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
): EstadoPresupuesto => {
  const gastadoCop = gastadoEnCategoria(transacciones, mes, presupuesto.categoria);
  const topeCop = presupuesto.montoCop;

  const dias = diasDelMes(mes);
  const transcurridos = diaTranscurrido(mes, hoy);
  // Sin días transcurridos no hay ritmo que proyectar, y dividir por cero daría
  // Infinity — que en pantalla se lee como una cifra, no como "no se sabe".
  const proyectadoCop =
    transcurridos === 0 ? gastadoCop : Math.round((gastadoCop / transcurridos) * dias);

  return {
    categoria: presupuesto.categoria,
    topeCop,
    gastadoCop,
    disponibleCop: Math.max(0, topeCop - gastadoCop),
    pctUsado: topeCop === 0 ? 0 : Math.min(999, Math.round((gastadoCop / topeCop) * 1000) / 10),
    proyectadoCop,
    vaARebasar: proyectadoCop > topeCop,
    excedidoCop: Math.max(0, gastadoCop - topeCop),
  };
};

/** Todos los presupuestos del mes, los más apretados primero. */
export const estadoDeTodos = (
  presupuestos: readonly Presupuesto[],
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
): EstadoPresupuesto[] =>
  presupuestos
    .map((p) => estadoDePresupuesto(p, transacciones, mes, hoy))
    // Lo que más urge va arriba: primero lo ya excedido, luego lo que va camino
    // de estarlo. Un presupuesto holgado no necesita que lo miren.
    .sort((a, b) => b.pctUsado - a.pctUsado);

export type TonoPresupuesto = 'bien' | 'atento' | 'excedido';

/**
 * Cómo va, en una palabra.
 *
 * `atento` no es un regaño: es el único estado que todavía sirve de algo,
 * porque avisa cuando aún queda mes por delante para corregir.
 */
export const tonoDe = (estado: EstadoPresupuesto): TonoPresupuesto => {
  if (estado.excedidoCop > 0) return 'excedido';
  if (estado.vaARebasar || estado.pctUsado >= 80) return 'atento';
  return 'bien';
};
