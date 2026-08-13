import type { CategoriaClave, Transaction, TxKind } from '../types';
import { monthKey } from './localDate';

/**
 * Algo que se repite todos los meses: el arriendo, Netflix, el gimnasio.
 *
 * La app NO los registra sola. Los propone y espera un toque, porque un
 * movimiento inventado es plata falsa en un libro contable: si el cobro no pasó
 * — te cancelaron el servicio, cambió el monto, el banco lo rechazó — un
 * registro automático deja el saldo mintiendo y nadie se entera hasta que
 * cuadra mal el mes.
 */
export interface Recurrente {
  id: string;
  nombre: string;
  kind: TxKind;
  amountCop: number;
  categoria: CategoriaClave;
  /** De dónde sale, cuando se sabe. */
  cuentaId: string | null;
  /** Día del mes en que suele caer, 1..31. */
  diaDelMes: number;
  createdAt: string;
  /** Se archiva en vez de borrarse: lo ya registrado sigue siendo válido. */
  archivedAt: string | null;
}

/** Días que de verdad tiene ese mes. */
const diasDelMes = (mes: string): number => {
  const [anio, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
};

/**
 * La fecha en que toca este mes.
 *
 * Un recurrente del día 31 en febrero cae el 28, no se salta el mes ni se va a
 * marzo: quien paga el arriendo el último día lo paga igual en febrero.
 */
export const fechaEnMes = (recurrente: Recurrente, mes: string): string => {
  const dia = Math.min(Math.max(1, recurrente.diaDelMes), diasDelMes(mes));
  return `${mes}-${String(dia).padStart(2, '0')}`;
};

/**
 * Si ya hay un movimiento que claramente es este recurrente.
 *
 * Se compara por monto, tipo y categoría dentro del mes, no por descripción: el
 * usuario pudo registrarlo a mano escribiendo otra cosa, y volver a proponerlo
 * lo llevaría a cobrarse dos veces el mismo arriendo.
 */
export const yaRegistrado = (
  recurrente: Recurrente,
  transacciones: readonly Transaction[],
  mes: string,
): boolean =>
  transacciones.some(
    (tx) =>
      monthKey(tx.occurredOn) === mes &&
      tx.kind === recurrente.kind &&
      tx.category === recurrente.categoria &&
      tx.amountCop === recurrente.amountCop,
  );

export interface Pendiente {
  recurrente: Recurrente;
  /** La fecha con la que se registraría. */
  fecha: string;
  /** True cuando ese día ya pasó y todavía no aparece. */
  vencido: boolean;
}

/**
 * Lo que falta por registrar este mes, lo más atrasado primero.
 *
 * Solo se proponen los que ya llegó su día. Ofrecer el arriendo del 30 cuando
 * estamos a 3 invita a registrarlo antes de que ocurra, y un libro que va
 * adelantado es tan inútil como uno atrasado.
 */
export const pendientesDelMes = (
  recurrentes: readonly Recurrente[],
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
): Pendiente[] => {
  const vivos = recurrentes.filter((r) => r.archivedAt === null);

  return vivos
    .map((recurrente) => ({
      recurrente,
      fecha: fechaEnMes(recurrente, mes),
      vencido: false,
    }))
    .filter(({ fecha }) => fecha <= hoy)
    .filter(({ recurrente }) => !yaRegistrado(recurrente, transacciones, mes))
    .map((p) => ({ ...p, vencido: p.fecha < hoy }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
};

/** El movimiento que se crearía al aceptar un pendiente. */
export const comoTransaccion = (
  pendiente: Pendiente,
  id: string,
  createdAt: string,
): Transaction => ({
  id,
  kind: pendiente.recurrente.kind,
  amountCop: pendiente.recurrente.amountCop,
  category: pendiente.recurrente.categoria,
  description: pendiente.recurrente.nombre,
  occurredOn: pendiente.fecha,
  cuentaId: pendiente.recurrente.cuentaId,
  // Queda dicho que salió de un recurrente y no de un dictado: si mañana el
  // monto cambia, se puede ver cuáles venían de la plantilla vieja.
  rawTranscript: `Recurrente: ${pendiente.recurrente.nombre}`,
  createdAt,
});

/** Cuánto suman al mes los recurrentes vivos, por dirección. */
export const totalMensual = (
  recurrentes: readonly Recurrente[],
): { gastoCop: number; ingresoCop: number } => {
  let gastoCop = 0;
  let ingresoCop = 0;
  for (const r of recurrentes) {
    if (r.archivedAt !== null) continue;
    if (r.kind === 'ingreso') ingresoCop += r.amountCop;
    else gastoCop += r.amountCop;
  }
  return { gastoCop, ingresoCop };
};
